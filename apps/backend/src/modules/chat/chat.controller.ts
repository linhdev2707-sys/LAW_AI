import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { IJwtPayload } from '@law-ai/shared';
import { ChatService } from './chat.service';
import { CreateConversationDto, SendMessageDto } from './dto/chat.dto';

@ApiTags('chat')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('conversations')
  list(@CurrentUser('sub') userId: string) {
    return this.chatService.listConversations(userId);
  }

  @Post('conversations')
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser('sub') userId: string, @Body() dto: CreateConversationDto) {
    return this.chatService.createConversation(userId, dto);
  }

  @Get('conversations/:id')
  getOne(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.chatService.getConversation(userId, id);
  }

  @Delete('conversations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.chatService.deleteConversation(userId, id);
  }

  /**
   * Send a message. If conversationId omitted, creates a new conversation.
   * Returns the user message + the assistant reply (for non-streaming simplicity).
   */
  @Post('messages')
  @HttpCode(HttpStatus.OK)
  send(@CurrentUser('sub') userId: string, @Body() dto: SendMessageDto) {
    return this.chatService.sendMessage(userId, dto);
  }
}
