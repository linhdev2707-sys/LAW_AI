import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
import { CreateRagDocumentDto } from './dto/create-rag-document.dto';
import { RagDocumentIdParamDto } from './dto/rag-document-id.dto';
import { UploadRagDocumentDto } from './dto/upload-rag-document.dto';
import { CreateRagBucketDto } from './dto/create-rag-bucket.dto';

@ApiTags('admin-rag')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/rag')
export class RagAdminController {
  constructor(private readonly ragService: RagService) {}

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
   * Multipart upload — supports PDF, DOCX, TXT, MD up to 10 MB.
   * Field layout (multipart/form-data):
   *   - `name`   (string, required) — human label for the document
   *   - `bucket` (string, required) — R2 bucket name (lowercase, hyphens)
   *   - `file`   (binary, required) — the document itself
   *
   * `memoryStorage()` keeps the bytes in RAM (capped at 10 MB), which is
   * the simplest option and fine for the current size limit. If we later
   * need larger files, switch to disk storage with a tmp dir.
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
      limits: { fileSize: 10 * 1024 * 1024 },
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
    return this.ragService.ingestBuffer(
      dto.name,
      file.buffer,
      file.mimetype || 'application/octet-stream',
      file.originalname,
      dto.bucket,
      userId,
    );
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
}
