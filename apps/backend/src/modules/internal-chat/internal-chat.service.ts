import { Injectable, Logger } from '@nestjs/common';
import type { Response, Request } from 'express';
import { LlmService } from '../llm/llm.service';
import { PromptBuilder } from '../llm/prompt.builder';
import { InternalSendMessageDto } from './dto/internal-chat.dto';

/**
 * Lightweight chat used by the public homepage chatbox (no auth, no DB).
 *
 * Behavior:
 *   - Skips JWT / database writes — purely a stateless demo endpoint.
 *   - Streams a reply via Server-Sent Events so the UI can render tokens
 *     progressively, mirroring the authenticated chat experience.
 *   - Reuses `PromptBuilder` so the system prompt / persona matches the
 *     logged-in product, but with no RAG context injected.
 *
 * Event protocol (kept identical to `ChatService.streamMessage` for
 * frontend consistency):
 *   event: start     data: { messageId }
 *   event: delta     data: { content: string }   // repeated
 *   event: done      data: { messageId }
 *   event: error     data: { message }
 *   data: [DONE]                                 // terminator
 */
@Injectable()
export class InternalChatService {
  private readonly logger = new Logger(InternalChatService.name);
  // Hard cap on history turns accepted from the client to avoid abuse.
  private readonly maxHistoryTurns = 6;

  constructor(
    private readonly llm: LlmService,
    private readonly prompt: PromptBuilder,
  ) {}

  async streamMessage(dto: InternalSendMessageDto, res: Response, req: Request): Promise<void> {
    // 1) SSE headers
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const writeSse = (event: string, data: unknown): void => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Generate a stable id locally — we never persist it.
    const messageId = `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Honour client disconnect: cancel upstream LLM call as soon as the
    // browser closes the connection.
    const ac = new AbortController();
    req.on('close', () => {
      if (!ac.signal.aborted) ac.abort();
    });

    try {
      // 2) Announce start
      writeSse('start', { messageId });

      // 3) Build the prompt. Skip RAG — this endpoint is anonymous and
      //    intentionally returns ungrounded, conversational answers.
      const history = (dto.history ?? []).slice(-this.maxHistoryTurns * 2);
      const messages = this.prompt.build({
        sources: [],
        history: history.map((h) => ({ role: h.role, content: h.content })),
        userContent: dto.content,
      });

      // 4) Stream LLM tokens
      for await (const chunk of this.llm.streamChat(messages, { signal: ac.signal })) {
        if (chunk.content) {
          writeSse('delta', { content: chunk.content });
        }
      }

      // 5) Terminate cleanly
      writeSse('done', { messageId });
      res.write('data: [DONE]\n\n');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Internal chat stream failed: ${message}`);
      try {
        writeSse('error', { message });
        res.write('data: [DONE]\n\n');
      } catch {
        // Client already disconnected — nothing else to do.
      }
    } finally {
      res.end();
    }
  }
}
