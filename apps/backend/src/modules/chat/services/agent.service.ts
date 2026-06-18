import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RetrieverService, type IScoredChunk } from '../../rag/retrieval/retriever.service';
import { ArticleRegexService } from './article-regex.service';
import { LlmService } from '../../llm/llm.service';
import { PromptBuilder } from '../../llm/prompt.builder';
import type {
  IChatMessage,
  IToolDefinition,
  IToolCall,
} from '../../llm/interfaces/chat-completion.types';

/**
 * Events emitted by AgentService for chat mode `deep`. The ChatService
 * translates these into SSE frames.
 *
 * The generator contract:
 *   - `tool_call` events are emitted before the tool runs (so the FE
 *     can show a "Đang tra cứu..." indicator immediately).
 *   - `delta` events carry text chunks; they stream once the model
 *     decides to produce its final answer.
 *   - `done` is always the last event. Carries accumulated sources for
 *     the FE to render the sources row.
 */
export type DeepAgentEvent =
  | { kind: 'tool_call'; tool: string; args: Record<string, unknown> }
  | { kind: 'delta'; text: string }
  | { kind: 'parse_error'; raw: string }
  | { kind: 'done'; sources: IScoredChunk[]; maxIterationsHit: boolean };

/**
 * Definition of the tools the agent can call. Exposed as a class
 * property (rather than inline literals) so they can be unit-tested
 * and tweaked in one place.
 */
const TOOLS: IToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'rag_search',
      description:
        'Tìm kiếm semantic + keyword trong kho tài liệu. Trả về tối đa 5 chunks liên quan nhất, mỗi chunk kèm tên văn bản và đoạn trích. Dùng khi cần thêm thông tin để trả lời.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description:
              'Câu truy vấn tìm kiếm. Nên viết lại câu hỏi của người dùng thành dạng ngắn gọn, tập trung vào khía cạnh pháp lý cần tra cứu.',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'lookup_article',
      description:
        'Tra cứu chính xác một điều luật cụ thể (ví dụ "Điều 12", "khoản 3 Điều 5"). Dùng khi người dùng nhắc đến số điều/khoản cụ thể và cần đúng đoạn văn bản gốc.',
      parameters: {
        type: 'object',
        properties: {
          text: {
            type: 'string',
            description:
              'Mô tả điều luật cần tra cứu, ví dụ "Điều 12 Bộ luật Lao động" hoặc "Điều 5 khoản 2".',
          },
        },
        required: ['text'],
      },
    },
  },
];

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  private readonly maxIterations: number;
  private readonly maxConsecutiveParseErrors = 2;

  constructor(
    config: ConfigService,
    private readonly llm: LlmService,
    private readonly retriever: RetrieverService,
    private readonly articleRegex: ArticleRegexService,
    private readonly promptBuilder: PromptBuilder,
  ) {
    this.maxIterations = config.get<number>('app.chat.agentMaxIterations', 5);
  }

  /**
   * Run the agent loop for one user message.
   *
   * The loop:
   *  1. Stream an assistant turn. If it ends with `finish_reason: 'stop'`,
   *     the content IS the final answer — yield as `delta` chunks and exit.
   *  2. If it ends with `finish_reason: 'tool_calls'`, execute the
   *     requested tools, append observations to the message history as
   *     `role: 'tool'` messages, and loop.
   *  3. After `maxIterations`, force-exit with whatever content was
   *     streamed so far and `maxIterationsHit: true`.
   */
  async *runDeepStream(
    userQuery: string,
    bucketName: string | undefined,
    history: IChatMessage[],
    signal: AbortSignal | undefined,
  ): AsyncGenerator<DeepAgentEvent> {
    const messages: IChatMessage[] = [
      { role: 'system', content: this.promptBuilder.buildDeepAgentSystemMessage() },
      ...history,
      { role: 'user', content: userQuery },
    ];

    const collectedSources: IScoredChunk[] = [];
    let consecutiveParseErrors = 0;

    for (let iter = 0; iter < this.maxIterations; iter++) {
      if (signal?.aborted) return;

      // Collect the next assistant turn: stream text deltas + tool_call
      // deltas. We buffer tool_calls by index because DeepSeek streams
      // arguments across multiple chunks.
      const collected = await collectAssistantTurn(
        this.llm.streamChatTools(messages, TOOLS, { signal }),
        signal,
      );

      if (signal?.aborted) return;

      // Final-answer path: no tool_calls → stream text and exit.
      if (collected.toolCalls.length === 0) {
        for (const chunk of chunkText(collected.content)) {
          if (signal?.aborted) return;
          yield { kind: 'delta', text: chunk };
        }
        yield { kind: 'done', sources: collectedSources, maxIterationsHit: false };
        return;
      }

      // Tool-call path. Append the assistant message (with its
      // tool_calls) and execute each call.
      messages.push({
        role: 'assistant',
        content: collected.content,
        tool_calls: collected.toolCalls,
      });

      for (const tc of collected.toolCalls) {
        if (signal?.aborted) return;

        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function.arguments || '{}');
        } catch (e) {
          consecutiveParseErrors++;
          this.logger.warn(
            `[AgentService] tool args parse error (consecutive=${consecutiveParseErrors}): ${(e as Error).message}`,
          );
          yield { kind: 'parse_error', raw: tc.function.arguments };
          if (consecutiveParseErrors >= this.maxConsecutiveParseErrors) {
            yield { kind: 'done', sources: collectedSources, maxIterationsHit: true };
            return;
          }
          continue;
        }
        consecutiveParseErrors = 0;

        yield { kind: 'tool_call', tool: tc.function.name, args };

        let observation: unknown;
        try {
          observation = await this.executeTool(tc, args, userQuery, bucketName, collectedSources);
        } catch (e) {
          this.logger.warn(
            `[AgentService] tool execution failed: ${(e as Error).message}`,
          );
          observation = { error: (e as Error).message };
        }

        messages.push({
          role: 'tool',
          name: tc.function.name,
          content: JSON.stringify(observation).slice(0, 4000),
        });
      }
    }

    // Hit max iterations without a final answer. Surface a soft warning
    // marker so the FE can show an inline chip; yield whatever final
    // content (likely empty in this case).
    yield { kind: 'delta', text: '\n\n*(Đã đạt giới hạn suy luận — câu trả lời có thể chưa đầy đủ.)*' };
    yield { kind: 'done', sources: collectedSources, maxIterationsHit: true };
  }

  /**
   * Execute a single tool call. Returns an observation payload suitable
   * for embedding in a `role: 'tool'` message.
   *
   * Side effect: appends retrieved chunks to `collectedSources` so the
   * FE can render a sources row alongside the final answer.
   */
  private async executeTool(
    tc: IToolCall,
    args: Record<string, unknown>,
    fallbackQuery: string,
    bucketName: string | undefined,
    collectedSources: IScoredChunk[],
  ): Promise<unknown> {
    if (tc.function.name === 'rag_search') {
      const query = (args.query as string) || fallbackQuery;
      const chunks = await this.retriever.retrieve(query, bucketName);
      chunks.forEach((c) => collectedSources.push(c));
      return chunks.slice(0, 5).map((c) => ({
        document: c.documentName,
        index: c.index,
        snippet: c.content.slice(0, 240),
      }));
    }

    if (tc.function.name === 'lookup_article') {
      const text = (args.text as string) || fallbackQuery;
      const boosted = this.articleRegex.boost(text);
      const chunks = await this.retriever.retrieve(boosted, bucketName);
      chunks.forEach((c) => collectedSources.push(c));
      return chunks.slice(0, 5).map((c) => ({
        document: c.documentName,
        index: c.index,
        snippet: c.content.slice(0, 240),
      }));
    }

    throw new Error(`Unknown tool: ${tc.function.name}`);
  }
}

