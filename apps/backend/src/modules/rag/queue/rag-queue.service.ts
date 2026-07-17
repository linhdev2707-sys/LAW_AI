import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentJob, DocumentJobStatus } from '../entities/document-job.entity';
import { DocumentVersion } from '../entities/document-version.entity';
import { ProcessingLog, ProcessingLogLevel } from '../entities/processing-log.entity';
import { RagDocument, RagDocumentStatus } from '../entities/rag-document.entity';

@Injectable()
export class RagQueueService {
  private readonly logger = new Logger(RagQueueService.name);

  constructor(
    @InjectQueue('analyze') private readonly analyzeQueue: Queue,
    @InjectQueue('ocr') private readonly ocrQueue: Queue,
    @InjectQueue('text-extract') private readonly extractQueue: Queue,
    @InjectQueue('chunk') private readonly chunkQueue: Queue,
    @InjectQueue('embed') private readonly embedQueue: Queue,

    @InjectRepository(DocumentJob) private readonly jobRepo: Repository<DocumentJob>,
    @InjectRepository(DocumentVersion) private readonly versionRepo: Repository<DocumentVersion>,
    @InjectRepository(ProcessingLog) private readonly logRepo: Repository<ProcessingLog>,
    @InjectRepository(RagDocument) private readonly docRepo: Repository<RagDocument>,
  ) {}

  async logStep(
    jobId: string,
    step: string,
    level: ProcessingLogLevel,
    message: string,
    durationMs?: number,
  ): Promise<void> {
    const cleanMessage = message.slice(0, 5000);
    this.logger.log(`[Job ${jobId}] [${step}] [${level.toUpperCase()}] ${cleanMessage}`);
    await this.logRepo.save(
      this.logRepo.create({
        jobId,
        step,
        level,
        message: cleanMessage,
        durationMs: durationMs ?? null,
      }),
    );
  }

