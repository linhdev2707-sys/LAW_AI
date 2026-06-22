'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { toast } from 'sonner';
import { chatApi, type IMessage } from '@/lib/chat';
import {
  streamChatMessage,
  type StreamSource,
} from '@/lib/chat-stream';
import { ApiError } from '@/lib/api';
import { useRateLimit } from './use-rate-limit';
import type { ChatMode } from '@law-ai/shared';

/**
 * ChatStreamProvider
 *
 * Why this exists: Next.js App Router mounts a fresh React tree for
 * every page. When the user sends their first message on `/chat` we
 * optimistically append a user message + assistant placeholder, then
 * `router.replace('/chat/<new-id>')` runs as soon as the server returns
 * a `start` SSE event. That navigation unmounts the original page
 * and remounts `/chat/[id]`, which would normally create a brand-new
 * hook instance — losing the optimistic messages AND the in-flight
 * SSE stream (the controller's promise to keep the stream open is
 * moot once React stops reading from it; the OS file descriptor on
 * the fetch may also be released).
 *
 * The fix is to lift the stream state into a single React context
 * that lives at the `/chat` layout level. The layout is shared
 * between `/chat` and `/chat/[id]`, so navigation between the two
 * pages does NOT remount the provider. The same hook instance (and
 * its messages, in-flight stream, abort controller) is reused.
 *
 * Reload still works correctly: a hard reload mounts a fresh provider
 * instance, which then `load(id)`-fetches the conversation from the
 * server so nothing is lost.
 */

export interface IChatStream {
  conversationId: string | null;
  messages: IMessage[];
  sources: Record<string, StreamSource[]>;
  streaming: boolean;
  error: string | null;
  rateLimit: ReturnType<typeof useRateLimit>;
  send: (content: string, mode?: ChatMode) => Promise<unknown>;
  stop: () => void;
  load: (id: string) => Promise<void>;
  reset: () => void;
}

const ChatStreamContext = createContext<IChatStream | null>(null);

export function ChatStreamProvider({ children }: { children: ReactNode }) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [sources, setSources] = useState<Record<string, StreamSource[]>>({});
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rateLimit = useRateLimit();
  const acRef = useRef<AbortController | null>(null);
  const inFlightRef = useRef(false);

  const load = useCallback(async (id: string) => {
    setError(null);
    try {
      const conv = await chatApi.get(id);
      setConversationId(id);
      setMessages(conv.messages);
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

  const reset = useCallback(() => {
    stop();
    setConversationId(null);
    setMessages([]);
    setSources({});
    setError(null);
  }, [stop]);

  const send = useCallback(
    async (content: string, mode: ChatMode = 'fast') => {
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
        mode,
      };
      setMessages((prev) => [...prev, optimisticUser, assistantPlaceholder]);

      try {
        const ac = await streamChatMessage(
          { content, conversationId: conversationId ?? undefined, mode },
          {
            onStart: ({ conversationId: cid, mode: startedMode }) => {
              setConversationId(cid);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, mode: startedMode } : m,
                ),
              );
            },
            onSources: ({ sources: s }) => {
              setSources((cur) => ({ ...cur, [assistantId]: s }));
            },
            onSource: (chunk) => {
              setSources((cur) => ({
                ...cur,
                [assistantId]: [...(cur[assistantId] ?? []), chunk],
              }));
            },
            onToolCall: ({ tool, args }) => {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, pendingToolCall: { tool, args } }
                    : m,
                ),
              );
            },
            onMeta: ({ kind }) => {
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
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, pendingToolCall: undefined }
                    : m,
                ),
              );
              acRef.current = null;
              inFlightRef.current = false;
              setStreaming(false);
            },
            onError: ({ message }) => {
              setError(message);
              toast.error('Lỗi khi trả lời', { description: message });
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
        setMessages((prev) =>
          prev.filter(
            (m) => m.id !== assistantId && m.id !== optimisticUser.id,
          ),
        );
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

  const value = useMemo<IChatStream>(
    () => ({
      conversationId,
      messages,
      sources,
      streaming,
      error,
      rateLimit,
      send,
      stop,
      load,
      reset,
    }),
    [conversationId, messages, sources, streaming, error, rateLimit, send, stop, load, reset],
  );

  return (
    <ChatStreamContext.Provider value={value}>
      {children}
    </ChatStreamContext.Provider>
  );
}

export function useChatStream(): IChatStream {
  const ctx = useContext(ChatStreamContext);
  if (!ctx) {
    throw new Error(
      'useChatStream must be used within a ChatStreamProvider. ' +
        'Wrap the /chat route in <ChatStreamProvider> in app/(protected)/chat/layout.tsx.',
    );
  }
  return ctx;
}
