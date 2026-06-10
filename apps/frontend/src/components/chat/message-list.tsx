'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { ArrowDown } from 'lucide-react';
import type { IMessage } from '@/lib/chat';
import type { StreamSource } from '@/lib/chat-stream';
import { MessageBubble } from './message-bubble';
import { cn } from '@/lib/utils';

interface MessageListProps {
  messages: IMessage[];
  /** Map assistant message id → RAG sources surfaced for that turn. */
  sources?: Record<string, StreamSource[]>;
  loading?: boolean;
}

/** Hide the "jump to latest" pill when this many pixels (or fewer) from
 *  the bottom. The threshold is intentionally generous so the pill doesn't
 *  flicker as the user scrolls a few pixels while reading. */
const STICK_TO_BOTTOM_PX = 200;

export function MessageList({ messages, sources, loading }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // Auto-scroll to bottom while the user is parked at (or near) the bottom.
  // We watch the messages array's serialized content (not just `length`) so
  // streaming tokens — which mutate the *last* message's content — also
  // trigger a stick-to-bottom scroll. Using useLayoutEffect avoids the
  // one-frame flash where new content appears above the input bar.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !isAtBottom) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, loading, isAtBottom]);

  // Detect manual scroll: if user scrolls up, mark "not at bottom"; if they
  // scroll back into the threshold zone, mark "at bottom" again.
  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setIsAtBottom(distanceFromBottom <= STICK_TO_BOTTOM_PX);
  }

  function jumpToLatest() {
    const el = scrollRef.current;
    if (!el) return;
    setIsAtBottom(true);
    // Scroll twice to defeat the smooth-scroll race: first to the *current*
    // scrollHeight (instant), then again after a tick in case streaming
    // appended more height in the meantime.
    el.scrollTop = el.scrollHeight;
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    });
  }

  return (
    <div ref={scrollRef} onScroll={onScroll} className="relative flex-1 overflow-y-auto bg-brand-background">
      {messages.length === 0 && !loading ? (
        <div className="flex h-full items-center justify-center px-4 py-20 text-center text-brand-on-surface-variant">
          <p>Bắt đầu cuộc trò chuyện bằng cách gửi tin nhắn bên dưới.</p>
        </div>
      ) : (
        <div className="space-y-10 py-10 pb-40">
          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              sources={m.role === 'assistant' ? sources?.[m.id] : undefined}
            />
          ))}
        </div>
      )}

      {/* Floating "jump to latest" pill — shown only when the user has
          scrolled away from the bottom. Once they click it, we force
          isAtBottom=true and scroll instantly, which collapses the pill. */}
      {!isAtBottom && (
        <button
          type="button"
          onClick={jumpToLatest}
          className={cn(
            'absolute bottom-32 left-1/2 -translate-x-1/2 z-20',
            'flex items-center gap-1.5 rounded-full border border-brand-tertiary/50',
            'bg-brand-surface-container/95 px-3.5 py-2 text-xs font-medium text-brand-on-surface',
            'shadow-lg shadow-black/40 backdrop-blur transition-all',
            'hover:border-brand-tertiary/80 hover:bg-brand-tertiary/15',
            'animate-in fade-in slide-in-from-bottom-2 duration-200',
          )}
          aria-label="Cuộn xuống tin nhắn mới nhất"
        >
          <ArrowDown className="h-3.5 w-3.5" />
          Tin nhắn mới nhất
        </button>
      )}
    </div>
  );
}
