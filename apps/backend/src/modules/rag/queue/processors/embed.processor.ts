import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { DocumentJob, DocumentJobStatus } from '../../entities/document-job.entity';
import { DocumentVersion, DocumentVersionStatus } from '../../entities/document-version.entity';
import { RagDocument, RagDocumentStatus } from '../../entities/rag-document.entity';
import { RagChunk } from '../../entities/rag-chunk.entity';
import { RagQueueService } from '../rag-queue.service';
import { LegalEmbeddingService } from '../../embedding/legal-embedding.service';
import { bulkInsertChunks } from '../../rag-chunk-insert.helper';
import { ProcessingLogLevel } from '../../entities/processing-log.entity';

@Processor('embed', { lockDuration: 300000 })
export class EmbedProcessor extends WorkerHost {
  private readonly logger = new Logger(EmbedProcessor.name);

  constructor(
    @InjectRepository(DocumentJob) private readonly jobRepo: Repository<DocumentJob>,
    @InjectRepository(DocumentVersion) private readonly versionRepo: Repository<DocumentVersion>,
    @InjectRepository(RagDocument) private readonly docRepo: Repository<RagDocument>,
    @InjectRepository(RagChunk) private readonly chunkRepo: Repository<RagChunk>,
    private readonly queueService: RagQueueService,
    private readonly embeddings: LegalEmbeddingService,
    private readonly dataSource: DataSource,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { documentId, versionId, jobId } = job.data;
    const startTime = Date.now();

    await this.jobRepo.update(jobId, {
      status: DocumentJobStatus.PROCESSING,
      progress: 80,
      currentStep: 'embed',
      bullmqJobId: job.id,
    });

    try {
      const doc = await this.docRepo.findOne({ where: { id: documentId } });
      if (!doc) throw new Error(`Không tìm thấy tài liệu ${documentId}`);

      await this.docRepo.update(documentId, { status: RagDocumentStatus.EMBEDDING });

      const version = await this.versionRepo.findOne({ where: { id: versionId } });
      if (!version) throw new Error(`Không tìm thấy phiên bản tài liệu ${versionId}`);

      // 1. Fetch all chunks of this version from DB
      const chunks = await this.chunkRepo.find({ where: { versionId } });
      if (chunks.length === 0) {
        throw new Error('Không tìm thấy chunk nào được lưu tạm cho phiên bản này.');
      }

      await this.queueService.logStep(
        jobId,
        'embed',
        ProcessingLogLevel.INFO,
        `Bắt đầu sinh embedding vectors cho ${chunks.length} chunks.`,
      );

      // 2. Compute vectors
      const vectors = await this.embeddings.embedChunks(chunks as any);
      if (vectors.length !== chunks.length) {
        throw new Error(`Kích thước danh sách vector không khớp: nhận được ${vectors.length} cho ${chunks.length} chunks.`);
      }

      await this.queueService.logStep(
        jobId,
        'embed',
        ProcessingLogLevel.INFO,
        `Tính toán vector nhúng thành công. Tiến hành lưu vector vào cơ sở dữ liệu.`,
      );

      // 3. Update embedding vectors using bulkInsertChunks (which performs upsert)
      await bulkInsertChunks(
        this.dataSource,
        chunks.map((c, idx) => ({
          documentId,
          versionId,
          chunkIndex: c.chunkIndex,
          content: c.content,
          rawText: c.rawText,
          tokenCount: c.tokenCount,
          breadcrumb: c.breadcrumb,
          lawName: c.lawName,
          lawNumber: c.lawNumber,
          chapter: c.chapter,
          section: c.section,
          article: c.article,
          clause: c.clause,
          point: c.point,
          charStart: c.charStart,
          charEnd: c.charEnd,
          embeddingVec: vectors[idx]!,
        })),
      );

      // 4. Activate this version in a transaction
      await this.dataSource.transaction(async (em) => {
        const oldActiveVersionId = doc.activeVersionId;

        // Update document status & active version pointer
        await em.update(RagDocument, documentId, {
          status: RagDocumentStatus.READY,
          activeVersionId: versionId,
          chunkCount: version.chunkCount,
        });

        // Update version status
        await em.update(DocumentVersion, versionId, {
          status: DocumentVersionStatus.READY,
        });

        // Update job status to completed
        await em.update(DocumentJob, jobId, {
          status: DocumentJobStatus.COMPLETED,
          progress: 100,
        });

        // If there was a previous version, clean up its chunks to save database space
        if (oldActiveVersionId && oldActiveVersionId !== versionId) {
          await em.query('DELETE FROM rag_chunks WHERE version_id = $1', [oldActiveVersionId]);
          await em.update(DocumentVersion, oldActiveVersionId, {
            status: DocumentVersionStatus.FAILED, // Mark as replaced/inactive
            error: 'Được thay thế bởi phiên bản mới.',
          });
        }
      });

      const durationMs = Date.now() - startTime;
      await this.queueService.logStep(
        jobId,
        'embed',
        ProcessingLogLevel.INFO,
        'Tiến trình ingestion hoàn tất thành công. Tài liệu đã sẵn sàng để truy vấn.',
        durationMs,
      );

      return { success: true };
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      const errMsg = error.message || String(error);
      this.logger.error(`Lỗi trong bước tính toán embedding: ${errMsg}`);

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
        'embed',
        ProcessingLogLevel.ERROR,
        `Lỗi tính toán embedding: ${errMsg}`,
        durationMs,
      );

      throw error;
    }
  }
}
