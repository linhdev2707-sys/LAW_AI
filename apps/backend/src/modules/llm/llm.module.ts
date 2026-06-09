import { Module } from '@nestjs/common';
import { LlmService } from './llm.service';
import { PromptBuilder } from './prompt.builder';

@Module({
  providers: [LlmService, PromptBuilder],
  exports: [LlmService, PromptBuilder],
})
export class LlmModule {}
