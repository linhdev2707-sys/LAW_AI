import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { LlmModule } from '../llm/llm.module';
import { RagModule } from '../rag/rag.module';
import { PaymentModule } from '../payment/payment.module';
import { AgentService } from './services/agent.service';
import { ArticleRegexService } from './services/article-regex.service';
import { DocumentLookupService } from './services/document-lookup.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, Message]),
    LlmModule,
    RagModule,
    // PaymentModule exports QuotaService — needed for per-plan
    // monthly limit + mode allowlist enforcement in ChatService.
    PaymentModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, AgentService, ArticleRegexService, DocumentLookupService],
  exports: [ChatService],
})
export class ChatModule {}
