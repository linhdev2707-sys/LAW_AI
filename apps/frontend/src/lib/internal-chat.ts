import { env } from './env';
import { ApiError } from './api';

/**
 * Public (no-auth) chat used by the homepage floating chatbox.
 * Backed by `/api/v1/internal/chat/messages/stream` which streams a reply
 * straight from the LLM without persisting anything to the database.
 *
 * Mirrors the SSE event protocol of the authenticated chat:
 *   event: start     data: { messageId }
 *   event: delta     data: { content: string }   // repeated
 *   event: done      data: { messageId }
 *   event: error     data: { message }
 *   data: [DONE]                                 // terminator
 */

export interface InternalHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface InternalStreamHandlers {
  onStart?: (p: { messageId: string }) => void;
  onDelta?: (p: { content: string }) => void;
  onDone?: (p: { messageId: string }) => void;
  onError?: (p: { message: string }) => void;
}

export interface InternalStreamInput {
  content: string;
  /** Tối đa 6 lượt gần nhất để giữ ngữ cảnh. */
  history?: InternalHistoryMessage[];
}

export async function streamInternalChatMessage(
  input: InternalStreamInput,
  handlers: InternalStreamHandlers,
): Promise<AbortController> {
  const ac = new AbortController();

  const res = await fetch(`${env.apiUrl}/api/v1/internal/chat/messages/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({
      content: input.content,
      history: input.history ?? [],
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

  void parseSse(res.body, handlers, ac.signal);
  return ac;
}

async function parseSse(
  body: ReadableStream<Uint8Array>,
  handlers: InternalStreamHandlers,
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
      console.error('Internal SSE parse error:', e);
    }
  }
}

function handleFrame(raw: string, handlers: InternalStreamHandlers): void {
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
  if (data === '[DONE]') return;
  let payload: unknown;
  try {
    payload = JSON.parse(data);
  } catch {
    return;
  }
  switch (event) {
    case 'start':
      handlers.onStart?.(payload as { messageId: string });
      break;
    case 'delta':
      handlers.onDelta?.(payload as { content: string });
      break;
    case 'done':
      handlers.onDone?.(payload as { messageId: string });
      break;
    case 'error':
      handlers.onError?.(payload as { message: string });
      break;
  }
}
