import { getSession } from 'next-auth/react';
import { env } from './env';
import { ApiError } from './api';

/** A single citation surfaced by the RAG retriever. */
export interface StreamSource {
  index: number;
  name: string;
  snippet: string;
  /** Full chunk text — useful for "show context" UI later. */
  content: string;
}

export interface StreamStart {
  conversationId: string;
  userMessageId: string;
}

export interface StreamDone {
  messageId: string;
}

export interface StreamError {
  message: string;
}

export interface StreamHandlers {
  onStart?: (p: StreamStart) => void;
  onSources?: (p: { sources: StreamSource[] }) => void;
  onDelta?: (p: { content: string }) => void;
  onDone?: (p: StreamDone) => void;
  onError?: (p: StreamError) => void;
}

export interface StreamSendInput {
  content: string;
  conversationId?: string;
  bucketName?: string;
}

/**
 * Open a streaming POST to `/api/v1/chat/messages/stream` and pipe SSE
 * events to the supplied handlers. Returns an `AbortController` so the
 * caller can stop generation by calling `.abort()` (used by the Stop
 * button in `ChatInput`).
 *
 * The response is parsed with native `ReadableStream` + `TextDecoder` —
 * no `EventSource` because we need POST + a custom Authorization header.
 */
export async function streamChatMessage(
  input: StreamSendInput,
  handlers: StreamHandlers,
): Promise<AbortController> {
  const ac = new AbortController();

  const session = (await getSession()) as
    | { accessToken?: string }
    | null;
  const token = session?.accessToken;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${env.apiUrl}/api/v1/chat/messages/stream`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      content: input.content,
      ...(input.conversationId
        ? { conversationId: input.conversationId }
        : {}),
      ...(input.bucketName
        ? { bucketName: input.bucketName }
        : {}),
    }),
    signal: ac.signal,
  });

  if (!res.ok || !res.body) {
    let detail = res.statusText;
    try {
      const errBody = await res.json();
      detail = errBody?.message ?? detail;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, detail);
  }

  // Fire-and-forget parse loop. Surface abort/disconnect by just exiting.
  void parseSse(res.body, handlers, ac.signal);

  return ac;
}

async function parseSse(
  body: ReadableStream<Uint8Array>,
  handlers: StreamHandlers,
  signal: AbortSignal,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      if (signal.aborted) return;
      const { value, done } = await reader.read();
      if (done) return;
      buffer += decoder.decode(value, { stream: true });

      // Split on the SSE frame separator (\n\n). Each frame is a block of
      // `event:` and `data:` lines followed by a blank line.
      let sep: number;
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const raw = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        handleFrame(raw, handlers);
      }
    }
  } catch (e) {
    if (!signal.aborted) {
      // eslint-disable-next-line no-console
      console.error('SSE parse error:', e);
    }
  }
}

function handleFrame(raw: string, handlers: StreamHandlers): void {
  let event = 'message';
  let data = '';
  for (const line of raw.split('\n')) {
    if (line.startsWith('event: ')) {
      event = line.slice(7).trim();
    } else if (line.startsWith('data: ')) {
      data = line.slice(6);
    }
  }
  if (!data) return;
  if (data === '[DONE]') {
    handlers.onDone?.({ messageId: '' });
    return;
  }
  let payload: unknown;
  try {
    payload = JSON.parse(data);
  } catch {
    return;
  }
  switch (event) {
    case 'start':
      handlers.onStart?.(payload as StreamStart);
      break;
    case 'sources':
      handlers.onSources?.(payload as { sources: StreamSource[] });
      break;
    case 'delta':
      handlers.onDelta?.(payload as { content: string });
      break;
    case 'done':
      handlers.onDone?.(payload as StreamDone);
      break;
    case 'error':
      handlers.onError?.(payload as StreamError);
      break;
    default:
      // unknown event — ignore
      break;
  }
}
