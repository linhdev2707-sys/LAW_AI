'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ChatShell } from '@/components/chat/chat-shell';
import { MessageList } from '@/components/chat/message-list';
import { ChatInput } from '@/components/chat/chat-input';
import { EmptyState } from '@/components/chat/empty-state';
import { useConversationStream } from '@/hooks/use-conversation-stream';

export default function ChatConversationPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const search = useSearchParams();
  const id = params?.id;
  const {
    conversationId,
    messages,
    sources,
    streaming,
    error,
    load,
    send,
    stop,
  } = useConversationStream();
  const [refreshKey, setRefreshKey] = useState(0);
  // Track the last id we auto-sent a `?q=` prompt for, so re-renders / Strict
  // Mode double-invokes don't fire the prompt twice.
  const autoSentRef = useRef<string | null>(null);

  // Reload history when the URL id changes.
  useEffect(() => {
    if (id) void load(id);
  }, [id, load]);

  // Bump sidebar refresh when message count changes.
  useEffect(() => {
    if (messages.length) setRefreshKey((k) => k + 1);
  }, [messages.length]);

  // If we landed here via the suggestion flow (redirected from /chat with
  // `?q=<prompt>`), wait for the conversation to finish loading, then auto-send
  // the prompt and strip the query so a refresh doesn't re-fire it.
  useEffect(() => {
    if (!id) return;
    const prompt = search.get('q');
    if (!prompt) return;
    if (autoSentRef.current === id) return; // already handled this id
    if (streaming) return; // wait for any current stream
    if (!conversationId) return; // and to actually exist
    // Mark BEFORE calling send() so a second Strict Mode invocation (or any
    // re-entry in the same microtask) short-circuits on the guard above.
    autoSentRef.current = id;
    void send(prompt);
    // Strip ?q= so a hard refresh doesn't re-send.
    router.replace(`/chat/${id}`);
  }, [id, search, conversationId, streaming, send, router]);

  function handleSend(content: string) {
    void send(content);
  }

  // Not-found state: show inline message + back link
  const notFound = error && /not found|404/i.test(error);

  return (
    <ChatShell refreshKey={refreshKey}>
      {notFound ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center text-slate-300">
          <p className="text-lg">Không tìm thấy cuộc trò chuyện.</p>
          <button
            type="button"
            onClick={() => router.push('/chat')}
            className="rounded-md border border-white/20 px-4 py-2 text-sm transition hover:bg-white/5"
          >
            Quay lại danh sách trò chuyện
          </button>
        </div>
      ) : (
        <>
          {error && !notFound && (
            <div className="border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">
              {error}
            </div>
          )}

          {messages.length === 0 && !streaming ? (
            <div className="flex flex-1 flex-col">
              <div className="flex-1">
                <EmptyState onSelect={(t) => handleSend(t)} />
              </div>
            </div>
          ) : (
            <MessageList
              messages={messages}
              sources={sources}
              loading={streaming}
            />
          )}

          <ChatInput
            onSend={handleSend}
            onStop={stop}
            disabled={false}
            loading={streaming}
            placeholder="Nhắn cho LAW AI…"
          />
        </>
      )}
    </ChatShell>
  );
}
