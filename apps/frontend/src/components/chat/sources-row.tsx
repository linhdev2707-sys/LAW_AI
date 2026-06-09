'use client';

import { toast } from 'sonner';
import { SourceChip } from './source-chip';
import type { StreamSource } from '@/lib/chat-stream';

interface SourcesRowProps {
  sources: StreamSource[];
}

export function SourcesRow({ sources }: SourcesRowProps) {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-wider text-brand-on-surface-variant/60">
        Nguồn:
      </span>
      {sources.map((s) => (
        <SourceChip
          key={s.index}
          index={s.index}
          source={s}
          onClick={() => {
            navigator.clipboard
              .writeText(s.snippet)
              .then(() =>
                toast.success(`Đã sao chép đoạn trích từ [${s.index}]`),
              )
              .catch(() => {
                /* clipboard may be blocked — silent */
              });
          }}
        />
      ))}
    </div>
  );
}
