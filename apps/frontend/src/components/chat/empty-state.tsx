'use client';

import Image from 'next/image';
import { Sparkles } from 'lucide-react';

const SUGGESTIONS = [
  'Draft a non-disclosure agreement for a tech startup',
  'Explain the difference between civil and criminal liability in Vietnam',
  'Summarise the key clauses of a typical employment contract',
  'What should I check before signing a lease agreement?',
];

export function EmptyState({ onSelect }: { onSelect?: (text: string) => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-4 text-brand-on-surface">
      <div className="mb-6 flex items-center gap-3">
        <Image
          src="/logo.jpg"
          alt="LAW AI"
          width={48}
          height={48}
          className="h-12 w-12 rounded-lg object-contain"
        />
        <h1 className="text-2xl font-semibold">How can I help you today?</h1>
      </div>
      <div className="grid w-full max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSelect?.(s)}
            className="group flex items-start gap-2 rounded-lg border border-brand-tertiary/20 bg-white/5 p-3 text-left text-sm text-brand-on-surface transition hover:border-brand-tertiary/50 hover:bg-brand-tertiary/10"
          >
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-tertiary" />
            <span>{s}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