  async startIngestion(documentId: string, versionId: string): Promise<DocumentJob> {
    // Set document status to parsing
    await this.docRepo.update(documentId, { status: RagDocumentStatus.PARSING, error: null });

    // 1. Create a job record
    const job = await this.jobRepo.save(
      this.jobRepo.create({
        documentId,
        versionId,
        queueName: 'analyze',
        status: DocumentJobStatus.PENDING,
        progress: 0,
        currentStep: 'analyze',
        retries: 0,
        maxRetries: 3,
      }),
    );

    await this.logStep(
      job.id,
      'analyze',
      ProcessingLogLevel.INFO,
      'Khởi tạo tiến trình ingestion cho tài liệu.',
    );

    // 2. Add job to analyze queue
    const bullJob = await this.analyzeQueue.add(
      'analyze',
      {
        documentId,
        versionId,
        jobId: job.id,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    // 3. Update job record with BullMQ job ID
    job.bullmqJobId = bullJob.id ?? null;
    await this.jobRepo.save(job);

    return job;
  }

  async enqueueOcr(documentId: string, versionId: string, jobId: string): Promise<void> {
    const version = await this.versionRepo.findOne({ where: { id: versionId } });
    const doc = await this.docRepo.findOne({ where: { id: documentId } });
    if (!version || !doc) {
      throw new Error(`Cannot enqueue OCR: document or version not found.`);
    }

    await this.jobRepo.update(jobId, {
      queueName: 'ocr',
      currentStep: 'ocr',
      status: DocumentJobStatus.PROCESSING,
      progress: 20,
    });

    await this.logStep(jobId, 'ocr', ProcessingLogLevel.INFO, 'Đẩy tài liệu sang hàng đợi OCR.');

    const bullJob = await this.ocrQueue.add(
      'ocr',
      {
        documentId,
        versionId,
        jobId,
        r2Key: version.r2Key,
        bucketName: doc.bucketName,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    await this.jobRepo.update(jobId, {
      bullmqJobId: bullJob.id ?? null,
    });
  }

  async enqueueExtract(documentId: string, versionId: string, jobId: string): Promise<void> {
    await this.jobRepo.update(jobId, {
      queueName: 'text-extract',
      currentStep: 'extract',
      status: DocumentJobStatus.PROCESSING,
      progress: 20,
    });

    await this.logStep(
      jobId,
      'extract',
      ProcessingLogLevel.INFO,
      'Đẩy tài liệu sang hàng đợi trích xuất văn bản.',
    );

    const bullJob = await this.extractQueue.add(
      'extract',
      {
        documentId,
        versionId,
        jobId,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    await this.jobRepo.update(jobId, {
      bullmqJobId: bullJob.id ?? null,
    });
  }

  async enqueueChunk(
    documentId: string,
    versionId: string,
    jobId: string,
    text: string,
  ): Promise<void> {
    await this.jobRepo.update(jobId, {
      queueName: 'chunk',
      currentStep: 'chunk',
      status: DocumentJobStatus.PROCESSING,
      progress: 50,
    });

    await this.logStep(
      jobId,
      'chunk',
      ProcessingLogLevel.INFO,
      `Trích xuất văn bản thành công (độ dài: ${text.length} ký tự). Đẩy sang hàng đợi phân nhỏ (Chunking).`,
    );

    const bullJob = await this.chunkQueue.add(
      'chunk',
      {
        documentId,
        versionId,
        jobId,
        text,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    await this.jobRepo.update(jobId, {
      bullmqJobId: bullJob.id ?? null,
    });
  }

  async enqueueEmbed(documentId: string, versionId: string, jobId: string): Promise<void> {
    await this.jobRepo.update(jobId, {
      queueName: 'embed',
      currentStep: 'embed',
      status: DocumentJobStatus.PROCESSING,
      progress: 75,
    });

    await this.logStep(
      jobId,
      'embed',
      ProcessingLogLevel.INFO,
      'Hoàn thành phân nhỏ văn bản. Đẩy sang hàng đợi tính toán vector nhúng (Embedding).',
    );

    const bullJob = await this.embedQueue.add(
      'embed',
      {
        documentId,
        versionId,
        jobId,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    await this.jobRepo.update(jobId, {
      bullmqJobId: bullJob.id ?? null,
    });
  }

  async cancelJob(jobId: string): Promise<void> {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) {
      throw new NotFoundException(`Không tìm thấy DocumentJob với ID ${jobId}`);
    }

    if (
      job.status === DocumentJobStatus.COMPLETED ||
      job.status === DocumentJobStatus.FAILED ||
      job.status === DocumentJobStatus.CANCELLED
    ) {
      throw new BadRequestException(`Không thể hủy job đã kết thúc với trạng thái: ${job.status}`);
    }

    // Attempt to remove from the respective BullMQ queue
    if (job.bullmqJobId) {
      try {
        const queueMap: Record<string, Queue> = {
          analyze: this.analyzeQueue,
          ocr: this.ocrQueue,
          'text-extract': this.extractQueue,
          chunk: this.chunkQueue,
          embed: this.embedQueue,
        };
        const queue = queueMap[job.queueName];
        if (queue) {
          const bullJob = await queue.getJob(job.bullmqJobId);
          if (bullJob) {
            await bullJob.discard(); // prevents further retries
            await bullJob.remove(); // removes it from the queue
            this.logger.log(`Cancelled BullMQ job ${job.bullmqJobId} in queue ${job.queueName}`);
          }
        }
      } catch (err: any) {
        this.logger.warn(`Lỗi khi xoá BullMQ Job: ${err.message}`);
      }
    }

    // Update job status in database
    job.status = DocumentJobStatus.CANCELLED;
    job.errorMessage = 'Bị huỷ bởi người dùng.';
    await this.jobRepo.save(job);

    await this.versionRepo.update(job.versionId, {
      status: 'failed' as any,
      error: 'Bị huỷ bởi người dùng.',
    });

    await this.logStep(
      jobId,
      job.currentStep,
      ProcessingLogLevel.WARN,
      'Tiến trình bị hủy bởi người dùng.',
    );
  }

  async retryJob(jobId: string): Promise<void> {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) {
      throw new NotFoundException(`Không tìm thấy DocumentJob với ID ${jobId}`);
    }

    if (job.status !== DocumentJobStatus.FAILED && job.status !== DocumentJobStatus.CANCELLED) {
      throw new BadRequestException(
        `Chỉ có thể chạy lại các job thất bại hoặc bị hủy. Trạng thái hiện tại: ${job.status}`,
      );
    }

    // Reset status and retry count
    job.status = DocumentJobStatus.PROCESSING;
    job.errorMessage = null;
    job.retries += 1;
    await this.jobRepo.save(job);

    await this.logStep(
      jobId,
      job.currentStep,
      ProcessingLogLevel.INFO,
      `Kích hoạt chạy lại job (Lần chạy lại thứ: ${job.retries}).`,
    );

    // Route based on where it failed
    if (job.currentStep === 'analyze') {
      await this.startIngestion(job.documentId, job.versionId);
    } else if (job.currentStep === 'ocr') {
      await this.enqueueOcr(job.documentId, job.versionId, job.id);
    } else if (job.currentStep === 'extract') {
      await this.enqueueExtract(job.documentId, job.versionId, job.id);
    } else if (job.currentStep === 'chunk') {
      // Chunk worker expects raw text. Since chunking is the 4th step,
      // we need the text. To make it robust, if text isn't directly cached, we
      // can fallback to re-running the extraction step.
      // So we fallback to enqueueExtract to be safe and retrieve text again.
      await this.enqueueExtract(job.documentId, job.versionId, job.id);
    } else if (job.currentStep === 'embed') {
      await this.enqueueEmbed(job.documentId, job.versionId, job.id);
    } else {
      // Unknown step, start from beginning
      await this.startIngestion(job.documentId, job.versionId);
    }
  }

  async getJobStatus(jobId: string): Promise<DocumentJob> {
    const job = await this.jobRepo.findOne({
      where: { id: jobId },
      relations: ['logs'],
      order: {
        logs: { createdAt: 'ASC' },
      } as any,
    });
    if (!job) {
      throw new NotFoundException(`Không tìm thấy DocumentJob với ID ${jobId}`);
    }
    return job;
  }
}
