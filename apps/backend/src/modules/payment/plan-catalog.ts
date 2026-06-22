/**
 * Centralised plan → features + monthly limit mapping.
 *
 * Update this file to add/remove plans or change limits; everything
 * else (chat enforcement, FE pricing page, payment webhook) reads
 * from here. No magic numbers anywhere else.
 *
 * Mode policy:
 *   - `fast`     : always allowed (free tier default)
 *   - `lookup`   : always allowed (read-only, no LLM cost)
 *   - `deep`     : agentic — paid only (basic+)
 */
export type ChatMode = 'fast' | 'deep' | 'lookup';

export interface IPlanDefinition {
  /** Public id, matches users.subscription_plan. */
  id: 'free' | 'basic' | 'plus' | 'pro';
  /** Vietnamese display name. */
  displayName: string;
  /** Monthly quota across all modes. -1 = unlimited. */
  monthlyQuota: number;
  /** Suggested retail price in VND (display only — actual price is set
   *  in the payment provider's catalog). */
  priceVnd: number;
  /** Which chat modes this plan may use. */
  allowedModes: ChatMode[];
  /** Marketing tagline (Vietnamese). */
  tagline: string;
}

export const PLAN_CATALOG: Record<IPlanDefinition['id'], IPlanDefinition> = {
  free: {
    id: 'free',
    displayName: 'Miễn phí',
    monthlyQuota: 12,
    priceVnd: 0,
    allowedModes: ['fast', 'lookup'],
    tagline: 'Dùng thử các tính năng cơ bản',
  },
  basic: {
    id: 'basic',
    displayName: 'Cơ bản',
    monthlyQuota: 72,
    priceVnd: 99_000,
    allowedModes: ['fast', 'deep', 'lookup'],
    tagline: 'Suy nghĩ sâu + truy vấn nhanh',
  },
  plus: {
    id: 'plus',
    displayName: 'Plus',
    monthlyQuota: 192,
    priceVnd: 199_000,
    allowedModes: ['fast', 'deep', 'lookup'],
    tagline: 'Dành cho người dùng thường xuyên',
  },
  pro: {
    id: 'pro',
    displayName: 'Pro',
    monthlyQuota: 600,
    priceVnd: 499_000,
    allowedModes: ['fast', 'deep', 'lookup'],
    tagline: 'Không giới hạn cho luật sư & doanh nghiệp',
  },
};

export const PLAN_IDS: IPlanDefinition['id'][] = ['free', 'basic', 'plus', 'pro'];

/**
 * Resolve the effective plan for a user. Falls back to `free` if the
 * stored plan id is unknown OR if the subscription has expired.
 */
export function resolveEffectivePlan(
  storedPlan: string | null | undefined,
  expiresAt: Date | null | undefined,
  now: Date = new Date(),
): IPlanDefinition {
  const id = (storedPlan ?? 'free') as IPlanDefinition['id'];
  const def = PLAN_CATALOG[id] ?? PLAN_CATALOG.free;
  // Expired subscription → free tier
  if (expiresAt && expiresAt < now && def.id !== 'free') {
    return PLAN_CATALOG.free;
  }
  return def;
}

/**
 * Throws a typed error if the plan does not allow the requested mode.
 * Caller maps the error to the appropriate HTTP status (403 for
 * mode-not-allowed, 429 for quota-exceeded).
 */
export class PlanNotAllowedError extends Error {
  readonly code = 'PLAN_NOT_ALLOWED';
  constructor(public readonly plan: IPlanDefinition, public readonly mode: ChatMode) {
    super(
      `Gói "${plan.displayName}" không hỗ trợ chế độ "${mode}". ` +
      `Vui lòng nâng cấp gói để sử dụng.`,
    );
  }
}

export function assertModeAllowed(plan: IPlanDefinition, mode: ChatMode): void {
  if (!plan.allowedModes.includes(mode)) {
    throw new PlanNotAllowedError(plan, mode);
  }
}
