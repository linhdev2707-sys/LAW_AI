'use client';

import { useEffect, useRef } from 'react';
import { ChatShell } from '@/components/chat/chat-shell';
import { EmptyState } from '@/components/chat/empty-state';
import { ChatInput } from '@/components/chat/chat-input';
import { useConversationStream } from '@/hooks/use-conversation-stream';
import { useRouter } from 'next/navigation';

/**
 * The chat index page renders the chat-ready view (greeting + suggestions +
 * input box) directly. It does NOT pre-create a conversation; the first
 * `send()` call uses `conversationId: undefined` and the backend creates one
 * server-side. Once we have an id, we navigate to /chat/[id] so the URL is
 * stable and refreshable.
 */
export default function ChatIndexPage() {
  const router = useRouter();
  const { conversationId, send, streaming, messages, error, rateLimit } =
    useConversationStream();
  // Track if WE triggered the navigation, so the effect doesn't fight
  // Strict Mode double-invokes.
  const navigatedRef = useRef(false);

  useEffect(() => {
    if (conversationId && !navigatedRef.current) {
      navigatedRef.current = true;
      router.replace(`/chat/${conversationId}`);
    }
  }, [conversationId, router]);

  function handleSelect(prompt: string) {
    void send(prompt);
  }

  return (
    <ChatShell>
      <div className="flex flex-1 flex-col">
        {error && (
          <div className="border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="flex-1">
          {messages.length === 0 ? (
            <EmptyState onSelect={handleSelect} />
          ) : (
            <div className="flex items-center justify-center px-4 py-10 text-sm text-brand-on-surface-variant">
              Đang mở cuộc trò chuyện…
            </div>
          )}
        </div>

        <ChatInput
          onSend={handleSelect}
          onStop={() => {
            /* no-op on the index page */
          }}
          disabled={false}
          loading={streaming}
          placeholder="Nhắn cho iLaw…"
          rateLimit={rateLimit}
        />
      </div>
    </ChatShell>
  );
}
