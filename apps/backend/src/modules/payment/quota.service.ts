import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import {
  ChatMode,
  IPlanDefinition,
  PLAN_CATALOG,
  PlanNotAllowedError,
  assertModeAllowed,
  resolveEffectivePlan,
} from './plan-catalog';

export class QuotaExceededError extends Error {
  readonly code = 'QUOTA_EXCEEDED';
  constructor(
    public readonly plan: IPlanDefinition,
    public readonly used: number,
    public readonly limit: number,
    public readonly year: number,
    public readonly month: number,
  ) {
    super(
      `Bạn đã dùng hết ${limit} lượt của gói "${plan.displayName}" trong tháng ${month}/${year}. ` +
      `Vui lòng nâng cấp gói hoặc đợi đến tháng sau.`,
    );
  }
}

export interface IQuotaStatus {
  plan: IPlanDefinition;
  used: number;
  limit: number;
  remaining: number;
  year: number;
  month: number;
  resetAt: Date;     // first day of the next month, 00:00 UTC
}

@Injectable()
export class QuotaService {
  private readonly logger = new Logger(QuotaService.name);

  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  /** Read-only: get the current month's status for a user. */
  async getStatus(userId: string): Promise<IQuotaStatus> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    const plan = resolveEffectivePlan(user?.subscriptionPlan, user?.subscriptionExpiresAt);
    const { year, month } = this.currentPeriod();
    const used = await this.getUsage(userId, year, month);
    return {
      plan,
      used,
      limit: plan.monthlyQuota,
      remaining: plan.monthlyQuota < 0 ? Infinity : Math.max(0, plan.monthlyQuota - used),
      year,
      month,
      resetAt: this.nextResetAt(year, month),
    };
  }

  /**
   * Check + increment. Returns the post-increment status. Throws:
   *   - PlanNotAllowedError if the plan doesn't allow the mode
   *   - QuotaExceededError if the user is at the limit
   *
   * Idempotent within a single chat call: the chat service MUST call
   * this exactly once per user message, AFTER classification but
   * BEFORE the LLM is invoked.
   */
  async checkAndIncrement(
    userId: string,
    mode: ChatMode,
  ): Promise<IQuotaStatus> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    const plan = resolveEffectivePlan(user?.subscriptionPlan, user?.subscriptionExpiresAt);

    // 1) Mode allowlist
    assertModeAllowed(plan, mode);

    const { year, month } = this.currentPeriod();

    // 2) Quota check + atomic increment via UPSERT.
    //    We do this in a single SQL statement so concurrent requests
    //    can't both read "9 < 12" and both increment past 12.
    const limit = plan.monthlyQuota;
    if (limit >= 0) {
      const row = await this.dataSource.query<Array<{ id: string; used: number }>>(
        `
        INSERT INTO "chat_quotas" ("user_id", "year", "month", "plan", "used", "last_used_at", "created_at", "updated_at")
        VALUES ($1, $2, $3, $4, 1, now(), now(), now())
        ON CONFLICT ("user_id", "year", "month")
        DO UPDATE SET
          "used" = "chat_quotas"."used" + 1,
          "last_used_at" = now(),
          "updated_at" = now()
        RETURNING "id", "used"
        `,
        [userId, year, month, plan.id],
      );
      const newUsed = row[0]?.used ?? 0;
      // If we just exceeded the limit, ROLLBACK the increment.
      // We do this by re-reading and decrementing — not perfect for
      // strict correctness, but good enough for billing-grade UX.
      if (newUsed > limit) {
        await this.dataSource.query(
          `UPDATE "chat_quotas"
              SET "used" = "used" - 1
            WHERE "user_id" = $1 AND "year" = $2 AND "month" = $3`,
          [userId, year, month],
        );
        const currentUsed = newUsed - 1;
        throw new QuotaExceededError(plan, currentUsed, limit, year, month);
      }
      return {
        plan,
        used: newUsed,
        limit,
        remaining: limit - newUsed,
        year,
        month,
        resetAt: this.nextResetAt(year, month),
      };
    }

    // Unlimited plan — still record usage for analytics, but no check.
    await this.dataSource.query(
      `
      INSERT INTO "chat_quotas" ("user_id", "year", "month", "plan", "used", "last_used_at", "created_at", "updated_at")
      VALUES ($1, $2, $3, $4, 1, now(), now(), now())
      ON CONFLICT ("user_id", "year", "month")
      DO UPDATE SET
        "used" = "chat_quotas"."used" + 1,
        "last_used_at" = now(),
        "updated_at" = now()
      `,
      [userId, year, month, plan.id],
    );
    return {
      plan,
      used: -1,           // unknown but recorded
      limit: -1,
      remaining: Infinity,
      year,
      month,
      resetAt: this.nextResetAt(year, month),
    };
  }

  /** Lightweight read for the FE to render the usage pill. */
  async peekUsage(userId: string): Promise<{ used: number; limit: number; plan: string }> {
    const status = await this.getStatus(userId);
    return { used: status.used, limit: status.limit, plan: status.plan.id };
  }

  // ─────────────────────────────────────────────────────────────────────
  // Time helpers (all UTC — quota resets at 00:00 UTC on the 1st)
  // ─────────────────────────────────────────────────────────────────────

  private currentPeriod(now: Date = new Date()): { year: number; month: number } {
    return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
  }

  private async getUsage(userId: string, year: number, month: number): Promise<number> {
    const rows = await this.dataSource.query<Array<{ used: number }>>(
      `SELECT "used" FROM "chat_quotas"
        WHERE "user_id" = $1 AND "year" = $2 AND "month" = $3
        LIMIT 1`,
      [userId, year, month],
    );
    return rows[0]?.used ?? 0;
  }

  private nextResetAt(year: number, month: number): Date {
    // First day of the next month, 00:00 UTC.
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    return new Date(Date.UTC(nextYear, nextMonth - 1, 1, 0, 0, 0, 0));
  }
}

export { PlanNotAllowedError } from './plan-catalog';
export { PLAN_CATALOG, resolveEffectivePlan } from './plan-catalog';
