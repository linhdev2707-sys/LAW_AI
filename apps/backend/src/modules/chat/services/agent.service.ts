import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import {
  RetrieverService,
  IScoredChunk,
  IRetrieverFilters,
} from '../../rag/retrieval/retriever.service';
import { RagService } from '../../rag/rag.service';
import { LlmService } from '../../llm/llm.service';
import { PromptBuilder } from '../../llm/prompt.builder';
import { ReferenceExtractorService } from '../../rag/parsers/reference-extractor.service';
import { ArticleRegexService } from './article-regex.service';
import type {
  IChatMessage,
  IToolDefinition,
  IToolCall,
} from '../../llm/interfaces/chat-completion.types';
import {
  AGENT_TOOL_NAMES,
  AgentToolName,
  IArticleRef,
  ICompareArticlesArgs,
  ICompareArticlesResult,
  IEffectiveDateCheckArgs,
  IEffectiveDateCheckResult,
  IExpandReferencesArgs,
  IExpandReferencesResult,
  IGetArticleArgs,
  IGetArticleResult,
  IGetDocumentArgs,
  IGetDocumentResult,
  IKeywordSearchArgs,
  ISearchToolResult,
  ISemanticSearchArgs,
} from './agent-tool.interface';

/**
 * Events emitted by AgentService for chat mode `deep`. The ChatService
 * translates these into SSE frames.
 *
 * Generator contract:
 *  - `tool_call` events fire BEFORE the tool runs (so the FE can show a
 *    "Đang tra cứu..." indicator immediately).
 *  - `tool_result` events fire AFTER the tool runs with a one-line
 *    summary ("Trả về 5 kết quả", "Tìm thấy Điều 15...").
 *  - `delta` events carry text chunks for the final answer.
 *  - `sources` event fires once before `done` so the FE can render the
 *    sources row separately from text streaming.
 *  - `done` is always the last event.
 */
