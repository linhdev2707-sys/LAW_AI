'use client';

import { useState } from 'react';
import { Plus, Minus } from 'lucide-react';
import type { PricingFaqItem } from '@/data/pricing/faq';

interface FaqItemProps {
  item: PricingFaqItem;
}

/**
 * Accordion-style FAQ row used on the pricing page. Local open state —
 * if you need controlled state across items later, lift this up via props.
 */
export function FaqItem({ item }: FaqItemProps) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={`glass-card overflow-hidden rounded-xl border transition-all ${
        open
          ? 'border-brand-tertiary/40 bg-brand-surface-container-low/70'
          : 'border-brand-outline-variant/20 bg-brand-surface-container-low/40 hover:border-brand-outline-variant/40'
      }`}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <span className="text-sm font-semibold text-brand-on-surface">{item.question}</span>
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-all ${
            open
              ? 'border-brand-tertiary bg-brand-tertiary/15 text-brand-tertiary'
              : 'border-brand-outline-variant/30 text-brand-on-surface-variant'
          }`}
        >
          {open ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
        </span>
      </button>
      <div
        className={`grid transition-all duration-300 ${
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <p className="px-5 pb-4 text-sm leading-relaxed text-brand-on-surface-variant">
            {item.answer}
          </p>
        </div>
      </div>
    </div>
  );
}
