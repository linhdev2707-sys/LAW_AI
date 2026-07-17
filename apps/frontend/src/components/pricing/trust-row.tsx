import { TRUST_ITEMS, type PricingTrustItem } from '@/data/pricing/trust';

/**
 * Three trust badges shown between the pricing grid and the FAQ.
 * Tone controls the icon background + icon color. Pure presentational.
 */
export function TrustRow() {
  return (
    <div className="mb-16 grid grid-cols-1 gap-4 md:grid-cols-3">
      {TRUST_ITEMS.map((item) => (
        <TrustCard key={item.title} item={item} />
      ))}
    </div>
  );
}

const TONE_CLASSES: Record<PricingTrustItem['tone'], { wrapper: string; icon: string }> = {
  emerald: {
    wrapper: 'bg-emerald-500/10 text-emerald-400',
    icon: 'text-emerald-400',
  },
  cyan: {
    wrapper: 'bg-brand-tertiary/10 text-brand-tertiary',
    icon: 'text-brand-tertiary',
  },
  amber: {
    wrapper: 'bg-amber-500/10 text-amber-400',
    icon: 'text-amber-400',
  },
};

function TrustCard({ item }: { item: PricingTrustItem }) {
  const Icon = item.icon;
  const tone = TONE_CLASSES[item.tone];

  return (
    <div className="glass-card flex items-center gap-3 rounded-xl border border-brand-outline-variant/20 bg-brand-surface-container-low/40 p-4">
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tone.wrapper}`}
      >
        <Icon className={`h-5 w-5 ${tone.icon}`} />
      </span>
      <div>
        <p className="text-sm font-bold text-brand-on-surface">{item.title}</p>
        <p className="text-xs text-brand-on-surface-variant">{item.description}</p>
      </div>
    </div>
  );
}
