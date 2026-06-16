import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response, Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { ChatService } from './chat.service';
import { CreateConversationDto, SendMessageDto } from './dto/chat.dto';

// Per-userId (or per-IP) sliding-window limit on chat writes.
// Tune via env: CHAT_RATE_LIMIT_TTL_MS (default 60_000),
// CHAT_RATE_LIMIT_MAX (default 20). The values below are the static
// limits NestJS uses at decorator-evaluation time; the env-driven
// values are wired up at runtime in `ThrottlerBehindAuthGuard` via the
// ThrottlerModule.forRootAsync options.
const CHAT_TTL_MS = 60_000;
const CHAT_MAX = 20;

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
   *
   * Rate-limited: default 20 requests / 60s per userId (falls back to
   * client IP). See `ThrottlerBehindAuthGuard` for the tracking key.
   */
  @Throttle({ default: { ttl: CHAT_TTL_MS, limit: CHAT_MAX } })
  @Post('messages')
  @HttpCode(HttpStatus.OK)
  send(@CurrentUser('sub') userId: string, @Body() dto: SendMessageDto) {
    return this.chatService.sendMessage(userId, dto);
  }

  /**
   * Streaming reply via Server-Sent Events.
   * See `ChatService.streamMessage` for the event protocol.
   *
   * We use `@Res({ passthrough: false })` to take over the response
   * lifecycle so we can write SSE frames and hook `req.on('close')`.
   *
   * Rate-limited: same per-userId window as `POST /messages`. The guard
   * is global, so a single bad actor streaming fast still trips it
   * before exhausting the LLM budget.
   */
  @Throttle({ default: { ttl: CHAT_TTL_MS, limit: CHAT_MAX } })
  @Post('messages/stream')
  @HttpCode(HttpStatus.OK)
  async stream(
    @CurrentUser('sub') userId: string,
    @Body() dto: SendMessageDto,
    @Res() res: Response,
    @Req() req: Request,
  ): Promise<void> {
    await this.chatService.streamMessage(userId, dto, res, req);
  }
}
