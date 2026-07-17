'use client';

import { FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StreamSource } from '@/lib/chat-stream';

interface SourceChipProps {
  index: number;
  source: StreamSource;
  onClick?: () => void;
}

/**
 * One citation pill rendered beneath the assistant bubble.
 * Clicking copies the source snippet to the clipboard (MVP) — a later
 * iteration can open a modal showing the full chunk with highlighted
 * match positions.
 */
export function SourceChip({ index, source, onClick }: SourceChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={source.snippet}
      className={cn(
        'group flex items-center gap-1.5 rounded-md border border-brand-tertiary/30',
        'bg-brand-tertiary/5 px-2 py-1 text-xs text-brand-on-surface',
        'transition-colors hover:border-brand-tertiary/60 hover:bg-brand-tertiary/15',
      )}
    >
      <FileText className="h-3 w-3 text-brand-tertiary" />
      <span className="font-mono text-[10px] text-brand-tertiary/80">[{index}]</span>
      <span className="max-w-[180px] truncate">{source.name}</span>
    </button>
  );
}
