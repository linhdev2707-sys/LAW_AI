'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChatShell } from '@/components/chat/chat-shell';
import { MessageList } from '@/components/chat/message-list';
import { ChatInput } from '@/components/chat/chat-input';
import { EmptyState } from '@/components/chat/empty-state';
import { useConversation } from '@/hooks/use-conversation';
import { Loader2 } from 'lucide-react';

export default function ChatConversationPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;
  const { conversation, loading, sending, error, load, send } = useConversation(id);
  const [refreshKey, setRefreshKey] = useState(0);

  // Reload when id changes
  useEffect(() => {
    if (id) void load(id);
  }, [id, load]);

  // Bump sidebar refresh after each new message lands
  useEffect(() => {
    if (conversation?.messages.length) setRefreshKey((k) => k + 1);
  }, [conversation?.messages.length]);

  function handleSend(content: string) {
    void send(content);
  }

  // Not-found state: show inline message + back link
  const notFound = error && /not found|404/i.test(error);

  return (
    <ChatShell refreshKey={refreshKey}>
      {notFound ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center text-slate-300">
          <p className="text-lg">Conversation not found.</p>
          <button
            type="button"
            onClick={() => router.push('/chat')}
            className="rounded-md border border-white/20 px-4 py-2 text-sm transition hover:bg-white/5"
          >
            Back to chats
          </button>
        </div>
      ) : (
        <>
          {error && !notFound && (
            <div className="border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">
              {error}
            </div>
          )}

          {loading && !conversation ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : (
            <>
              {conversation && conversation.messages.length > 0 ? (
                <MessageList messages={conversation.messages} loading={sending} />
              ) : (
                <div className="flex flex-1 flex-col">
                  <div className="flex-1">
                    <EmptyState onSelect={(t) => handleSend(t)} />
                  </div>
                </div>
              )}

              <ChatInput
                onSend={handleSend}
                disabled={loading}
                loading={sending}
                placeholder="Message LAW AI…"
              />
            </>
          )}
        </>
      )}
    </ChatShell>
  );
}
