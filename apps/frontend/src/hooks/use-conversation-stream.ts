'use client';

import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { chatApi, type IMessage } from '@/lib/chat';
import {
  streamChatMessage,
  type StreamSource,
} from '@/lib/chat-stream';
import { ApiError } from '@/lib/api';
import { useRateLimit } from './use-rate-limit';

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
  const rateLimit = useRateLimit();
  const acRef = useRef<AbortController | null>(null);
  // Synchronous re-entrance guard. The React `streaming` state lags by one
  // render, so a second `send()` call landing in the same microtask (e.g.
  // Strict Mode double-invoke of an effect, or a fast double-click on a
  // suggestion button) would otherwise pass the `if (streaming) return` check
  // and append the optimistic user message twice. This ref flips
  // synchronously, so the second call short-circuits immediately.
  const inFlightRef = useRef(false);

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
    inFlightRef.current = false;
    setStreaming(false);
  }, []);

  const send = useCallback(
    async (content: string) => {
      // Synchronous guard — see comment on `inFlightRef`.
      if (inFlightRef.current) return null;
      if (streaming) return null;
      inFlightRef.current = true;
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
            onMeta: ({ kind }) => {
              // Stamp the assistant placeholder with where this answer
              // came from so `MessageBubble` can render the right badge.
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, answerSource: kind } : m,
                ),
              );
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
              inFlightRef.current = false;
              setStreaming(false);
            },
            onError: ({ message }) => {
              setError(message);
              toast.error('Lỗi khi trả lời', { description: message });
              // Roll back the placeholder assistant; keep the user message
              setMessages((prev) => prev.filter((m) => m.id !== assistantId));
              acRef.current = null;
              inFlightRef.current = false;
              setStreaming(false);
            },
          },
        );
        acRef.current = ac;
      } catch (e) {
        const isApiError = e instanceof ApiError;
        const message = e instanceof Error ? e.message : 'Failed to send';
        setError(message);

        // Roll back the optimistic user message + placeholder
        setMessages((prev) =>
          prev.filter(
            (m) => m.id !== assistantId && m.id !== optimisticUser.id,
          ),
        );

        // 429 — surface a soft ban so the UI can disable the input and
        // show a countdown. Don't double-toast: the countdown banner is
        // enough signal.
        if (isApiError && e.status === 429) {
          const wait = e.retryAfter ?? 60;
          rateLimit.trigger(wait);
        } else {
          toast.error('Gửi tin nhắn thất bại', { description: message });
        }

        inFlightRef.current = false;
        setStreaming(false);
        return null;
      }
    },
    [conversationId, streaming, rateLimit],
  );

  return {
    conversationId,
    messages,
    sources,
    streaming,
    error,
    load,
    rateLimit,
    send,
    stop,
  };
}
