import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response, Request } from 'express';
import { InternalChatService } from './internal-chat.service';
import { InternalSendMessageDto } from './dto/internal-chat.dto';

/**
 * Public chat endpoint used by the marketing-site floating chatbox.
 *
 * NOTE: deliberately unauthenticated. The reply is ungrounded (no RAG),
 * stateless, and capped — production answers go through the protected
 * `ChatController` at `/api/v1/chat/*` after the user signs in.
 */
@ApiTags('internal-chat')
@Controller('internal/chat')
export class InternalChatController {
  constructor(private readonly service: InternalChatService) {}

  @Post('messages/stream')
  @HttpCode(HttpStatus.OK)
  async stream(
    @Body() dto: InternalSendMessageDto,
    @Res() res: Response,
    @Req() req: Request,
  ): Promise<void> {
    await this.service.streamMessage(dto, res, req);
  }
}
