import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { IChatMessage, IStreamDelta } from './interfaces/chat-completion.types';

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

    this.client = new OpenAI({
      apiKey,
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
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
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
}
