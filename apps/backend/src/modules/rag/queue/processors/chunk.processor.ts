import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { DocumentJob, DocumentJobStatus } from '../../entities/document-job.entity';
import { DocumentVersion, DocumentVersionStatus } from '../../entities/document-version.entity';
import {
  RagDocument,
  RagDocumentStatus,
  RagDocumentType,
  RagLegalStatus,
} from '../../entities/rag-document.entity';
import { RagQueueService } from '../rag-queue.service';
import { LegalHierarchicalChunkerService } from '../../chunking/legal-hierarchical-chunker.service';
import {
  MetadataEnricherService,
  IEnrichmentResult,
} from '../../parsers/metadata-enricher.service';
import { ReferenceExtractorService } from '../../parsers/reference-extractor.service';
import { bulkInsertChunks } from '../../rag-chunk-insert.helper';
import { ProcessingLogLevel } from '../../entities/processing-log.entity';

@Processor('chunk', { lockDuration: 300000 })
export class ChunkProcessor extends WorkerHost {
  private readonly logger = new Logger(ChunkProcessor.name);

  constructor(
    @InjectRepository(DocumentJob) private readonly jobRepo: Repository<DocumentJob>,
    @InjectRepository(DocumentVersion) private readonly versionRepo: Repository<DocumentVersion>,
    @InjectRepository(RagDocument) private readonly docRepo: Repository<RagDocument>,
    private readonly queueService: RagQueueService,
    private readonly chunker: LegalHierarchicalChunkerService,
    private readonly enricher: MetadataEnricherService,
    private readonly refExtractor: ReferenceExtractorService,
    private readonly dataSource: DataSource,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { documentId, versionId, jobId, text } = job.data;
    const startTime = Date.now();

    await this.jobRepo.update(jobId, {
      status: DocumentJobStatus.PROCESSING,
      progress: 55,
      currentStep: 'chunk',
      bullmqJobId: job.id,
    });

    try {
      const doc = await this.docRepo.findOne({ where: { id: documentId } });
      if (!doc) throw new Error(`Không tìm thấy tài liệu ${documentId}`);

      const version = await this.versionRepo.findOne({ where: { id: versionId } });
      if (!version) throw new Error(`Không tìm thấy phiên bản tài liệu ${versionId}`);

      // 1. Parallel: Extract legal references and enrich metadata using LLM
      await this.queueService.logStep(
        jobId,
        'chunk',
        ProcessingLogLevel.INFO,
        'Đang phân tích cấu trúc pháp lý và làm giàu metadata bằng AI.',
      );
      const [refs, enrichment] = await Promise.all([
        Promise.resolve(this.refExtractor.extract(text)),
        this.enricher.enrich({
          documentName: doc.name,
          fullText: text,
          sourceUrl: doc.sourceUrl ?? undefined,
        }),
      ]);

      // Update document metadata in DB
      await this.docRepo.update(documentId, {
        status: RagDocumentStatus.CHUNKING,
        documentType: enrichment.documentType ?? RagDocumentType.VANBAN_KHAC,
        lawName: enrichment.lawName,
        lawNumber: enrichment.lawNumber,
        issuer: enrichment.issuer,
        issuedDate: enrichment.issuedDate,
        effectiveDate: enrichment.effectiveDate,
        expiryDate: enrichment.expiryDate,
        legalStatus: enrichment.legalStatus ?? RagLegalStatus.KHONG_XAC_DINH,
        extraMetadata: enrichment.extraMetadata as any,
      });

      // 2. Perform chunking
      await this.queueService.logStep(
        jobId,
        'chunk',
        ProcessingLogLevel.INFO,
        'Bắt đầu chia nhỏ văn bản theo quy chuẩn Điều/Khoản/Điểm.',
      );
      const lawName = enrichment.lawName ?? doc.name;
      const chunks = this.chunker.chunk(text, lawName, enrichment.lawNumber ?? undefined);

      if (chunks.length === 0) {
        throw new Error('Bộ chia nhỏ văn bản (Chunker) không tạo ra chunk nào (tệp rỗng?).');
      }

      await this.queueService.logStep(
        jobId,
        'chunk',
        ProcessingLogLevel.INFO,
        `Tạo ra ${chunks.length} chunks. Tiến hành lưu tạm vào cơ sở dữ liệu.`,
      );

      // 3. Delete existing chunks of this version (idempotency)
      await this.dataSource.query('DELETE FROM rag_chunks WHERE version_id = $1', [versionId]);

      // 4. Bulk insert chunks without vector embeddings
      await bulkInsertChunks(
        this.dataSource,
        chunks.map((c) => ({
          documentId,
          versionId,
          chunkIndex: c.chunkIndex,
          content: c.content,
          rawText: c.rawText,
          tokenCount: c.tokenCount,
          breadcrumb: c.breadcrumb,
          lawName: c.lawName,
          lawNumber: c.lawNumber ?? null,
          chapter: c.chapter ?? null,
          section: c.section ?? null,
          article: c.article,
          clause: c.clause ?? null,
          point: c.point ?? null,
          charStart: c.charStart,
          charEnd: c.charEnd,
          embeddingVec: null, // Empty for now, will be updated by embedding worker
        })),
      );

      // Update version chunk count
      await this.versionRepo.update(versionId, {
        chunkCount: chunks.length,
      });

      const durationMs = Date.now() - startTime;
      await this.queueService.logStep(
        jobId,
        'chunk',
        ProcessingLogLevel.INFO,
        `Hoàn thành bước chia nhỏ văn bản. Chunks: ${chunks.length}, References: ${refs.length}.`,
        durationMs,
      );

      // Route to embedding queue
      await this.queueService.enqueueEmbed(documentId, versionId, jobId);

      return { chunksCount: chunks.length };
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      const errMsg = error.message || String(error);
      this.logger.error(`Lỗi trong bước phân đoạn văn bản: ${errMsg}`);

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
        'chunk',
        ProcessingLogLevel.ERROR,
        `Lỗi phân đoạn văn bản: ${errMsg}`,
        durationMs,
      );

      throw error;
    }
  }
}
