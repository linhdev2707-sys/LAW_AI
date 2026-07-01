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


export default function ChatIndexPage() {
  const router = useRouter();
  const { conversationId, send, streaming, stop, messages, sources, error, rateLimit } =
    useChatStream();
  const navigatedRef = useRef(false);

  const [mode, setMode] = useState<ChatMode>('fast');
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(MODE_STORAGE_KEY);
      if (isChatMode(stored)) setMode(stored);
    } catch {
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
      if (typeof window !== 'undefined') {
        try {
          window.history.replaceState(
            window.history.state,
            '',
            `/chat/${conversationId}`,
          );
        } catch {
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
      {error && (
        <div className="border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      {messages.length === 0 ? (
        <div className="flex flex-1 flex-col">
          <div className="flex-1">
            <EmptyState onSelect={handleSelect} />
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
        onSend={handleSelect}
        onStop={stop}
        disabled={false}
        loading={streaming}
        placeholder="Nhắn cho iLaw…"
        rateLimit={rateLimit}
        mode={mode}
        onModeChange={setMode}
      />
    </ChatShell>
  );
}