'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import type { IMessage } from '@/lib/chat';
import type { StreamSource } from '@/lib/chat-stream';
import { MessageBubble } from './message-bubble';

interface MessageListProps {
  messages: IMessage[];
  sources?: Record<string, StreamSource[]>;
  loading?: boolean;
}

const STICK_TO_BOTTOM_PX = 200;

export function MessageList({ messages, sources, loading }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !isAtBottom) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, loading, isAtBottom]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setIsAtBottom(distanceFromBottom <= STICK_TO_BOTTOM_PX);
  }

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className="relative flex-1 overflow-y-auto bg-brand-background"
    >
      {messages.length === 0 && !loading ? (
        <div className="flex h-full items-center justify-center px-4 py-20 text-center text-brand-on-surface-variant">
          <p>Bắt đầu cuộc trò chuyện bằng cách gửi tin nhắn bên dưới.</p>
        </div>
      ) : (
        <div className="space-y-10 py-10 pb-40">
          {messages.map((m) => {
            // Only the LAST assistant message is the live "streaming"
            // one — earlier ones are persisted. This is how we decide
            // whether to render the in-flight tool-call indicator.
            const isLiveAssistant =
              loading && m.role === 'assistant' && m === messages[messages.length - 1];
            return (
              <MessageBubble
                key={m.id}
                message={m}
                sources={m.role === 'assistant' ? sources?.[m.id] : undefined}
                loading={isLiveAssistant}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
