'use client';

import { useEffect, useRef, useState } from 'react';
import { ChatShell } from '@/components/chat/chat-shell';
import { EmptyState } from '@/components/chat/empty-state';
import { ChatInput } from '@/components/chat/chat-input';
import { MessageList } from '@/components/chat/message-list';
import { useChatStream } from '@/hooks/chat-stream-context';
import { useRouter } from 'next/navigation';
import { isChatMode, type ChatMode } from '@law-ai/shared';

const MODE_STORAGE_KEY = 'chat:mode';

/**
 * The chat index page renders the chat-ready view (greeting + suggestions +
 * input box) directly. It does NOT pre-create a conversation; the first
 * `send()` call uses `conversationId: undefined` and the backend creates one
 * server-side. Once we have an id, we navigate to /chat/[id] so the URL is
 * stable and refreshable.
 */
export default function ChatIndexPage() {
  const router = useRouter();
  const { conversationId, send, streaming, stop, messages, sources, error, rateLimit } =
    useChatStream();
  // Track if WE triggered the navigation, so the effect doesn't fight
  // Strict Mode double-invokes.
  const navigatedRef = useRef(false);

  /**
   * Mode picker state — mirror of the page-level chat/[id] page so the
   * user's last selection is consistent across the index and a
   * specific conversation. Persisted to localStorage.
   */
  const [mode, setMode] = useState<ChatMode>('fast');
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(MODE_STORAGE_KEY);
      if (isChatMode(stored)) setMode(stored);
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem(MODE_STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
  }, [mode]);

  useEffect(() => {
    if (conversationId && !navigatedRef.current) {
      navigatedRef.current = true;
      // Use window.history.replaceState instead of router.replace to
      // update the URL WITHOUT triggering a Next.js navigation. A
      // navigation here would cause App Router to swap the `ChatIndexPage`
      // tree for `ChatConversationPage`, and even though the `ChatStreamProvider`
      // is mounted in the shared layout, the `useChatStream` consumers
      // (the page components themselves) re-subscribe and the in-flight
      // SSE stream + optimistic messages can be torn down on the first
      // delta event. Direct history mutation is a workaround: it
      // updates the address bar (so the URL is stable and refreshable)
      // without React re-rendering the page tree.
      if (typeof window !== 'undefined') {
        try {
          window.history.replaceState(
            window.history.state,
            '',
            `/chat/${conversationId}`,
          );
        } catch {
          /* SSR or restricted env — fall back to router.replace */
          router.replace(`/chat/${conversationId}`);
        }
      }
    }
  }, [conversationId, router]);

  function handleSelect(prompt: string) {
    void send(prompt, mode);
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
            <MessageList
              messages={messages}
              sources={sources}
              loading={streaming}
            />
          )}
        </div>

        <ChatInput
          onSend={handleSelect}
          onStop={stop}
          disabled={false}
          loading={streaming}
          placeholder="Nhắn cho iLaw…"
          rateLimit={rateLimit}
          mode={mode}
          onModeChange={setMode}
        />
      </div>
    </ChatShell>
  );
}