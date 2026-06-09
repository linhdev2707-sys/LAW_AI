'use client';

import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { chatApi, type IMessage } from '@/lib/chat';
import {
  streamChatMessage,
  type StreamSource,
} from '@/lib/chat-stream';

/**
 * Streaming variant of `useConversation`.
 *
 * - On `send(content)`, the user's message is appended optimistically
 *   plus a placeholder assistant message, then the SSE stream is
 *   connected. Deltas are appended to the assistant message in-place.
 * - Sources surfaced by the RAG retriever are stored separately in
 *   `sources: Record<messageId, StreamSource[]>` and rendered below the
 *   assistant bubble via `MessageList` → `MessageBubble` → `SourcesRow`.
 * - `stop()` aborts the in-flight stream (closes the fetch + the
 *   server's upstream call).
 * - History reload via `load(id)` reuses the non-streaming
 *   `chatApi.get` endpoint.
 */
export function useConversationStream() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [sources, setSources] = useState<Record<string, StreamSource[]>>({});
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const acRef = useRef<AbortController | null>(null);

  const load = useCallback(async (id: string) => {
    setError(null);
    try {
      const conv = await chatApi.get(id);
      setConversationId(id);
      setMessages(conv.messages);
      // Sources aren't persisted server-side in MVP; clear on reload.
      setSources({});
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load';
      setError(message);
      throw e;
    }
  }, []);

  const stop = useCallback(() => {
    acRef.current?.abort();
    acRef.current = null;
    setStreaming(false);
  }, []);

  const send = useCallback(
    async (content: string) => {
      if (streaming) return null;
      setError(null);
      setStreaming(true);

      const optimisticUser: IMessage = {
        id: `tmp-u-${Date.now()}`,
        role: 'user',
        content,
        createdAt: new Date().toISOString(),
      };
      const assistantId = `tmp-a-${Date.now()}`;
      const assistantPlaceholder: IMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimisticUser, assistantPlaceholder]);

      try {
        const ac = await streamChatMessage(
          { content, conversationId: conversationId ?? undefined },
          {
            onStart: ({ conversationId: cid }) => {
              setConversationId(cid);
            },
            onSources: ({ sources: s }) => {
              setSources((cur) => ({ ...cur, [assistantId]: s }));
            },
            onDelta: ({ content: chunk }) => {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: m.content + chunk }
                    : m,
                ),
              );
            },
            onDone: () => {
              acRef.current = null;
              setStreaming(false);
            },
            onError: ({ message }) => {
              setError(message);
              toast.error('Lỗi khi trả lời', { description: message });
              // Roll back the placeholder assistant; keep the user message
              setMessages((prev) => prev.filter((m) => m.id !== assistantId));
              acRef.current = null;
              setStreaming(false);
            },
          },
        );
        acRef.current = ac;
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to send';
        setError(message);
        // Roll back the optimistic user message + placeholder
        setMessages((prev) =>
          prev.filter(
            (m) => m.id !== assistantId && m.id !== optimisticUser.id,
          ),
        );
        toast.error('Gửi tin nhắn thất bại', { description: message });
        setStreaming(false);
        return null;
      }
    },
    [conversationId, streaming],
  );

  return {
    conversationId,
    messages,
    sources,
    streaming,
    error,
    load,
    send,
    stop,
  };
}
