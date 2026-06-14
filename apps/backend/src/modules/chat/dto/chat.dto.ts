import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

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
}

export class ConversationIdParamDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  id!: string;
}
