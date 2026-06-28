import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@law-ai/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RagService } from './rag.service';
import { RagQueueService } from './queue/rag-queue.service';
import { PdfNeedsOcrError } from './parsers/pdf-needs-ocr.error';
import { CreateRagDocumentDto } from './dto/create-rag-document.dto';
import { RagDocumentIdParamDto } from './dto/rag-document-id.dto';
import { UploadRagDocumentDto } from './dto/upload-rag-document.dto';
import { CreateRagBucketDto } from './dto/create-rag-bucket.dto';
import { BulkDeleteDocumentsDto } from './dto/bulk-delete-documents.dto';
import { extname } from 'path';

@ApiTags('admin-rag')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/rag')
export class RagAdminController {
  private readonly logger = new Logger(RagAdminController.name);

  constructor(
    private readonly ragService: RagService,
    private readonly queueService: RagQueueService,
  ) {}

  // ─── Bucket management ───────────────────────────────────────────────

  @Get('buckets')
  listBuckets() {
    return this.ragService.listBuckets();
  }

  @Post('buckets')
  @HttpCode(HttpStatus.CREATED)
  async createBucket(@Body() dto: CreateRagBucketDto) {
    await this.ragService.createBucket(dto.name, dto.region);
    return { name: dto.name, region: dto.region ?? 'auto' };
  }

  // ─── Document management ──────────────────────────────────────────────

  @Get('documents')
  list() {
    return this.ragService.listDocuments();
  }

  @Post('documents')
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser('sub') userId: string, @Body() dto: CreateRagDocumentDto) {
    return this.ragService.ingest(dto, userId);
  }

  /**
   * Multipart upload — supports PDF, DOCX, TXT, MD up to 50 MB.
   * Field layout (multipart/form-data):
   *   - `name`   (string, required) — human label for the document
   *   - `bucket` (string, required) — R2 bucket name (lowercase, hyphens)
   *   - `file`   (binary, required) — the document itself
   *
   * `memoryStorage()` keeps the bytes in RAM (capped at 50 MB), which is
   * the simplest option and fine for the current size limit. If we later
   * need larger files, switch to disk storage with a tmp dir.
   *
   * Scanned PDFs (no extractable text layer) are routed to the OCR
   * queue: we upload the raw PDF to R2 under `ocr-inbox/`, create a
   * `rag_documents` row with `status=ocr_pending`, and return 202. The
   * Cloudflare Worker picks it up via R2 Event Notifications and posts
   * the extracted text back to the callback endpoint.
   */
  @Post('documents/upload')
  @HttpCode(HttpStatus.CREATED)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name', 'bucket', 'file'],
      properties: {
        name: { type: 'string', maxLength: 200 },
        bucket: { type: 'string', example: 'law-ai-rag-civil-code-2015' },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  async upload(
    @CurrentUser('sub') userId: string,
    @Body() dto: UploadRagDocumentDto,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('Missing `file` field in multipart form');
    }
    const mimeType = file.mimetype || 'application/octet-stream';
    const result = await this.ragService.startAsyncIngestBuffer(
      dto.name,
      file.buffer,
      mimeType,
      file.originalname,
      dto.bucket,
      userId,
    );
    return result;
  }

  @Get('jobs/:id')
  getJobStatus(@Param('id') jobId: string) {
    return this.queueService.getJobStatus(jobId);
  }

  @Post('jobs/:id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelJob(@Param('id') jobId: string) {
    await this.queueService.cancelJob(jobId);
    return { success: true };
  }

  @Post('jobs/:id/retry')
  @HttpCode(HttpStatus.OK)
  async retryJob(@Param('id') jobId: string) {
    await this.queueService.retryJob(jobId);
    return { success: true };
  }

  @Post('documents/:id/sync')
  @HttpCode(HttpStatus.OK)
  async sync(@Param() params: RagDocumentIdParamDto) {
    const job = await this.ragService.syncDocument(params.id);
    return { success: true, jobId: job.id };
  }

  /**
   * Lightweight status endpoint for the admin UI to poll after a
   * scanned-PDF upload. Returns the same fields as the regular
   * document detail endpoint, trimmed to what the polling UI needs.
   */
  @Get('documents/:id/ocr-status')
  async ocrStatus(@Param() params: RagDocumentIdParamDto) {
    const doc = await this.ragService.getDocument(params.id);
    if (!doc) {
      throw new BadRequestException(`RagDocument ${params.id} not found`);
    }
    return {
      id: doc.id,
      status: doc.status,
      chunkCount: doc.chunkCount,
      error: doc.error,
    };
  }

  @Get('documents/:id')
  getOne(@Param() params: RagDocumentIdParamDto) {
    return this.ragService.getDocument(params.id);
  }

  @Delete('documents/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param() params: RagDocumentIdParamDto) {
    await this.ragService.deleteDocument(params.id);
  }

  /**
   * Bulk delete. POST instead of DELETE because some HTTP intermediaries
   * strip bodies from DELETE — and we need up to 100 ids in the body.
   *
   * Returns a per-id outcome so the FE can surface partial failures
   * (e.g. "9/10 đã xoá, 1 thất bại"). Successful deletes return
   * `ok: true`; failures include the error message.
   */
  @Post('documents/bulk-delete')
  @HttpCode(HttpStatus.OK)
  async bulkRemove(@Body() dto: BulkDeleteDocumentsDto) {
    return this.ragService.deleteDocuments(dto.ids);
  }
}