export type DeepAgentEvent =
  | { kind: 'tool_call'; tool: AgentToolName; args: Record<string, unknown> }
  | { kind: 'tool_result'; tool: AgentToolName; summary: string }
  | { kind: 'delta'; text: string }
  | { kind: 'parse_error'; raw: string }
  | { kind: 'sources'; sources: IArticleRef[] }
  | { kind: 'done'; sources: IArticleRef[]; maxIterationsHit: boolean };

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  private readonly maxIterations: number;
  private readonly topK: number;
  private readonly maxConsecutiveParseErrors = 2;

  /**
   * 7 tools. Schemas are duplicated in Vietnamese so the LLM (DeepSeek,
   * prompted in Vietnamese) reasons about tool choice in the same lang.
   */
  private readonly TOOLS: IToolDefinition[] = [
    {
      type: 'function',
      function: {
        name: AGENT_TOOL_NAMES.SEMANTIC_SEARCH,
        description:
          'Tìm kiếm ngữ nghĩa + từ khoá trong kho văn bản pháp luật. ' +
          'Dùng khi câu hỏi mang tính khái quát hoặc cần nhiều điều luật liên quan. ' +
          'Có thể lọc theo lawNumber / lawName / article / clause.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Câu truy vấn bằng tiếng Việt' },
            lawNumber: {
              type: 'string',
              description: 'Lọc theo số văn bản, ví dụ "100/2019/QH14"',
            },
            lawName: { type: 'string', description: 'Lọc theo tên văn bản (ILIKE match)' },
            article: { type: 'string', description: 'Lọc theo số Điều' },
            clause: { type: 'string', description: 'Lọc theo số Khoản' },
            topK: { type: 'string', description: 'Số kết quả, mặc định 5' },
          },
          required: ['query'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: AGENT_TOOL_NAMES.KEYWORD_SEARCH,
        description:
          'Tìm kiếm từ khoá chính xác (BM25). Dùng khi cần tra cứu một cụm từ cụ thể, ' +
          'số hiệu văn bản, hoặc tên điều luật.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Cụm từ khoá cần tìm' },
            lawNumber: { type: 'string', description: 'Giới hạn trong một văn bản' },
            topK: { type: 'string', description: 'Số kết quả, mặc định 5' },
          },
          required: ['query'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: AGENT_TOOL_NAMES.GET_ARTICLE,
        description:
          'Lấy chính xác một Điều luật (và tuỳ chọn Khoản/Điểm). ' +
          'Dùng khi người dùng hỏi "Điều X nói gì?" hoặc trích dẫn trực tiếp.',
        parameters: {
          type: 'object',
          properties: {
            lawNumber: { type: 'string', description: 'Số văn bản, ví dụ "100/2019/QH14"' },
            lawName: { type: 'string', description: 'Tên văn bản (nếu không biết số)' },
            article: { type: 'string', description: 'Số Điều' },
            clause: { type: 'string', description: 'Số Khoản (tuỳ chọn)' },
            point: { type: 'string', description: 'Chữ cái Điểm (tuỳ chọn)' },
          },
          required: ['article'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: AGENT_TOOL_NAMES.GET_DOCUMENT,
        description:
          'Lấy tổng quan một văn bản pháp luật: metadata + danh sách các điều. ' +
          'Dùng khi cần biết cấu trúc, phạm vi, ngày hiệu lực.',
        parameters: {
          type: 'object',
          properties: {
            lawNumber: { type: 'string', description: 'Số văn bản' },
            lawName: { type: 'string', description: 'Tên văn bản' },
            documentId: { type: 'string', description: 'UUID văn bản (nếu đã biết)' },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: AGENT_TOOL_NAMES.EXPAND_REFERENCES,
        description:
          'Mở rộng tham chiếu: tìm các văn bản/điều được trích dẫn từ một đoạn văn. ' +
          'Dùng khi người dùng hỏi "điều này tham chiếu đến luật nào?".',
        parameters: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Đoạn văn chứa tham chiếu cần mở rộng' },
            direction: {
              type: 'string',
              enum: ['forward', 'backward', 'both'],
              description: 'forward = điều này tham chiếu ai, backward = ai tham chiếu điều này',
            },
          },
          required: ['text'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: AGENT_TOOL_NAMES.COMPARE_ARTICLES,
        description: 'So sánh hai điều luật (thường là cùng số điều giữa hai văn bản sửa đổi).',
        parameters: {
          type: 'object',
          properties: {
            lawA: { type: 'string', description: 'Tên hoặc số văn bản A' },
            articleA: { type: 'string', description: 'Số Điều A' },
            lawB: { type: 'string', description: 'Tên hoặc số văn bản B' },
            articleB: { type: 'string', description: 'Số Điều B' },
          },
          required: ['lawA', 'articleA', 'lawB', 'articleB'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: AGENT_TOOL_NAMES.EFFECTIVE_DATE_CHECK,
        description:
          'Kiểm tra ngày có hiệu lực / hết hiệu lực / tình trạng pháp lý hiện tại của một điều luật. ' +
          'Dùng khi câu hỏi liên quan thời điểm áp dụng.',
        parameters: {
          type: 'object',
          properties: {
            lawNumber: { type: 'string', description: 'Số văn bản' },
            lawName: { type: 'string', description: 'Tên văn bản' },
            article: { type: 'string', description: 'Số Điều' },
          },
          required: ['article'],
        },
      },
    },
  ];

  constructor(
    config: ConfigService,
    private readonly llm: LlmService,
    private readonly retriever: RetrieverService,
    private readonly articleRegex: ArticleRegexService,
    private readonly promptBuilder: PromptBuilder,
    private readonly rag: RagService,
    private readonly refExtractor: ReferenceExtractorService,
    private readonly dataSource: DataSource,
  ) {
    this.maxIterations = config.get<number>('app.chat.agentMaxIterations', 5);
    this.topK = config.get<number>('app.chat.agentTopK', 5);
  }

  /**
   * Run the agent loop for one user message.
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

    const collectedRefs: IArticleRef[] = [];
    let consecutiveParseErrors = 0;

    for (let iter = 0; iter < this.maxIterations; iter++) {
      if (signal?.aborted) return;

      const collected = await collectAssistantTurn(
        this.llm.streamChatTools(messages, this.TOOLS, { signal }),
        signal,
      );

      if (signal?.aborted) return;

      // Final-answer path
      if (collected.toolCalls.length === 0) {
        for (const chunk of chunkText(collected.content)) {
          if (signal?.aborted) return;
          yield { kind: 'delta', text: chunk };
        }
        yield { kind: 'sources', sources: collectedRefs };
        yield { kind: 'done', sources: collectedRefs, maxIterationsHit: false };
        return;
      }

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
            yield { kind: 'sources', sources: collectedRefs };
            yield { kind: 'done', sources: collectedRefs, maxIterationsHit: true };
            return;
          }
          continue;
        }
        consecutiveParseErrors = 0;

        const toolName = tc.function.name as AgentToolName;
        yield { kind: 'tool_call', tool: toolName, args };

        let observation: unknown;
        try {
          observation = await this.executeTool(
            toolName,
            args,
            userQuery,
            bucketName,
            collectedRefs,
          );
        } catch (e) {
          this.logger.warn(`[AgentService] tool execution failed: ${(e as Error).message}`);
          observation = { error: (e as Error).message };
        }

        yield {
          kind: 'tool_result',
          tool: toolName,
          summary: this.summarize(toolName, observation),
        };

        messages.push({
          role: 'tool',
          name: tc.function.name,
          content: JSON.stringify(observation).slice(0, 6000),
        });
      }
    }

    yield {
      kind: 'delta',
      text: '\n\n*(Đã đạt giới hạn suy luận — câu trả lời có thể chưa đầy đủ.)*',
    };
    yield { kind: 'sources', sources: collectedRefs };
    yield { kind: 'done', sources: collectedRefs, maxIterationsHit: true };
  }

  /**
   * Dispatch a single tool call. Side effect: appends to `collectedRefs`
   * so the FE can render a sources row alongside the final answer.
   */
  private async executeTool(
    name: AgentToolName,
    args: Record<string, unknown>,
    fallbackQuery: string,
    bucketName: string | undefined,
    collectedRefs: IArticleRef[],
  ): Promise<unknown> {
    switch (name) {
      case AGENT_TOOL_NAMES.SEMANTIC_SEARCH:
        return this.toolSemantic(args as unknown as ISemanticSearchArgs, bucketName, collectedRefs);
      case AGENT_TOOL_NAMES.KEYWORD_SEARCH:
        return this.toolKeyword(args as unknown as IKeywordSearchArgs, bucketName, collectedRefs);
      case AGENT_TOOL_NAMES.GET_ARTICLE:
        return this.toolGetArticle(args as unknown as IGetArticleArgs, collectedRefs);
      case AGENT_TOOL_NAMES.GET_DOCUMENT:
        return this.toolGetDocument(args as unknown as IGetDocumentArgs, collectedRefs);
      case AGENT_TOOL_NAMES.EXPAND_REFERENCES:
        return this.toolExpandReferences(args as unknown as IExpandReferencesArgs);
      case AGENT_TOOL_NAMES.COMPARE_ARTICLES:
        return this.toolCompare(args as unknown as ICompareArticlesArgs, collectedRefs);
      case AGENT_TOOL_NAMES.EFFECTIVE_DATE_CHECK:
        return this.toolEffectiveDate(args as unknown as IEffectiveDateCheckArgs);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  // ─── Tool implementations ───────────────────────────────────────────

  private async toolSemantic(
    args: ISemanticSearchArgs,
    bucketName: string | undefined,
    collectedRefs: IArticleRef[],
  ): Promise<ISearchToolResult> {
    const filters: IRetrieverFilters = {
      ...(bucketName ? { bucketName } : {}),
      ...(args.lawNumber ? { lawNumber: args.lawNumber } : {}),
      ...(args.lawName ? { lawName: args.lawName } : {}),
      ...(args.article ? { article: args.article } : {}),
      ...(args.clause ? { clause: args.clause } : {}),
    };
    const hits = await this.retriever.retrieve(args.query, filters);
    const k = args.topK ? parseInt(String(args.topK), 10) : this.topK;
    for (const h of hits.slice(0, k)) collectedRefs.push(this.toArticleRef(h));
    return { hits, totalCandidates: hits.length, filtersApplied: filters };
  }

  private async toolKeyword(
    args: IKeywordSearchArgs,
    bucketName: string | undefined,
    collectedRefs: IArticleRef[],
  ): Promise<ISearchToolResult> {
    // Same retriever path — BM25 branch is selected by the SQL inside.
    const filters: IRetrieverFilters = {
      ...(bucketName ? { bucketName } : {}),
      ...(args.lawNumber ? { lawNumber: args.lawNumber } : {}),
    };
    const hits = await this.retriever.retrieve(args.query, filters);
    const k = args.topK ? parseInt(String(args.topK), 10) : this.topK;
    for (const h of hits.slice(0, k)) collectedRefs.push(this.toArticleRef(h));
    return { hits, totalCandidates: hits.length, filtersApplied: filters };
  }

  private async toolGetArticle(
    args: IGetArticleArgs,
    collectedRefs: IArticleRef[],
  ): Promise<IGetArticleResult> {
    const filters: IRetrieverFilters = {
      ...(args.lawNumber ? { lawNumber: args.lawNumber } : {}),
      ...(args.lawName ? { lawName: args.lawName } : {}),
      article: args.article,
      ...(args.clause ? { clause: args.clause } : {}),
    };
    const hits = await this.retriever.retrieve(
      args.clause ? `Khoản ${args.clause} Điều ${args.article}` : `Điều ${args.article}`,
      filters,
    );
    if (hits.length === 0) return { found: false };
    const article = this.toArticleRef(hits[0]!);
    collectedRefs.push(article);
    const related = hits.slice(1, 4).map((h) => this.toArticleRef(h));
    for (const r of related) collectedRefs.push(r);
    return { found: true, article, related };
  }

  private async toolGetDocument(
    args: IGetDocumentArgs,
    collectedRefs: IArticleRef[],
  ): Promise<IGetDocumentResult> {
    const doc = await this.findDocument(args);
    if (!doc) return { found: false, articles: [] };
    const rows = await this.dataSource.query(
      `SELECT id, raw_text, breadcrumb, law_name, law_number, chapter, section,
              article, clause, point
         FROM rag_chunks
        WHERE document_id = $1
        ORDER BY chunk_index ASC
        LIMIT 500`,
      [doc.id],
    );
    const articles: IArticleRef[] = rows.map((r: any) => ({
      documentId: doc.id,
      documentName: doc.name,
      lawName: r.law_name,
      lawNumber: r.law_number,
      article: r.article,
      clause: r.clause,
      point: r.point,
      breadcrumb: r.breadcrumb,
      content: r.raw_text,
    }));
    for (const a of articles) collectedRefs.push(a);
    return {
      found: true,
      documentId: doc.id,
      lawName: doc.lawName,
      lawNumber: doc.lawNumber,
      documentType: doc.documentType,
      effectiveDate: doc.effectiveDate?.toISOString().slice(0, 10) ?? null,
      legalStatus: doc.legalStatus,
      articles,
    };
  }

  private async toolExpandReferences(
    args: IExpandReferencesArgs,
  ): Promise<IExpandReferencesResult> {
    const resolved = this.refExtractor.extract(args.text);
    const direction = args.direction ?? 'forward';
    // Backward refs (who references this) require the Knowledge Graph.
    // Phase 4 wires Neo4j; until then we return an empty array.
    return { text: args.text, direction, resolved, backward: [] };
  }

  private async toolCompare(
    args: ICompareArticlesArgs,
    collectedRefs: IArticleRef[],
  ): Promise<ICompareArticlesResult> {
    const aHit = (
      await this.retriever.retrieve(`Điều ${args.articleA}`, { lawName: args.lawA })
    )[0];
    const bHit = (
      await this.retriever.retrieve(`Điều ${args.articleB}`, { lawName: args.lawB })
    )[0];
    const a = aHit ? this.toArticleRef(aHit) : null;
    const b = bHit ? this.toArticleRef(bHit) : null;
    if (a) collectedRefs.push(a);
    if (b) collectedRefs.push(b);
    return { a, b, diff: undefined };
  }

  private async toolEffectiveDate(
    args: IEffectiveDateCheckArgs,
  ): Promise<IEffectiveDateCheckResult> {
    const doc = await this.findDocument({ lawNumber: args.lawNumber, lawName: args.lawName });
    if (!doc) {
      return { article: args.article, legalStatus: 'khong_xac_dinh', currentlyEffective: false };
    }
    const now = new Date();
    const currentlyEffective =
      doc.legalStatus === 'con_hieu_luc' &&
      (!doc.effectiveDate || doc.effectiveDate <= now) &&
      (!doc.expiryDate || doc.expiryDate >= now);
    return {
      lawName: doc.lawName ?? undefined,
      lawNumber: doc.lawNumber ?? undefined,
      article: args.article,
      effectiveDate: doc.effectiveDate?.toISOString().slice(0, 10) ?? null,
      expiryDate: doc.expiryDate?.toISOString().slice(0, 10) ?? null,
      legalStatus: doc.legalStatus,
      currentlyEffective,
    };
  }

  // ─── Helpers ────────────────────────────────────────────────────────

  private async findDocument(args: { lawNumber?: string; lawName?: string; documentId?: string }) {
    if (args.documentId) {
      return this.rag.getDocument(args.documentId);
    }
    if (args.lawNumber) {
      return this.rag['docRepo']
        .createQueryBuilder('d')
        .where('d.lawNumber = :n', { n: args.lawNumber })
        .orderBy('d.createdAt', 'DESC')
        .getOne();
    }
    if (args.lawName) {
      return this.rag['docRepo']
        .createQueryBuilder('d')
        .where('d.lawName ILIKE :n', { n: `%${args.lawName}%` })
        .orderBy('d.createdAt', 'DESC')
        .getOne();
    }
    return null;
  }

  private toArticleRef(h: IScoredChunk): IArticleRef {
    return {
      documentId: h.documentId,
      documentName: h.documentName,
      lawName: h.lawName,
      lawNumber: h.lawNumber,
      article: h.article,
      clause: h.clause,
      point: h.point,
      breadcrumb: h.breadcrumb,
      content: h.content,
    };
  }

  private summarize(name: AgentToolName, obs: unknown): string {
    if (name === AGENT_TOOL_NAMES.SEMANTIC_SEARCH || name === AGENT_TOOL_NAMES.KEYWORD_SEARCH) {
      const r = obs as ISearchToolResult;
      return `Trả về ${r.hits.length} kết quả`;
    }
    if (name === AGENT_TOOL_NAMES.GET_ARTICLE) {
      const r = obs as IGetArticleResult;
      return r.found ? `Tìm thấy ${r.article?.breadcrumb ?? 'điều luật'}` : 'Không tìm thấy';
    }
    if (name === AGENT_TOOL_NAMES.GET_DOCUMENT) {
      const r = obs as IGetDocumentResult;
      return r.found ? `Văn bản có ${r.articles.length} mục` : 'Không tìm thấy';
    }
    if (name === AGENT_TOOL_NAMES.EXPAND_REFERENCES) {
      const r = obs as IExpandReferencesResult;
      return `Mở rộng ${r.resolved.length} tham chiếu`;
    }
    if (name === AGENT_TOOL_NAMES.COMPARE_ARTICLES) {
      const r = obs as ICompareArticlesResult;
      return r.a && r.b ? `Đã so sánh ${r.a.breadcrumb} ↔ ${r.b.breadcrumb}` : 'Thiếu một bên';
    }
    if (name === AGENT_TOOL_NAMES.EFFECTIVE_DATE_CHECK) {
      const r = obs as IEffectiveDateCheckResult;
      return r.currentlyEffective ? 'Đang có hiệu lực' : 'Không có hiệu lực';
    }
    return 'OK';
  }

  /** Expose tool list for tests / debugging. */
  getToolNames(): string[] {
    return this.TOOLS.map((t) => t.function.name);
  }
}

/**
 * Drain the streaming assistant turn once, accumulating text and
 * tool_calls into a single result. Returns when the upstream signals
 * a finish_reason (or the stream ends).
 */
async function collectAssistantTurn(
  stream: AsyncGenerator<{
    content: string;
    toolCalls?: Array<{ index: number; id?: string; name?: string; arguments?: string }>;
    finishReason?: string | null;
  }>,
  signal: AbortSignal | undefined,
): Promise<{ content: string; toolCalls: IToolCall[] }> {
  let content = '';
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

/** Yield a string in fixed-size chunks so the FE gets a smooth stream. */
function* chunkText(text: string, size = 24): Generator<string> {
  for (let i = 0; i < text.length; i += size) {
    yield text.slice(i, i + size);
  }
}
