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
  ) {}

  /** Non-streaming reply (kept for backward compat). */
  private generateAssistantReply(userContent: string): string {
    const trimmed = userContent.trim();
    const lower = trimmed.toLowerCase();
    if (!trimmed) return "I didn't catch that — could you rephrase?";
    if (/^(hi|hello|hey|chào|xin chào)\b/i.test(trimmed)) {
      return "Hello! I'm LAW AI, your legal assistant. How can I help you today?";
    }
    if (lower.includes('who are you') || lower.includes('bạn là ai')) {
      return "I'm LAW AI, a demo assistant for the LAW_AI monorepo. I can help you draft legal questions, summarise documents, or answer general queries.";
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
   * Event protocol:
   *   event: start     data: { conversationId, userMessageId }
   *   event: sources   data: { sources: ISource[] }
   *   event: delta     data: { content: string }    // repeated
   *   event: done      data: { messageId }
   *   event: error     data: { message }            // on failure
   *   data: [DONE]                                // terminator
   */
  async streamMessage(
    userId: string,
    dto: SendMessageDto,
    res: Response,
    req: Request,
  ): Promise<void> {
    // 1) Resolve / create conversation + persist user message
    const { conversation, userMsg } = await this.persistUserMessage(userId, dto);

    // 2) Set SSE headers
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    // Disable Nest's default response handling for this route
    res.flushHeaders?.();

    const writeSse = (event: string, data: unknown): void => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // 3) Announce start
    writeSse('start', {
      conversationId: conversation.id,
      userMessageId: userMsg.id,
    });

    // 4) Retrieve RAG context
    let sources: IRetrievedSource[] = [];
    try {
      const retrieved = await this.rag.retrieve(dto.content);
      sources = retrieved.map((s) => ({
        index: s.index,
        name: s.documentName,
        snippet: s.content.slice(0, 240),
        content: s.content,
      }));
      writeSse('sources', { sources });
    } catch (e: unknown) {
      this.logger.warn(`RAG retrieve failed: ${errorMessage(e)}`);
      writeSse('sources', { sources: [] });
    }

    // 5) Wire abort: stop upstream as soon as the client disconnects
    const ac = new AbortController();
    let aborted = false;
    req.on('close', () => {
      if (!aborted) {
        aborted = true;
        ac.abort();
        this.logger.log(`Client disconnected for conv ${conversation.id}`);
      }
    });

    // 6) Build prompt + stream
    const history = await this.loadHistory(conversation.id, userMsg.id);
    const messages = this.prompt.build({
      sources,
      history,
      userContent: dto.content,
    });

    let full = '';
    try {
      for await (const delta of this.llm.streamChat(messages, { signal: ac.signal })) {
        if (aborted) break;
        if (delta.content) {
          full += delta.content;
          writeSse('delta', { content: delta.content });
        }
        if (delta.finishReason === 'stop' || delta.finishReason === 'length') {
          break;
        }
      }
    } catch (e: unknown) {
      if (!aborted) {
        this.logger.error(`LLM stream failed: ${errorMessage(e)}`);
        writeSse('error', { message: errorMessage(e) || 'Upstream LLM error' });
      }
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    if (aborted) {
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    // 7) Persist assistant message + done event
    try {
      const assistantMsg = await this.msgRepo.save(
        this.msgRepo.create({
          conversationId: conversation.id,
          role: 'assistant',
          content: full,
        }),
      );
      await this.convRepo.update({ id: conversation.id }, { updatedAt: new Date() });
      writeSse('done', { messageId: assistantMsg.id });
    } catch (e: unknown) {
      this.logger.error(`Persist assistant message failed: ${errorMessage(e)}`);
      writeSse('error', { message: 'Failed to persist assistant message' });
    }

    res.write('data: [DONE]\n\n');
    res.end();
  }

  // ─── helpers ──────────────────────────────────────────────────────

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
      conversation = await this.convRepo.save(this.convRepo.create({ userId, title }));
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
