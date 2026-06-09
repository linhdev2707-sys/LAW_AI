/** Subset of the OpenAI chat-completion types we use. */

export type ChatRole = 'system' | 'user' | 'assistant';

export interface IChatMessage {
  role: ChatRole;
  content: string;
}

export interface IStreamDelta {
  /** A small chunk of generated text (may be empty for finish_reason-only frames). */
  content: string;
  /** When present, indicates the upstream is done with this turn. */
  finishReason?: 'stop' | 'length' | 'content_filter' | 'tool_calls' | 'function_call' | null;
}
