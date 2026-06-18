import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type {
  IChatMessage,
  IStreamDelta,
  IToolDefinition,
  IToolStreamDelta,
} from './interfaces/chat-completion.types';

/**
 * Thin wrapper around DeepSeek's chat-completion API (OpenAI-compatible).
 *
 * Exposes a single async generator that yields incremental text deltas.
 * The generator aborts cleanly when the caller's `AbortSignal` fires, so
 * the chat controller can hook `req.on('close')` to stop the upstream
 * call as soon as the client disconnects.
 */
@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly temperature: number;
  private readonly timeoutMs: number;

  constructor(config: ConfigService) {
    const apiKey = config.get<string>('app.deepseek.apiKey', '');
    const baseUrl = config.get<string>('app.deepseek.baseUrl', 'https://api.deepseek.com/v1');
    this.model = config.get<string>('app.deepseek.model', 'deepseek-chat');
    this.maxTokens = config.get<number>('app.deepseek.maxTokens', 2048);
    this.temperature = config.get<number>('app.deepseek.temperature', 0.3);
    this.timeoutMs = config.get<number>('app.deepseek.timeoutMs', 60000);

    if (!apiKey) {
      this.logger.warn(
        'DEEPSEEK_API_KEY is empty — LLM calls will fail at runtime. Set it in .env.',
      );
    }

    // Only pass `apiKey` when explicitly set — the OpenAI SDK treats an
    // empty string as "credentials were provided but invalid" and skips its
    // env-var fallback, so an unset key would otherwise throw at construction.
    this.client = new OpenAI({
      ...(apiKey ? { apiKey } : {}),
      baseURL: baseUrl,
      timeout: this.timeoutMs,
      maxRetries: 0,
    });
  }

  /**
   * Stream chat completions from DeepSeek. Yields one IStreamDelta per chunk.
   * Throws on transport / HTTP errors so the caller can surface an `error`
   * SSE event and stop the response.
   */
  async *streamChat(
    messages: IChatMessage[],
    opts: { signal?: AbortSignal } = {},
  ): AsyncGenerator<IStreamDelta, void, void> {
    if (!this.client) {
      throw new Error('DeepSeek client not initialised');
    }

    const stream = await this.client.chat.completions.create(
      {
        model: this.model,
        // Cast through unknown: IChatMessage's `tool` role requires a
        // `tool_call_id` that we don't always have at this layer, but
        // `streamChat` is only ever called with system/user/assistant
        // messages in practice (see PromptBuilder).
        messages: messages as unknown as OpenAI.ChatCompletionMessageParam[],
        stream: true,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
      },
      { signal: opts.signal },
    );

    for await (const chunk of stream) {
      if (opts.signal?.aborted) return;
      const choice = chunk.choices?.[0];
      if (!choice) continue;
      const content = choice.delta?.content ?? '';
      if (content) {
        yield { content };
      }
      if (choice.finish_reason) {
        yield { content: '', finishReason: choice.finish_reason };
      }
    }
  }

  /**
   * Get a full chat completion response (non-streaming).
   * Useful for internal LLM logic like classification or routing.
   */
  async getChatCompletion(
    messages: IChatMessage[],
    opts: { temperature?: number; maxTokens?: number } = {},
  ): Promise<string> {
    if (!this.client) {
      throw new Error('DeepSeek client not initialised');
    }

    const response = await this.client.chat.completions.create({
      model: this.model,
      // See note in streamChat: cast through unknown to satisfy the
      // SDK's discriminated-union for tool messages, which we don't
      // emit from this code path in practice.
      messages: messages as unknown as OpenAI.ChatCompletionMessageParam[],
      temperature: opts.temperature ?? 0.1,
      max_tokens: opts.maxTokens ?? 100,
    });

    return response.choices[0]?.message?.content ?? '';
  }

  /**
   * Stream a chat completion with tool-calling support. Yields both
   * text deltas and tool-call deltas. Tool-call arguments arrive as
   * partial JSON strings across multiple chunks; consumers should
   * buffer them by `toolCalls[].index` and JSON.parse once the
   * upstream signals `finish_reason: 'tool_calls'`.
   *
   * Used by the deep-mode `AgentService` to drive the function-calling
   * agent loop.
   */
  async *streamChatTools(
    messages: IChatMessage[],
    tools: IToolDefinition[],
    opts: { signal?: AbortSignal } = {},
  ): AsyncGenerator<IToolStreamDelta, void, void> {
    if (!this.client) {
      throw new Error('DeepSeek client not initialised');
    }

    const stream = await this.client.chat.completions.create(
      {
        model: this.model,
        // OpenAI SDK accepts tool_call messages but doesn't have a typed
        // helper; cast through `unknown` keeps the call site terse.
        messages: messages as unknown as OpenAI.ChatCompletionMessageParam[],
        tools: tools as unknown as OpenAI.ChatCompletionTool[],
        stream: true,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
      },
      { signal: opts.signal },
    );

    for await (const chunk of stream) {
      if (opts.signal?.aborted) return;
      const choice = chunk.choices?.[0];
      if (!choice) continue;

      const delta = choice.delta ?? {};
      const out: IToolStreamDelta = {
        content: delta.content ?? '',
      };

      // Surface tool_calls deltas when present. The SDK types these as
      // a partial shape that we re-emit in our own narrower type.
      if (Array.isArray(delta.tool_calls) && delta.tool_calls.length > 0) {
        out.toolCalls = delta.tool_calls.map((tc) => ({
          index: tc.index,
          id: tc.id,
          name: tc.function?.name,
          arguments: tc.function?.arguments,
        }));
      }

      if (choice.finish_reason) {
        out.finishReason = choice.finish_reason;
      }

      yield out;
    }
  }
}
