import { getSession } from 'next-auth/react';
import { env } from './env';
import { ApiError } from './api';
import type { ChatMode } from '@law-ai/shared';

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
  mode: ChatMode;
}

export interface StreamDone {
  messageId: string;
}

export interface StreamError {
  message: string;
}

/**
 * Tool call surfaced by the deep-mode agent during streaming. The FE
 * uses this to show a "Đang tra cứu..." indicator above the placeholder
 * bubble while the agent is iterating.
 */
export interface StreamToolCall {
  tool: string;
  args: Record<string, unknown>;
}

/**
 * Where the answer came from.
 *  - `rag` = grounded in uploaded documents (fast + deep modes)
 *  - `general` = LLM fallback when no document matched
 *  - `lookup` = citation-only mode (no LLM-generated prose)
 *  - `rag_warning` = deep mode hit the iteration cap
 */
export type AnswerSource = 'rag' | 'general' | 'lookup' | 'rag_warning';

export interface StreamMeta {
  kind: AnswerSource;
  /** Set when kind === 'lookup' — number of chunks returned. */
  count?: number;
  /** Set when kind === 'lookup' — the original user query echoed back. */
  query?: string;
  /** Set when kind === 'rag_warning' — true if agent loop hit max iterations. */
  maxIterationsHit?: boolean;
}

export interface StreamHandlers {
  onStart?: (p: StreamStart) => void;
  onSources?: (p: { sources: StreamSource[] }) => void;
  /** Lookup-mode per-chunk citation. Distinct from `onSources` (which
   *  fires once with the full list) so the FE can render chunks as
   *  they arrive. */
  onSource?: (p: StreamSource) => void;
  /** Deep-mode tool call (e.g. rag_search, lookup_article). */
  onToolCall?: (p: StreamToolCall) => void;
  onMeta?: (p: StreamMeta) => void;
  onDelta?: (p: { content: string }) => void;
  onDone?: (p: StreamDone) => void;
  onError?: (p: StreamError) => void;
}

export interface StreamSendInput {
  content: string;
  conversationId?: string;
  bucketName?: string;
  /** Chat mode — drives BE dispatcher. Default 'fast' is omitted from
   *  the request body to keep wire format minimal for the common case. */
  mode?: ChatMode;
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

  const session = (await getSession()) as { accessToken?: string } | null;
  const token = session?.accessToken;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  // Only send `mode` when it's not the default — keeps the wire format
  // minimal for the common case (existing clients default to 'fast').
  const body: Record<string, unknown> = {
    content: input.content,
  };
  if (input.conversationId) body.conversationId = input.conversationId;
  if (input.bucketName) body.bucketName = input.bucketName;
  if (input.mode && input.mode !== 'fast') body.mode = input.mode;

  const res = await fetch(`${env.apiUrl}/api/v1/chat/messages/stream`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: ac.signal,
  });

  if (!res.ok || !res.body) {
    let detail = res.statusText;
    let code: string | undefined;
    try {
      const errBody = await res.json();
      detail = errBody?.message ?? detail;
      code = typeof errBody?.error === 'string' ? errBody.error : undefined;
    } catch {
      /* ignore */
    }
    // Surface the server-sent Retry-After hint so the UI can show a
    // countdown. ThrottlerException defaults to HTTP-date format too;
    // the guard coerces it to seconds, but fall back to 60s defensively.
    const retryAfterHeader = res.headers.get('retry-after');
    const retryAfter = retryAfterHeader ? Number(retryAfterHeader) : NaN;
    throw new ApiError(
      res.status,
      detail,
      undefined,
      Number.isFinite(retryAfter) ? retryAfter : 60,
      code,
    );
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
    case 'source':
      handlers.onSource?.(payload as StreamSource);
      break;
    case 'tool_call':
      handlers.onToolCall?.(payload as StreamToolCall);
      break;
    case 'meta':
      handlers.onMeta?.(payload as StreamMeta);
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
