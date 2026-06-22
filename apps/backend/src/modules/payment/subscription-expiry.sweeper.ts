import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, Not, IsNull } from 'typeorm';
import { User } from '../user/entities/user.entity';

/**
 * Sweeper: every hour, downgrade any user whose `subscription_expires_at`
 * has passed back to the `free` plan.
 *
 * This is a SAFETY NET for the lazy runtime check in
 * `PlanCatalog.resolveEffectivePlan()`. Even if the runtime check is
 * somehow bypassed (e.g. someone reads the user record directly), the
 * DB is kept in sync so:
 *   - admin dashboards show correct plan
 *   - billing audits are accurate
 *   - the `users.subscription_plan` column is the single source of truth
 *
 * The cron runs hourly which is fine-grained enough — the runtime
 * check provides instant UX feedback for users that hit the expiry
 * boundary between sweeps.
 */
@Injectable()
export class SubscriptionExpirySweeper {
  private readonly logger = new Logger(SubscriptionExpirySweeper.name);

  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async sweep(): Promise<void> {
    try {
      const now = new Date();
      const result = await this.userRepo.update(
        {
          // Only downgrade paid plans; leave 'free' rows alone.
          subscriptionPlan: Not('free'),
          // expiry is in the past (and is not null)
          subscriptionExpiresAt: LessThan(now),
        },
        { subscriptionPlan: 'free' },
      );

      const changed = (result.affected ?? 0);
      if (changed > 0) {
        this.logger.log(
          `Downgraded ${changed} expired subscription(s) to 'free'`,
        );
      } else {
        this.logger.debug('Subscription expiry sweep: no expired users');
      }
    } catch (e) {
      this.logger.error(
        `Subscription expiry sweep failed: ${(e as Error).message}`,
      );
    }
  }
}
