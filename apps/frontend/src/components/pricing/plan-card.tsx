import { Check, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PricingPlan } from '@/data/pricing/plans';

interface PlanCardProps {
  plan: PricingPlan;
  /** Whether this plan matches the user's current subscription. */
  isCurrent: boolean;
  /** Whether the checkout request is currently loading (any plan). */
  loading: boolean;
  /** Click handler; receives the plan being selected. */
  onSelect: (plan: PricingPlan) => void;
}

/**
 * Single pricing-plan card. Stateless — receives everything via props.
 * Replaces the inline `.map()` block that previously lived in
 * `app/pricing/page.tsx`. The `isPopular` flag on `plan` toggles the
 * highlighted styling.
 */
export function PlanCard({ plan, isCurrent, loading, onSelect }: PlanCardProps) {
  return (
    <div
      className={`glass-card relative flex flex-col rounded-2xl p-7 transition-all duration-300 ${
        plan.isPopular
          ? 'border-2 border-brand-primary bg-gradient-to-b from-brand-primary/10 to-brand-surface-container-high/80 shadow-2xl shadow-brand-primary/20 md:-translate-y-4 md:scale-[1.02]'
          : 'border border-brand-outline-variant/20 bg-brand-surface-container-low/40 hover:-translate-y-1 hover:border-brand-tertiary/40'
      }`}
    >
      {plan.isPopular && (
        <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-gradient-to-r from-brand-primary to-brand-tertiary px-4 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-lg">
          <Sparkles className="h-3 w-3" />
          Phổ biến nhất
        </span>
      )}

      {/* Plan icon + name */}
      <div className="mb-5 flex items-center gap-3">
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg ${
            plan.isPopular
              ? 'bg-gradient-to-br from-brand-primary to-brand-tertiary text-white'
              : 'border border-brand-tertiary/30 bg-brand-tertiary/10 text-brand-tertiary'
          }`}
        >
          {plan.id === 'free' && '🍃'}
          {plan.id === 'basic' && '🌱'}
          {plan.id === 'pro' && '⚡'}
          {plan.id === 'premium' && '👑'}
        </span>
        <h3 className="font-headline text-xl font-bold text-brand-on-surface">{plan.name}</h3>
      </div>

      <p className="mb-6 min-h-[44px] text-sm text-brand-on-surface-variant leading-relaxed">
        {plan.description}
      </p>

      {/* Price block */}
      <div
        className={`mb-7 min-w-0 rounded-xl p-4 ${
          plan.isPopular
            ? 'bg-white/5 ring-1 ring-brand-primary/30'
            : 'bg-white/[0.02]'
        }`}
      >
        <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
          <span className="font-headline text-3xl font-extrabold text-brand-tertiary sm:text-4xl">
            {plan.price}
          </span>
          <span className="text-sm font-semibold text-brand-on-surface-variant">VND</span>
          <span className="text-sm font-medium text-brand-on-surface-variant/70">
            / {plan.period}
          </span>
        </div>
      </div>

      <ul className="mb-8 flex-1 space-y-3 font-body text-sm text-brand-on-surface-variant">
        {plan.features.map((feature, idx) => (
          <li key={idx} className="flex flex-col gap-1.5">
            <span className="flex items-start gap-2.5">
              <span
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                  plan.isPopular
                    ? 'bg-brand-primary/20 text-brand-primary'
                    : 'bg-brand-tertiary/15 text-brand-tertiary'
                }`}
              >
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
              <span className="leading-relaxed">{feature}</span>
            </span>
            {/* Show the helper badge only under the quota feature (first
                bullet) and only when one is defined for this plan. */}
            {idx === 0 && plan.quotaNote && (
              <span
                className={`ml-[26px] inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                  plan.isPopular
                    ? 'border-brand-primary/30 bg-brand-primary/10 text-brand-primary'
                    : 'border-brand-tertiary/30 bg-brand-tertiary/10 text-brand-tertiary'
                }`}
              >
                <Sparkles className="h-3 w-3" />
                {plan.quotaNote}
              </span>
            )}
          </li>
        ))}
      </ul>

      <Button
        onClick={() => plan.id !== 'free' && onSelect(plan)}
        disabled={loading || plan.id === 'free' || isCurrent}
        className={`w-full rounded-xl py-3 text-sm font-bold transition-all ${
          plan.isPopular
            ? 'bg-gradient-to-r from-brand-primary to-brand-tertiary text-white shadow-lg shadow-brand-primary/30 hover:shadow-xl hover:shadow-brand-primary/50'
            : 'border border-brand-outline-variant/30 bg-white/5 text-brand-on-surface hover:bg-brand-tertiary/10 hover:border-brand-tertiary/50 hover:text-brand-tertiary'
        } disabled:opacity-50 disabled:hover:bg-white/5 disabled:hover:text-brand-on-surface disabled:hover:border-brand-outline-variant/30`}
      >
        {isCurrent || (plan.id === 'free' && (!isCurrent))
          ? 'Gói hiện tại'
          : loading
          ? 'Đang xử lý...'
          : plan.id === 'free'
          ? 'Gói mặc định'
          : `Chọn gói ${plan.name}`}
      </Button>
    </div>
  );
}