/**
 * Drain the streaming assistant turn once, accumulating text and
 * tool_calls into a single result. Returns when the upstream signals
 * a finish_reason (or the stream ends).
 *
 * Why a helper: the consumer (AgentService loop) wants to decide
 * "final answer" vs "tool calls" once per turn, not stream-by-stream.
 */
async function collectAssistantTurn(
  stream: AsyncGenerator<{ content: string; toolCalls?: Array<{ index: number; id?: string; name?: string; arguments?: string }>; finishReason?: string | null }>,
  signal: AbortSignal | undefined,
): Promise<{ content: string; toolCalls: IToolCall[] }> {
  let content = '';
  // Map index → partial tool_call. DeepSeek streams partial JSON
  // arguments across multiple chunks for the same index; we concatenate.
  const byIndex = new Map<number, IToolCall>();

  for await (const delta of stream) {
    if (signal?.aborted) break;
    if (delta.content) content += delta.content;
    if (delta.toolCalls) {
      for (const tc of delta.toolCalls) {
        const existing = byIndex.get(tc.index);
        if (existing) {
          if (tc.id) existing.id = tc.id;
          if (tc.name) existing.function.name = tc.name;
          if (tc.arguments) existing.function.arguments += tc.arguments;
        } else {
          byIndex.set(tc.index, {
            id: tc.id ?? `call_${tc.index}`,
            type: 'function',
            function: {
              name: tc.name ?? '',
              arguments: tc.arguments ?? '',
            },
          });
        }
      }
    }
    if (delta.finishReason) break;
  }

  return { content, toolCalls: Array.from(byIndex.values()) };
}

/**
 * Yield a string in fixed-size chunks for the FE to consume as a
 * smooth stream. We chunk at 24 chars so deltas arrive every
 * `chunkTimeMs ≈ 24 / tokens-per-second`, which feels responsive
 * without flooding the SSE channel.
 */
function* chunkText(text: string, size = 24): Generator<string> {
  for (let i = 0; i < text.length; i += size) {
    yield text.slice(i, i + size);
  }
}