import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import {
  RagDocument, RagDocumentStatus, RagDocumentType, RagLegalStatus,
} from './entities/rag-document.entity';
import { RagChunk } from './entities/rag-chunk.entity';
import { LegalHierarchicalChunkerService, ILegalChunk } from './chunking/legal-hierarchical-chunker.service';
import { LegalEmbeddingService } from './embedding/legal-embedding.service';
import { RetrieverService, IScoredChunk, IRetrieverFilters } from './retrieval/retriever.service';
import { R2Service } from './storage/r2.service';
import { DocumentParserService } from './parsers/document-parser.service';
import { MetadataEnricherService, IEnrichmentResult } from './parsers/metadata-enricher.service';
import { ReferenceExtractorService, IExtractedReference } from './parsers/reference-extractor.service';
import { LegalStructureParser } from './parsers/legal-structure.parser';
import { CreateRagDocumentDto } from './dto/create-rag-document.dto';
import { bulkInsertChunks } from './rag-chunk-insert.helper';

export interface IIngestResult {
  id: string;
  chunkCount: number;
  status: RagDocumentStatus;
  lawName?: string | null;
  lawNumber?: string | null;
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  constructor(
    @InjectRepository(RagDocument) private readonly docRepo: Repository<RagDocument>,
    @InjectRepository(RagChunk)    private readonly chunkRepo: Repository<RagChunk>,
    private readonly chunker: LegalHierarchicalChunkerService,
    private readonly embeddings: LegalEmbeddingService,
    private readonly retriever: RetrieverService,
    private readonly r2: R2Service,
    private readonly parser: DocumentParserService,
    private readonly enricher: MetadataEnricherService,
    private readonly refExtractor: ReferenceExtractorService,
    private readonly structureParser: LegalStructureParser,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  // ─── Public API ─────────────────────────────────────────────────────

  ingest(dto: CreateRagDocumentDto, userId: string): Promise<IIngestResult> {
    return this.runIngest({
      name: dto.name.trim(),
      content: dto.content,
      mimeType: dto.mimeType?.trim() || 'text/plain',
      bucket: dto.bucket.trim(),
      sourceUrl: dto.sourceUrl,
    }, userId);
  }

  async ingestBuffer(
    name: string, buffer: Buffer, mimeType: string,
    filename: string | undefined, bucket: string, userId: string,
  ): Promise<IIngestResult> {
    const content = await this.parser.extractText(buffer, mimeType, filename);
    const resolvedMime = this.resolveMimeFromBuffer(mimeType, filename);
    return this.runIngest({
      name: name.trim(), content, mimeType: resolvedMime, bucket: bucket.trim(),
    }, userId);
  }

  async enqueueOcr(name: string, buffer: Buffer, bucket: string, userId: string): Promise<IIngestResult> {
    if (!this.r2.isEnabled()) throw new Error('R2 is required but client is not initialised');
    const ocrBucket = this.config.get<string>('app.ocr.bucket', '') || process.env.OCR_R2_BUCKET || 'law-ai-rag-ocr';
    const r2Key = `ocr-inbox/${randomUUID()}.pdf`;
    try {
      await this.r2.putObject(ocrBucket, r2Key, buffer, 'application/pdf');
    } catch (e: unknown) {
      throw new Error(`R2 upload failed: ${errorMessage(e)}`);
    }
    const doc = await this.docRepo.save(this.docRepo.create({
      name: name.trim(), r2Key, mimeType: 'application/pdf',
      bucketName: ocrBucket, bucketRegion: 'auto',
      sizeBytes: buffer.length, chunkCount: 0,
      status: RagDocumentStatus.OCR_PENDING, createdBy: userId,
    }));
    return { id: doc.id, chunkCount: 0, status: RagDocumentStatus.OCR_PENDING };
  }

  async completeOcr(documentId: string, text?: string, error?: string): Promise<IIngestResult> {
    const doc = await this.docRepo.findOne({ where: { id: documentId } });
    if (!doc) throw new Error(`RagDocument ${documentId} not found`);
    if (doc.status !== RagDocumentStatus.OCR_PENDING) {
      throw new Error(`RagDocument ${documentId} is in status "${doc.status}", cannot complete OCR`);
    }
    if (error) {
      await this.docRepo.update(doc.id, { status: RagDocumentStatus.FAILED, error: error.slice(0, 1000) });
      if (this.r2.isEnabled()) {
        try { await this.r2.deleteObject(doc.bucketName, doc.r2Key); } catch { /* best-effort */ }
      }
      return { id: doc.id, chunkCount: 0, status: RagDocumentStatus.FAILED };
    }
    const cleaned = text ? text.replace(/\r\n/g, '\n').trim() : '';
    if (!cleaned) throw new Error('OCR returned empty text');

    const finalKey = `rag/${randomUUID()}.txt`;
    if (this.r2.isEnabled()) {
      try {
        await this.r2.copyObject(doc.bucketName, doc.r2Key, finalKey, 'text/plain');
        try { await this.r2.deleteObject(doc.bucketName, doc.r2Key); } catch { /* best-effort */ }
        await this.docRepo.update(doc.id, { r2Key: finalKey });
      } catch (e: unknown) {
        this.logger.warn(`Failed to copy OCR result to ${finalKey}: ${errorMessage(e)}`);
      }
    }
    return this.runIngestOnExisting(doc, cleaned);
  }

  listDocuments(): Promise<RagDocument[]> { return this.docRepo.find({ order: { createdAt: 'DESC' } }); }
  getDocument(id: string): Promise<RagDocument | null> { return this.docRepo.findOne({ where: { id } }); }

  async deleteDocument(id: string): Promise<void> {
    const doc = await this.docRepo.findOne({ where: { id } });
    if (!doc) return;
    if (this.r2.isEnabled()) {
      try { await this.r2.deleteObject(doc.bucketName, doc.r2Key); }
      catch (e: unknown) { this.logger.warn(`R2 delete failed: ${errorMessage(e)}`); }
    }
    await this.docRepo.delete({ id });
  }

  async deleteDocuments(ids: string[]) {
    const results: { id: string; ok: boolean; error?: string }[] = [];
    for (const id of ids) {
      try { await this.deleteDocument(id); results.push({ id, ok: true }); }
      catch (e: unknown) { results.push({ id, ok: false, error: errorMessage(e) }); }
    }
    return results;
  }

  retrieve(query: string, filters?: IRetrieverFilters): Promise<IScoredChunk[]> {
    return this.retriever.retrieve(query, filters ?? {});
  }

  listActiveBuckets(): Promise<string[]> {
    return this.docRepo.createQueryBuilder('doc')
      .select('DISTINCT doc.bucket_name', 'bucketName')
      .where('doc.status = :status', { status: RagDocumentStatus.READY })
      .getRawMany<{ bucketName: string }>()
      .then((rows) => rows.map((r) => r.bucketName).filter(Boolean));
  }
  listBuckets(): Promise<string[]> {
    return this.r2.isEnabled() ? this.r2.listBuckets() : Promise.resolve([]);
  }
  createBucket(name: string, region?: string): Promise<void> { return this.r2.createBucket(name, region); }

  // ─── Private: ingest pipeline ───────────────────────────────────────

  private async runIngest(
    input: { name: string; content: string; mimeType: string; bucket: string; sourceUrl?: string },
    userId: string,
  ): Promise<IIngestResult> {
    const { name, content, mimeType, bucket, sourceUrl } = input;
    if (!this.r2.isEnabled()) throw new Error('R2 is required but client is not initialised');

    const r2Key = `rag/${randomUUID()}.txt`;
    try { await this.r2.putObject(bucket, r2Key, content, mimeType); }
    catch (e: unknown) { throw new Error(`R2 upload failed: ${errorMessage(e)}`); }

    const doc = await this.docRepo.save(this.docRepo.create({
      name, r2Key, mimeType, bucketName: bucket, bucketRegion: 'auto',
      sizeBytes: Buffer.byteLength(content, 'utf8'),
      chunkCount: 0, status: RagDocumentStatus.PENDING, createdBy: userId,
      sourceUrl: sourceUrl ?? null,
    }));
    return this.runIngestOnExisting(doc, content);
  }

  private async runIngestOnExisting(doc: RagDocument, content: string): Promise<IIngestResult> {
    try {
      // 1) Status: parsing
      await this.docRepo.update(doc.id, { status: RagDocumentStatus.PARSING });

      // 2) Extract references + enrich metadata (parallel)
      const refs = this.refExtractor.extract(content);
      const enrichment = await this.enricher.enrich({
        documentName: doc.name, fullText: content, sourceUrl: doc.sourceUrl,
      });

      // 3) Persist legal metadata on the document
      await this.docRepo
        .createQueryBuilder()
        .update()
        .set(this.toDocPatch(enrichment) as any)
        .where('id = :id', { id: doc.id })
        .execute();

      // 4) Status: chunking
      await this.docRepo.update(doc.id, { status: RagDocumentStatus.CHUNKING });

      const lawName = enrichment.lawName ?? doc.name;
      const chunks = this.chunker.chunk(content, lawName, enrichment.lawNumber ?? undefined);

      if (chunks.length === 0) throw new Error('Chunker produced zero chunks (empty content?)');

      // 5) Stamp chunk ids + document id
      for (const c of chunks) { c.documentId = doc.id; }

      // 6) Status: embedding
      await this.docRepo.update(doc.id, { status: RagDocumentStatus.EMBEDDING });

      const vectors = await this.embeddings.embedChunks(chunks);
      if (vectors.length !== chunks.length) {
        throw new Error(`Embedding count mismatch: got ${vectors.length} for ${chunks.length} chunks`);
      }

      // 7) Persist chunks + finalize document status
      await this.dataSource.transaction(async (em) => {
        const docRepo = em.getRepository(RagDocument);
        await bulkInsertChunks(this.dataSource, chunks.map((c, idx) => ({
          documentId: doc.id,
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
          embeddingVec: vectors[idx]!,
        })));
        await docRepo.update(doc.id, {
          status: RagDocumentStatus.READY,
          chunkCount: chunks.length,
          error: null,
        });
      });

      this.logger.log(
        `Ingested doc ${doc.id} (name="${doc.name}", law="${enrichment.lawName ?? '?'}", ` +
        `chunks=${chunks.length}, refs=${refs.length})`,
      );

      return {
        id: doc.id, chunkCount: chunks.length, status: RagDocumentStatus.READY,
        lawName: enrichment.lawName, lawNumber: enrichment.lawNumber,
      };
    } catch (e: unknown) {
      this.logger.error(`Ingest failed for ${doc.id}: ${errorMessage(e)}`);
      await this.docRepo.update(doc.id, {
        status: RagDocumentStatus.FAILED, error: errorMessage(e).slice(0, 1000),
      });
      throw e;
    }
  }

  private toDocPatch(e: IEnrichmentResult): Partial<RagDocument> {
    return {
      documentType: e.documentType,
      lawName: e.lawName,
      lawNumber: e.lawNumber,
      issuer: e.issuer,
      issuedDate: e.issuedDate,
      effectiveDate: e.effectiveDate,
      expiryDate: e.expiryDate,
      legalStatus: e.legalStatus,
      // jsonb column accepts any JSON-serialisable value; the strict
      // `_QueryDeepPartialEntity` type doesn't model this directly.
      extraMetadata: e.extraMetadata as never,
    };
  }

  private resolveMimeFromBuffer(mimeType: string, filename?: string): string {
    if (mimeType && mimeType !== 'application/octet-stream') return mimeType;
    if (!filename) return 'text/plain';
    const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
    if (ext === '.pdf') return 'application/pdf';
    if (ext === '.docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (ext === '.doc') return 'application/msword';
    if (ext === '.md' || ext === '.markdown') return 'text/markdown';
    return 'text/plain';
  }
}
