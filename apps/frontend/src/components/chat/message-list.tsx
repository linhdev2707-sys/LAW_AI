'use client';

import { useEffect, useRef } from 'react';
import type { IMessage } from '@/lib/chat';
import { MessageBubble } from './message-bubble';
import { Loader2 } from 'lucide-react';

interface MessageListProps {
  messages: IMessage[];
  loading?: boolean;
}

export function MessageList({ messages, loading }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, loading]);

  return (
    <div className="flex-1 overflow-y-auto bg-brand-background">
      {messages.length === 0 && !loading ? (
        <div className="flex h-full items-center justify-center px-4 py-20 text-center text-brand-on-surface-variant">
          <p>Start a conversation by sending a message below.</p>
        </div>
      ) : (
        <div className="pb-32">
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
          {loading && (
            <div className="bg-brand-surface-container-high/50 border-y border-brand-outline-variant/5">
              <div className="mx-auto flex max-w-3xl gap-3 px-4 py-6 md:px-6">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-gradient-to-br from-brand-primary to-brand-tertiary">
                  <BotIcon />
                </div>
                <div className="flex items-center gap-2 text-sm text-brand-on-surface-variant">
                  <Loader2 className="h-4 w-4 animate-spin text-brand-tertiary" />
                  <span>LAW AI is thinking…</span>
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}

function BotIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 text-white"
    >
      <path d="M12 8V4H8" />
      <rect width="16" height="12" x="4" y="8" rx="2" />
      <path d="M2 14h2" />
      <path d="M20 14h2" />
      <path d="M15 13v2" />
      <path d="M9 13v2" />
    </svg>
  );
}
