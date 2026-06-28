import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Response, Request } from 'express';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import { CreateConversationDto, SendMessageDto } from './dto/chat.dto';
import { RagService } from '../rag/rag.service';
import { LlmService } from '../llm/llm.service';
import { PromptBuilder, IRetrievedSource } from '../llm/prompt.builder';
import { AgentService, DeepAgentEvent } from './services/agent.service';
import { DocumentLookupService, LookupEvent } from './services/document-lookup.service';
import {
  QuotaService,
  QuotaExceededError,
} from '../payment/quota.service';
import { PlanNotAllowedError } from '../payment/plan-catalog';
import type { IChatMessage } from '../llm/interfaces/chat-completion.types';

function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

export interface IConversationListItem {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface IMessageDto {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
}

export interface IConversationDetail {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: IMessageDto[];
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectRepository(Conversation)
    private readonly convRepo: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly msgRepo: Repository<Message>,
    private readonly rag: RagService,
    private readonly llm: LlmService,
    private readonly prompt: PromptBuilder,
    private readonly agent: AgentService,
    private readonly documentLookup: DocumentLookupService,
    private readonly quota: QuotaService,
  ) {}

  /** Non-streaming reply (kept for backward compat). */
  private generateAssistantReply(userContent: string): string {
    const trimmed = userContent.trim();
    const lower = trimmed.toLowerCase();
    if (!trimmed) return "I didn't catch that — could you rephrase?";
    if (/^(hi|hello|hey|chào|xin chào)\b/i.test(trimmed)) {
      return "Hello! I'm iLaw, your legal assistant. How can I help you today?";
    }
    if (lower.includes('who are you') || lower.includes('bạn là ai')) {
      return "I'm iLaw, a demo assistant for the iLaw platform. I can help you draft legal questions, summarise documents, or answer general queries.";
    }
    if (lower.includes('help') || lower.includes('giúp')) {
      return 'Sure! I can help with: drafting legal questions, summarising text, brainstorming arguments, or explaining concepts.';
    }
    return `Thanks for your message. Streaming endpoint /messages/stream would normally call DeepSeek + RAG here.`;
  }

