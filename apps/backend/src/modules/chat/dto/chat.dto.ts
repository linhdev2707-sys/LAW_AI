import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { CHAT_MODES, type ChatMode } from '@law-ai/shared';

export class CreateConversationDto {
  @ApiPropertyOptional({ example: 'My new chat' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ example: 'chatbotagent' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(63)
  bucketName?: string;
}

export class SendMessageDto {
  @ApiProperty({ example: 'Hello, who are you?' })
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  content!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  conversationId?: string;

  @ApiPropertyOptional({ example: 'chatbotagent' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(63)
  bucketName?: string;

  /**
   * Chat mode. Drives the per-message behaviour in ChatService:
   *  - `fast`   — single retrieval + LLM streaming (default; today's behaviour)
   *  - `deep`   — agentic RAG with DeepSeek function calling
   *  - `lookup` — citation-only retrieval, no LLM
   * Optional for backward compatibility: missing → `fast`.
   */
  @ApiPropertyOptional({ enum: CHAT_MODES, example: 'fast' })
  @IsOptional()
  @IsIn(CHAT_MODES)
  mode?: ChatMode;
}

export class ConversationIdParamDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  id!: string;
}
