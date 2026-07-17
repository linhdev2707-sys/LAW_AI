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
import { PdfNeedsOcrError } from '../../parsers/pdf-needs-ocr.error';
import { ProcessingLogLevel } from '../../entities/processing-log.entity';

@Processor('analyze', { lockDuration: 300000 })
export class AnalyzeProcessor extends WorkerHost {
  private readonly logger = new Logger(AnalyzeProcessor.name);

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
      progress: 10,
      currentStep: 'analyze',
      bullmqJobId: job.id,
    });

    await this.queueService.logStep(
      jobId,
      'analyze',
      ProcessingLogLevel.INFO,
      'Đang tiến hành phân tích định dạng tệp.',
    );

    try {
      const doc = await this.docRepo.findOne({ where: { id: documentId } });
      if (!doc) throw new Error(`Không tìm thấy tài liệu ${documentId}`);

      const version = await this.versionRepo.findOne({ where: { id: versionId } });
      if (!version) throw new Error(`Không tìm thấy phiên bản tài liệu ${versionId}`);

      await this.versionRepo.update(versionId, {
        status: DocumentVersionStatus.PROCESSING,
      });

      // Download file buffer from Cloudflare R2
      const fileBuffer = await this.r2.getObjectBuffer(doc.bucketName, version.r2Key);

      let needsOcr = false;
      const mime = version.mimeType.toLowerCase();

      if (mime.startsWith('image/')) {
        needsOcr = true;
      } else if (mime === 'application/pdf') {
        try {
          // Attempt parsing using DocumentParserService to check if there is a readable text layer
          await this.parser.extractText(fileBuffer, version.mimeType, doc.name);
        } catch (err: any) {
          if (err instanceof PdfNeedsOcrError) {
            needsOcr = true;
          } else {
            throw err;
          }
        }
      }

      const durationMs = Date.now() - startTime;
      await this.queueService.logStep(
        jobId,
        'analyze',
        ProcessingLogLevel.INFO,
        `Hoàn thành phân tích. Loại tệp: ${version.mimeType}. Cần OCR: ${needsOcr}`,
        durationMs,
      );

      // Route to next queue
      if (needsOcr) {
        await this.queueService.enqueueOcr(documentId, versionId, jobId);
      } else {
        await this.queueService.enqueueExtract(documentId, versionId, jobId);
      }

      return { needsOcr };
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      const errMsg = error.message || String(error);
      this.logger.error(`Lỗi trong bước phân tích tài liệu: ${errMsg}`);

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
        'analyze',
        ProcessingLogLevel.ERROR,
        `Lỗi khi phân tích tài liệu: ${errMsg}`,
        durationMs,
      );

      throw error;
    }
  }
}