  async listConversations(userId: string): Promise<IConversationListItem[]> {
    const rows = await this.convRepo.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
    });
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const counts = await this.msgRepo
      .createQueryBuilder('m')
      .select('m.conversation_id', 'conversationId')
      .addSelect('COUNT(*)', 'count')
      .where('m.conversation_id IN (:...ids)', { ids })
      .groupBy('m.conversation_id')
      .getRawMany<{ conversationId: string; count: string }>();
    const countMap = new Map(counts.map((c) => [c.conversationId, parseInt(c.count, 10)]));
    return rows.map((c) => ({
      id: c.id,
      title: c.title,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      messageCount: countMap.get(c.id) ?? 0,
    }));
  }

  async createConversation(userId: string, dto: CreateConversationDto): Promise<Conversation> {
    const conv = this.convRepo.create({
      userId,
      title: dto.title?.trim() || 'New chat',
      bucketName: dto.bucketName?.trim() || undefined,
    });
    return this.convRepo.save(conv);
  }

  async getConversation(userId: string, id: string): Promise<IConversationDetail> {
    const conv = await this.convRepo.findOne({ where: { id, userId } });
    if (!conv) throw new NotFoundException(`Conversation ${id} not found`);
    const messages = await this.msgRepo.find({
      where: { conversationId: id },
      order: { createdAt: 'ASC' },
    });
    return {
      id: conv.id,
      title: conv.title,
      createdAt: conv.createdAt.toISOString(),
      updatedAt: conv.updatedAt.toISOString(),
      messages: messages.map((m) => this.toDto(m)),
    };
  }

  async deleteConversation(userId: string, id: string): Promise<void> {
    const result = await this.convRepo.delete({ id, userId });
    if (!result.affected) {
      throw new NotFoundException(`Conversation ${id} not found`);
    }
  }

  /**
   * Non-streaming send (kept for backward compat). New clients should
   * use `streamMessage` instead.
   */
  async sendMessage(
    userId: string,
    dto: SendMessageDto,
  ): Promise<{
    conversationId: string;
    userMessage: IMessageDto;
    assistantMessage: IMessageDto;
  }> {
    const { conversation, userMsg } = await this.persistUserMessage(userId, dto);

    const reply = this.generateAssistantReply(dto.content);
    const assistantMsg = await this.msgRepo.save(
      this.msgRepo.create({
        conversationId: conversation.id,
        role: 'assistant',
        content: reply,
      }),
    );
    await this.convRepo.update({ id: conversation.id }, { updatedAt: new Date() });
    return {
      conversationId: conversation.id,
      userMessage: this.toDto(userMsg),
      assistantMessage: this.toDto(assistantMsg),
    };
  }

  // ─── Streaming ─────────────────────────────────────────────────────

  /**
   * Stream a reply to the client as Server-Sent Events.
   *
   * Dispatches on `dto.mode`:
   *   - `fast`   — single RAG retrieval + DeepSeek streaming chat.
   *   - `deep`   — agentic RAG with DeepSeek function calling (AgentService).
   *   - `lookup` — citation-only retrieval, no LLM call (DocumentLookupService).
   *
   * Default mode is `fast` (backward compatible).
   *
   * Event protocol (common):
   *   event: start     data: { conversationId, userMessageId, mode }
   *   event: meta      data: { kind: 'fast' | 'deep' | 'lookup' | 'rag' | 'general' | 'rag_warning', ... }
   *   event: sources   data: { sources: ISource[] }        (fast/deep final only)
   *   event: source    data: { index, name, snippet, content }  (lookup, repeated)
   *   event: tool_call data: { tool, args }                (deep, repeated)
   *   event: delta     data: { content: string }            (fast/deep final answer, repeated)
   *   event: done      data: { messageId? }
   *   event: error     data: { message }                   (on failure)
   *   data: [DONE]                                          // terminator
   */
  async streamMessage(
    userId: string,
    dto: SendMessageDto,
    res: Response,
    req: Request,
  ): Promise<void> {
    const mode = dto.mode ?? 'fast';

    // 1) Resolve / create conversation + persist user message
    const { conversation, userMsg } = await this.persistUserMessage(userId, dto);

    // 1b) Quota enforcement. Runs BEFORE we commit to SSE headers so
    //     a quota error can be returned as a normal HTTP 4xx. After
    //     the increment we still keep the user message persisted (it
    //     counts against quota even if the LLM later errors).
    try {
      const quota = await this.quota.checkAndIncrement(userId, mode);
      // Surface the post-increment usage so the FE can show the pill.
      // (Sent as a normal JSON response via res.locals, then attached
      // to the first SSE event below.)
      res.setHeader(
        'X-Quota-Used',
        String(quota.used),
      );
      res.setHeader(
        'X-Quota-Limit',
        String(quota.limit),
      );
      res.setHeader('X-Quota-Plan', quota.plan.id);
    } catch (e) {
      if (
        e instanceof QuotaExceededError ||
        e instanceof PlanNotAllowedError
      ) {
        // Map domain errors to HTTP responses and roll back the
        // user-message we just persisted (it never executed).
        const status = e instanceof PlanNotAllowedError ? 403 : 429;
        res.statusCode = status;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({
          error: (e as { code?: string }).code,
          message: (e as Error).message,
        }));
        // Best-effort cleanup of the user message we just wrote.
        try { await this.msgRepo.delete({ id: userMsg.id }); } catch { /* ignore */ }
        return;
      }
      throw e;
    }

    // 2) Set SSE headers
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const writeSse = (event: string, data: unknown): void => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // 3) Announce start with mode so FE can render the badge even before
    //    the assistant message stream begins.
    writeSse('start', {
      conversationId: conversation.id,
      userMessageId: userMsg.id,
      mode,
    });

    // 4) Wire abort: stop upstream as soon as the client disconnects
    const ac = new AbortController();
    let aborted = false;
    req.on('close', () => {
      if (!aborted) {
        aborted = true;
        ac.abort();
        this.logger.log(`Client disconnected for conv ${conversation.id} (mode=${mode})`);
      }
    });

    // 5) Dispatch to per-mode handler. Each branch is responsible for
    //    writing its own events and finally calling `finishWithMessage`
    //    to persist the assistant message + send `done`.
    try {
      switch (mode) {
        case 'fast':
          await this.streamFast(conversation, userMsg, dto, writeSse, ac.signal, () => aborted);
          break;
        case 'deep':
          await this.streamDeep(conversation, userMsg, dto, writeSse, ac.signal, () => aborted);
          break;
        case 'lookup':
          await this.streamLookup(conversation, userMsg, dto, writeSse, ac.signal, () => aborted);
          break;
      }
    } catch (e) {
      if (!aborted) {
        this.logger.error(`streamMessage failed (mode=${mode}): ${errorMessage(e)}`);
        writeSse('error', { message: errorMessage(e) || 'Upstream error' });
      }
    }

    if (!aborted) {
      res.write('data: [DONE]\n\n');
    }
    res.end();
  }

  /**
   * Fast mode: today's behaviour. One retrieval, one streaming LLM call.
   * Emits `sources`, `meta`, `delta`, then `done`.
   */
  private async streamFast(
    conversation: Conversation,
    userMsg: Message,
    dto: SendMessageDto,
    writeSse: (event: string, data: unknown) => void,
    signal: AbortSignal,
    isAborted: () => boolean,
  ): Promise<void> {
    // 1) Retrieve RAG context
    let sources: IRetrievedSource[] = [];
    let usedFallback = false;
    try {
      let searchBucket = conversation.bucketName;
      if (!searchBucket) {
        searchBucket = await this.classifyBucketForQuery(dto.content);
      }
      const retrieved = await this.rag.retrieve(dto.content, searchBucket ? { bucketName: searchBucket } : undefined);
      sources = retrieved.map((s) => ({
        index: s.index,
        name: s.documentName,
        snippet: s.content.slice(0, 240),
        content: s.content,
        score: s.score,
      }));
      usedFallback = sources.length === 0;
      writeSse('sources', { sources });
    } catch (e) {
      this.logger.warn(`RAG retrieve failed: ${errorMessage(e)}`);
      writeSse('sources', { sources: [] });
      usedFallback = true;
    }

    writeSse('meta', { kind: usedFallback ? 'general' : 'rag' });

    // 1b) 3-tier guard based on retrieval quality:
    //
    //   Tier 3 (no sources):  HARD refusal — never call LLM, it will
    //                         hallucinate. Show fixed message.
    //
    //   Tier 2 (low score):  PARTIAL answer — call LLM but prepend a
    //                         warning so it doesn't pretend certainty.
    //
    //   Tier 1 (good score):  NORMAL — let LLM answer with citations.
    //
    // Score thresholds are intentionally conservative; the reranker
    // output is a calibrated probability so 0.4+ is usually solid.
    const LOW_SCORE_THRESHOLD = 0.4;
    const topScore = sources.length > 0
      ? Math.max(...sources.map((s) => s.score ?? 0))
      : 0;

    const isLowConfidence = topScore < LOW_SCORE_THRESHOLD && !usedFallback;

    // 2) Build prompt + stream
    const history = await this.loadHistory(conversation.id, userMsg.id);
    const messages = this.prompt.build({
      sources,
      history,
      userContent: dto.content,
      lowConfidence: isLowConfidence,
      noSources: sources.length === 0,
    });

    let full = '';
    try {
      for await (const delta of this.llm.streamChat(messages, { signal })) {
        if (isAborted()) break;
        if (delta.content) {
          full += delta.content;
          writeSse('delta', { content: delta.content });
        }
        if (delta.finishReason === 'stop' || delta.finishReason === 'length') {
          break;
        }
      }
    } catch (e) {
      if (!isAborted()) {
        this.logger.error(`LLM stream failed: ${errorMessage(e)}`);
        writeSse('error', { message: errorMessage(e) || 'Upstream LLM error' });
      }
      return;
    }

    if (isAborted()) return;
    await this.finishWithMessage(conversation, full, writeSse);
  }

  /**
   * Deep mode: agent loop. Emits `tool_call` frames during the loop,
   * then `meta` + `delta` for the final answer, then `done`.
   */
  private async streamDeep(
    conversation: Conversation,
    userMsg: Message,
    dto: SendMessageDto,
    writeSse: (event: string, data: unknown) => void,
    signal: AbortSignal,
    isAborted: () => boolean,
  ): Promise<void> {
    const historyMessages: IChatMessage[] = (await this.loadHistory(conversation.id, userMsg.id))
      .map((h) => ({ role: h.role as 'user' | 'assistant', content: h.content }));

    let full = '';
    let sources: IRetrievedSource[] = [];
    let maxIterationsHit = false;

    try {
      const stream = this.agent.runDeepStream(
        dto.content,
        conversation.bucketName,
        historyMessages,
        signal,
      );

      for await (const ev of stream) {
        if (isAborted()) break;

        switch (ev.kind) {
          case 'tool_call':
            writeSse('tool_call', { tool: ev.tool, args: ev.args });
            break;
          case 'tool_result':
            writeSse('tool_result', { tool: ev.tool, summary: ev.summary });
            break;
          case 'delta':
            full += ev.text;
            writeSse('delta', { content: ev.text });
            break;
          case 'parse_error':
            // Surface but don't break — the agent will see the error
            // reflected in the next tool observation and self-correct.
            this.logger.warn(`[AgentService] parse_error raw=${ev.raw.slice(0, 80)}`);
            break;
          case 'sources':
            // The agent emits a `sources` event before `done` with the
            // accumulated citation refs. We surface it as the SSE `sources`
            // event so the FE can render the row once.
            sources = ev.sources.map((s, i) => ({
              index: i + 1,
              name: s.documentName,
              snippet: s.content.slice(0, 240),
              content: s.content,
            }));
            break;
          case 'done': {
            // Done may also carry the final sources list (defensive).
            if (sources.length === 0) {
              sources = ev.sources.map((s, i) => ({
                index: i + 1,
                name: s.documentName,
                snippet: s.content.slice(0, 240),
                content: s.content,
              }));
            }
            maxIterationsHit = ev.maxIterationsHit;
            break;
          }
        }
      }
    } catch (e) {
      if (!isAborted()) {
        this.logger.error(`Deep agent failed: ${errorMessage(e)}`);
        writeSse('error', { message: errorMessage(e) || 'Deep agent error' });
      }
      return;
    }

    if (isAborted()) return;

    // Emit sources once the loop is done so the FE has citations.
    writeSse('sources', { sources });

    if (maxIterationsHit) {
      writeSse('meta', { kind: 'rag_warning', maxIterationsHit: true });
    } else if (sources.length > 0) {
      writeSse('meta', { kind: 'rag' });
    } else {
      writeSse('meta', { kind: 'general' });
    }

    await this.finishWithMessage(conversation, full, writeSse);
  }

  /**
   * Lookup mode: citation-only. Emits `meta` with kind=`lookup`, then
   * one `source` event per chunk, then `done`. No LLM call, no `delta`.
   */
  private async streamLookup(
    conversation: Conversation,
    _userMsg: Message,
    dto: SendMessageDto,
    writeSse: (event: string, data: unknown) => void,
    signal: AbortSignal,
    isAborted: () => boolean,
  ): Promise<void> {
    let totalCount = 0;
    let introQuery = dto.content.trim();
    const sources: IRetrievedSource[] = [];

    try {
      const stream = this.documentLookup.stream(
        dto.content,
        conversation.bucketName,
        signal,
      );

      for await (const ev of stream) {
        if (isAborted()) break;

        switch (ev.kind) {
          case 'lookup_intro':
            introQuery = ev.query;
            writeSse('meta', { kind: 'lookup', count: ev.count, query: ev.query });
            break;
          case 'source':
            sources.push({
              index: ev.chunk.index,
              name: ev.chunk.documentName,
              snippet: ev.chunk.content.slice(0, 240),
              content: ev.chunk.content,
            });
            writeSse('source', {
              index: ev.chunk.index,
              name: ev.chunk.documentName,
              snippet: ev.chunk.content.slice(0, 240),
              content: ev.chunk.content,
            });
            break;
          case 'meta':
            totalCount = ev.count;
            break;
          case 'done':
            totalCount = ev.count;
            break;
        }
      }
    } catch (e) {
      if (!isAborted()) {
        this.logger.error(`DocumentLookup failed: ${errorMessage(e)}`);
        writeSse('error', { message: errorMessage(e) || 'Lookup error' });
      }
      return;
    }

    if (isAborted()) return;

    // Persist the assistant "answer" as a brief synthesis line so the
    // thread reads naturally on reload. The real payload is in `source`
    // events already delivered.
    const summary =
      totalCount === 0
        ? `Không tìm thấy đoạn văn bản nào liên quan đến "${introQuery}".`
        : `Tìm thấy ${totalCount} đoạn văn bản liên quan đến "${introQuery}".`;

    writeSse('delta', { content: summary });
    await this.finishWithMessage(conversation, summary, writeSse);
  }

  // ─── helpers ──────────────────────────────────────────────────────

  /**
   * Persist the assistant message + emit `done`. Shared by all three
   * mode branches.
   */
  private async finishWithMessage(
    conversation: Conversation,
    content: string,
    writeSse: (event: string, data: unknown) => void,
  ): Promise<void> {
    try {
      const assistantMsg = await this.msgRepo.save(
        this.msgRepo.create({
          conversationId: conversation.id,
          role: 'assistant',
          content,
        }),
      );
      await this.convRepo.update({ id: conversation.id }, { updatedAt: new Date() });
      writeSse('done', { messageId: assistantMsg.id });
    } catch (e) {
      this.logger.error(`Persist assistant message failed: ${errorMessage(e)}`);
      writeSse('error', { message: 'Failed to persist assistant message' });
    }
  }

  private async classifyBucketForQuery(query: string): Promise<string | undefined> {
    try {
      const activeBuckets = await this.rag.listActiveBuckets();
      if (activeBuckets.length <= 1) {
        return activeBuckets[0];
      }

      const prompt = `You are a Vietnamese legal expert assistant.
Given the user's question, determine the most relevant document corpus/bucket from the available list to find the answer.

Available document corpora:
${activeBuckets.map((name) => `- ${name}`).join('\n')}

User Question: "${query}"

Instructions:
1. Select exactly one bucket name from the list above that is most relevant to the question.
2. If the question is general, spans multiple corpora, or you are not sure, reply with "all".
3. Reply with ONLY the bucket name or "all", with no additional text, explanation, punctuation, or formatting.`;

      const response = await this.llm.getChatCompletion([{ role: 'user', content: prompt }], {
        temperature: 0.1,
        maxTokens: 20,
      });

      const chosen = response.trim().toLowerCase();
      this.logger.log(`[Auto-route] LLM classified query "${query}" -> response: "${chosen}"`);

      if (activeBuckets.includes(chosen)) {
        this.logger.log(`[Auto-route] Routing retrieval to bucket: "${chosen}"`);
        return chosen;
      }
    } catch (e) {
      this.logger.error(`[Auto-route] Failed to classify query: ${errorMessage(e)}`);
    }
    return undefined;
  }

  private async persistUserMessage(
    userId: string,
    dto: SendMessageDto,
  ): Promise<{ conversation: Conversation; userMsg: Message }> {
    let conversation: Conversation | null = null;
    if (dto.conversationId) {
      conversation = await this.convRepo.findOne({
        where: { id: dto.conversationId, userId },
      });
      if (!conversation) {
        throw new NotFoundException(`Conversation ${dto.conversationId} not found`);
      }
    } else {
      const title = dto.content.trim().slice(0, 60) || 'New chat';
      conversation = await this.convRepo.save(
        this.convRepo.create({
          userId,
          title,
          bucketName: dto.bucketName?.trim() || undefined,
        }),
      );
    }

    const userMsg = await this.msgRepo.save(
      this.msgRepo.create({
        conversationId: conversation.id,
        role: 'user',
        content: dto.content,
      }),
    );
    return { conversation, userMsg };
  }

  private async loadHistory(
    conversationId: string,
    excludeMessageId: string,
  ): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
    const msgs = await this.msgRepo.find({
      where: { conversationId },
      order: { createdAt: 'ASC' },
    });
    return msgs
      .filter((m) => m.id !== excludeMessageId)
      .map((m) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      }));
  }

  private toDto(m: Message): IMessageDto {
    return {
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    };
  }
}