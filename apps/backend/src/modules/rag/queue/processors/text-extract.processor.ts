import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentJob, DocumentJobStatus } from '../../entities/document-job.entity';
import { DocumentVersion, DocumentVersionStatus } from '../../entities/document-version.entity';
import { RagDocument, RagDocumentStatus } from '../../entities/rag-document.entity';
import { RagQueueService } from '../rag-queue.service';
import { R2Service } from '../../storage/r2.service';
import { DocumentParserService } from '../../parsers/document-parser.service';
import { ProcessingLogLevel } from '../../entities/processing-log.entity';

@Processor('text-extract', { lockDuration: 300000 })
export class TextExtractProcessor extends WorkerHost {
  private readonly logger = new Logger(TextExtractProcessor.name);

  constructor(
    @InjectRepository(DocumentJob) private readonly jobRepo: Repository<DocumentJob>,
    @InjectRepository(DocumentVersion) private readonly versionRepo: Repository<DocumentVersion>,
    @InjectRepository(RagDocument) private readonly docRepo: Repository<RagDocument>,
    private readonly queueService: RagQueueService,
    private readonly r2: R2Service,
    private readonly parser: DocumentParserService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { documentId, versionId, jobId } = job.data;
    const startTime = Date.now();

    await this.jobRepo.update(jobId, {
      status: DocumentJobStatus.PROCESSING,
      progress: 30,
      currentStep: 'extract',
      bullmqJobId: job.id,
    });

    await this.queueService.logStep(jobId, 'extract', ProcessingLogLevel.INFO, 'Bắt đầu trích xuất văn bản từ tài liệu.');

    try {
      const doc = await this.docRepo.findOne({ where: { id: documentId } });
      if (!doc) throw new Error(`Không tìm thấy tài liệu ${documentId}`);

      const version = await this.versionRepo.findOne({ where: { id: versionId } });
      if (!version) throw new Error(`Không tìm thấy phiên bản tài liệu ${versionId}`);

      // Download file buffer from Cloudflare R2
      const fileBuffer = await this.r2.getObjectBuffer(doc.bucketName, version.r2Key);

      // Extract text
      const extractedText = await this.parser.extractText(fileBuffer, version.mimeType, doc.name);

      const durationMs = Date.now() - startTime;
      await this.queueService.logStep(
        jobId,
        'extract',
        ProcessingLogLevel.INFO,
        `Trích xuất văn bản hoàn thành. Độ dài: ${extractedText.length} ký tự.`,
        durationMs,
      );

      // Route to chunking queue
      await this.queueService.enqueueChunk(documentId, versionId, jobId, extractedText);

      return { textLength: extractedText.length };
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      const errMsg = error.message || String(error);
      this.logger.error(`Lỗi trong bước trích xuất văn bản: ${errMsg}`);

      await this.jobRepo.update(jobId, {
        status: DocumentJobStatus.FAILED,
        errorMessage: errMsg,
      });

      await this.versionRepo.update(versionId, {
        status: DocumentVersionStatus.FAILED,
        error: errMsg,
      });

      await this.docRepo.update(documentId, {
        status: RagDocumentStatus.FAILED,
        error: errMsg.slice(0, 1000),
      });

      await this.queueService.logStep(
        jobId,
        'extract',
        ProcessingLogLevel.ERROR,
        `Lỗi trích xuất văn bản: ${errMsg}`,
        durationMs,
      );

      throw error;
    }
  }
}
