import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { InternalChatController } from './internal-chat.controller';
import { InternalChatService } from './internal-chat.service';

@Module({
  imports: [LlmModule],
  controllers: [InternalChatController],
  providers: [InternalChatService],
})
export class InternalChatModule {}
