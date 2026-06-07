import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import { CreateConversationDto, SendMessageDto } from './dto/chat.dto';

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
  constructor(
    @InjectRepository(Conversation)
    private readonly convRepo: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly msgRepo: Repository<Message>,
  ) {}

  /** Generate a placeholder assistant reply. Replace with LLM call later. */
  private generateAssistantReply(userContent: string): string {
    const trimmed = userContent.trim();
    const lower = trimmed.toLowerCase();
    if (!trimmed) return "I didn't catch that — could you rephrase?";
    if (/^(hi|hello|hey|chào|xin chào)\b/i.test(trimmed)) {
      return "Hello! I'm LAW AI, your legal assistant. How can I help you today?";
    }
    if (lower.includes('who are you') || lower.includes('bạn là ai')) {
      return "I'm LAW AI, a demo assistant for the LAW_AI monorepo. I can help you draft legal questions, summarise documents, or answer general queries. Try asking me something!";
    }
    if (lower.includes('help') || lower.includes('giúp')) {
      return "Sure! I can help with: drafting legal questions, summarising text, brainstorming arguments, or explaining concepts. What would you like to start with?";
    }
    // Echo + acknowledgement
    const snippet = trimmed.length > 200 ? `${trimmed.slice(0, 200)}…` : trimmed;
    return `Thanks for your message. Here's a thoughtful reply about: **"${snippet}"**\n\nThis is a demo response from LAW AI. In production this would be streamed from an LLM (OpenAI, Anthropic, etc.) with retrieval-augmented context from your legal knowledge base.`;
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
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
      })),
    };
  }

  async deleteConversation(userId: string, id: string): Promise<void> {
    const result = await this.convRepo.delete({ id, userId });
    if (!result.affected) throw new NotFoundException(`Conversation ${id} not found`);
  }

  /**
   * Persist user message, generate assistant reply, persist it, return both.
   * If conversationId is omitted, a new conversation is created.
   */
  async sendMessage(
    userId: string,
    dto: SendMessageDto,
  ): Promise<{ conversationId: string; userMessage: IMessageDto; assistantMessage: IMessageDto }> {
    let conversation: Conversation | null = null;
    if (dto.conversationId) {
      conversation = await this.convRepo.findOne({ where: { id: dto.conversationId, userId } });
      if (!conversation) throw new NotFoundException(`Conversation ${dto.conversationId} not found`);
    } else {
      // Auto-title from first message (first 60 chars)
      const title = dto.content.trim().slice(0, 60) || 'New chat';
      conversation = await this.convRepo.save(
        this.convRepo.create({ userId, title }),
      );
    }

    // 1) Save user message
    const userMsg = await this.msgRepo.save(
      this.msgRepo.create({
        conversationId: conversation.id,
        role: 'user',
        content: dto.content,
      }),
    );

    // 2) Generate + save assistant reply
    const reply = this.generateAssistantReply(dto.content);
    const assistantMsg = await this.msgRepo.save(
      this.msgRepo.create({
        conversationId: conversation.id,
        role: 'assistant',
        content: reply,
      }),
    );

    // 3) Bump conversation.updatedAt (auto via @UpdateDateColumn on next save)
    await this.convRepo.update({ id: conversation.id }, { updatedAt: new Date() });

    return {
      conversationId: conversation.id,
      userMessage: this.toDto(userMsg),
      assistantMessage: this.toDto(assistantMsg),
    };
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
