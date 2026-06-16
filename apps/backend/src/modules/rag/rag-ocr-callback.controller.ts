import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RagService } from './rag.service';
import { OcrCallbackGuard } from './guards/ocr-callback.guard';

/**
 * Body shape for the Worker's callback. We intentionally do NOT use a
 * full Class-validator DTO here — the OcrCallbackGuard verifies the HMAC
 * before the body is parsed, so DTO validation running on `req.body`
 * is fine but the guard is the only thing that protects us from
 * spoofed callers.
 */
class OcrCompleteDto {
  @ApiProperty({ description: 'UUID of the RagDocument being completed.' })
  @IsString()
  @MinLength(1)
  documentId!: string;

  @ApiProperty({ description: 'Plain-text content extracted by the Worker.' })
  @IsString()
  @MinLength(1)
  @MaxLength(50_000_000)
  text!: string;

  @ApiPropertyOptional({ description: 'Number of pages OCR\'d (for logging).' })
  @IsOptional()
  pageCount?: number;
}

/**
 * Callback endpoint hit by the Cloudflare OCR Worker once it has
 * extracted text from a scanned PDF.
 *
 * Auth: HMAC over the raw body, verified by `OcrCallbackGuard`. This
 * endpoint deliberately does NOT sit under `JwtAuthGuard`/`RolesGuard`
 * — the Worker is a server-to-server caller and uses the shared
 * `OCR_CALLBACK_SECRET` to prove its identity.
 */
@ApiTags('admin-rag-ocr')
@Controller('admin/rag/documents')
export class RagOcrCallbackController {
  private readonly logger = new Logger(RagOcrCallbackController.name);

  constructor(private readonly ragService: RagService) {}

  @Post(':id/ocr-complete')
  @HttpCode(HttpStatus.OK)
  @UseGuards(OcrCallbackGuard)
  async complete(@Body() body: OcrCompleteDto) {
    if (!body.documentId || !body.text) {
      throw new BadRequestException('documentId and text are required');
    }
    try {
      const result = await this.ragService.completeOcr(body.documentId, body.text);
      this.logger.log(
        `OCR completed for doc ${body.documentId} (chunks=${result.chunkCount})`,
      );
      return result;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('not found')) {
        throw new NotFoundException(msg);
      }
      if (msg.includes('cannot complete OCR')) {
        // Document already moved past ocr_pending — treat as conflict.
        throw new ConflictException(msg);
      }
      throw e;
    }
  }
}
