'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowDown, Sparkles } from 'lucide-react';
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

const THINKING_PHRASES = [
  'Đang tra cứu văn bản pháp luật…',
  'Đang phân tích tình huống của bạn…',
  'Đang soạn câu trả lời…',
  'Đang tham chiếu tiền lệ…',
];

export function MessageList({ messages, sources, loading }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [thinkingIdx, setThinkingIdx] = useState(0);

  // Rotate the "thinking" phrase every 1.6s while loading so it feels alive.
  useEffect(() => {
    if (!loading) {
      setThinkingIdx(0);
      return;
    }
    const t = setInterval(() => {
      setThinkingIdx((i) => (i + 1) % THINKING_PHRASES.length);
    }, 1600);
    return () => clearInterval(t);
  }, [loading]);

  // Auto-scroll to bottom only if the user hasn't scrolled up.
  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages.length, loading, autoScroll]);

  // Detect manual scroll: if user scrolls up, disable auto-scroll; if they
  // scroll back to the bottom, re-enable it.
  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setAutoScroll(distanceFromBottom < 80);
  }

  return (
    <div ref={scrollRef} onScroll={onScroll} className="relative flex-1 overflow-y-auto bg-brand-background">
      {messages.length === 0 && !loading ? (
        <div className="flex h-full items-center justify-center px-4 py-20 text-center text-brand-on-surface-variant">
          <p>Bắt đầu cuộc trò chuyện bằng cách gửi tin nhắn bên dưới.</p>
        </div>
      ) : (
        <div className="space-y-6 py-8 pb-32">
          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              sources={m.role === 'assistant' ? sources?.[m.id] : undefined}
            />
          ))}

          {loading && (
            <div className="border-y border-brand-outline-variant/5 bg-gradient-to-b from-brand-surface-container-high/40 to-brand-surface-container-high/10">
              <div className="mx-auto flex max-w-3xl gap-3 px-4 py-6 md:px-6">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-primary to-brand-tertiary text-white shadow-md shadow-brand-tertiary/20">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="flex flex-col gap-1.5 py-1">
                  <span className="text-sm font-semibold text-brand-on-surface">LAW AI</span>
                  <div className="flex items-center gap-2 text-sm text-brand-on-surface-variant">
                    <TypingDots />
                    <span key={thinkingIdx} className="animate-in fade-in slide-in-from-bottom-1 duration-300">
                      {THINKING_PHRASES[thinkingIdx]}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      )}

      {/* Floating "jump to latest" pill — shown when user has scrolled up */}
      {!autoScroll && (
        <button
          type="button"
          onClick={() => {
            setAutoScroll(true);
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
          }}
          className={cn(
            'absolute bottom-4 left-1/2 -translate-x-1/2',
            'flex items-center gap-1.5 rounded-full border border-brand-tertiary/40',
            'bg-brand-surface-container/90 px-3 py-1.5 text-xs font-medium text-brand-on-surface',
            'shadow-lg shadow-black/40 backdrop-blur transition-all',
            'hover:border-brand-tertiary/70 hover:bg-brand-tertiary/15',
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

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden>
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-tertiary [animation-delay:0ms]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-tertiary [animation-delay:150ms]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-tertiary [animation-delay:300ms]" />
    </span>
  );
}
