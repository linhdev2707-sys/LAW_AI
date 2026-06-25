/** Subset of the OpenAI chat-completion types we use. */

export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

export interface IChatMessage {
  role: ChatRole;
  content: string;
  /** When role === 'assistant' and the model decided to call a tool. */
  tool_calls?: IToolCall[];
  /** Required when role === 'tool': the tool function name this message
   *  is the observation for. */
  name?: string;
}

export interface IStreamDelta {
  /** A small chunk of generated text (may be empty for finish_reason-only frames). */
  content: string;
  /** When present, indicates the upstream is done with this turn. */
  finishReason?: 'stop' | 'length' | 'content_filter' | 'tool_calls' | 'function_call' | null;
}

/**
 * JSON-Schema-like tool definition accepted by the OpenAI/DeepSeek
 * `tools` parameter. We type it loosely (`Record<string, unknown>` for
 * the schema) because the SDK only forwards it.
 */
export interface IToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    /** JSON Schema object. Pass-through; not validated here. */
    parameters: Record<string, unknown>;
  };
}

/** A single tool call inside an assistant message. */
export interface IToolCall {
  /** Stable id from the upstream (`call_xxx`). Echoed back in tool
   *  observations. */
  id: string;
  /** Tool function name. */
  type: 'function';
  function: {
    name: string;
    /** JSON-encoded arguments. May arrive as an empty string in early
     *  deltas — consumers must tolerate that and only parse when the
     *  delta includes the closing brace. */
    arguments: string;
  };
}

/**
 * A single streaming chunk from a tool-enabled chat completion.
 * Differs from IStreamDelta in that it surfaces `tool_calls` deltas in
 * addition to (or instead of) text deltas. DeepSeek streams tool-call
 * arguments across multiple chunks; consumers must buffer them and
 * JSON.parse only when the chunk includes `finish_reason: 'tool_calls'`.
 */
export interface IToolStreamDelta {
  /** Plain-text delta. May be empty. */
  content: string;
  /** Incremental tool-call delta. Multiple chunks may share an `index`;
   *  consumers concatenate `arguments` strings by index, then JSON.parse
   *  each entry when the run completes. */
  toolCalls?: Array<{
    index: number;
    id?: string;
    name?: string;
    /** Partial JSON arguments. May be empty for early chunks. */
    arguments?: string;
  }>;
  /** When present, indicates the upstream finished this turn. */
  finishReason?: 'stop' | 'length' | 'content_filter' | 'tool_calls' | 'function_call' | null;
}
