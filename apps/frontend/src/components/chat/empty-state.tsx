'use client';

import Image from 'next/image';
import { Sparkles, FileText, Scale, BookOpen, FileSignature } from 'lucide-react';

type Suggestion = { icon: 'sparkles' | 'file' | 'scale' | 'book' | 'signature'; text: string };

const SUGGESTIONS: Suggestion[] = [
  {
    icon: 'sparkles',
    text: 'Soạn thảo thỏa thuận bảo mật (NDA) cho một startup công nghệ',
  },
  {
    icon: 'scale',
    text: 'Giải thích sự khác biệt giữa trách nhiệm dân sự và trách nhiệm hình sự tại Việt Nam',
  },
  {
    icon: 'book',
    text: 'Tóm tắt các điều khoản quan trọng của một hợp đồng lao động điển hình',
  },
  {
    icon: 'file',
    text: 'Tôi cần kiểm tra những gì trước khi ký hợp đồng thuê nhà?',
  },
];

const ICONS: Record<Suggestion['icon'], React.ComponentType<{ className?: string }>> = {
  sparkles: Sparkles,
  file: FileText,
  scale: Scale,
  book: BookOpen,
  signature: FileSignature,
};

export function EmptyState({ onSelect }: { onSelect?: (text: string) => void }) {
  const greeting = getGreeting();
  return (
    <div className="flex h-full flex-col items-center justify-center px-4 py-10 text-brand-on-surface">
      {/* Greeting block */}
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="relative mb-4">
          {/* Glow halo behind logo */}
          <div
            aria-hidden
            className="absolute inset-0 -z-10 scale-150 rounded-full bg-brand-tertiary/25 blur-2xl"
          />
          <Image
            src="/logo.jpg"
            alt="LAW AI"
            width={64}
            height={64}
            className="h-16 w-16 rounded-2xl object-contain shadow-lg shadow-brand-tertiary/20"
            priority
          />
        </div>
        <h1 className="font-headline text-2xl font-semibold md:text-3xl">
          {greeting}!
        </h1>
        <p className="mt-2 max-w-md text-sm text-brand-on-surface-variant">
          Tôi là trợ lý pháp lý AI của bạn. Hỏi tôi bất kỳ điều gì về luật pháp, hợp đồng, hay thủ tục pháp lý tại Việt Nam.
        </p>
      </div>

      {/* Suggestion grid */}
      <div className="w-full max-w-2xl">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-brand-on-surface-variant/70">
          Gợi ý câu hỏi
        </p>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {SUGGESTIONS.map((s) => {
            const Icon = ICONS[s.icon];
            return (
              <button
                key={s.text}
                type="button"
                onClick={() => onSelect?.(s.text)}
                className="group flex items-start gap-3 rounded-xl border border-brand-tertiary/20 bg-white/5 p-4 text-left text-sm text-brand-on-surface transition-all hover:-translate-y-0.5 hover:border-brand-tertiary/50 hover:bg-brand-tertiary/10 hover:shadow-lg hover:shadow-brand-tertiary/10"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-primary/30 to-brand-tertiary/30 text-brand-tertiary transition-colors group-hover:from-brand-primary/50 group-hover:to-brand-tertiary/50">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="leading-relaxed">{s.text}</span>
              </button>
            );
          })}
        </div>

        {/* Helper hint */}
        <p className="mt-6 text-center text-xs text-brand-on-surface-variant/50">
          Mẹo: nhấn <kbd className="rounded border border-brand-outline-variant/30 bg-white/5 px-1.5 py-0.5 font-mono text-[10px]">Enter</kbd> để gửi, <kbd className="rounded border border-brand-outline-variant/30 bg-white/5 px-1.5 py-0.5 font-mono text-[10px]">Shift + Enter</kbd> để xuống dòng
        </p>
      </div>
    </div>
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Chúc bạn thức khuya vui vẻ';
  if (h < 12) return 'Chào buổi sáng';
  if (h < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}
