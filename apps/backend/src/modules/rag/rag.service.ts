import { Injectable, Logger, OnModuleInit, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { createHash, randomUUID } from 'crypto';
import { extname } from 'path';
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
import { PdfNeedsOcrError } from './parsers/pdf-needs-ocr.error';

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
export class RagService implements OnModuleInit {
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

  async onModuleInit(): Promise<void> {
    // Detect once: does rag_chunks have the pgvector `embedding_vec` column?
    // If yes, the retriever will use native HNSW cosine; otherwise it
    // falls back to JSON-cosine over the `embedding` TEXT column. This
    // lets the system run on plain Postgres without the pgvector package.
    await this.retriever.detectCapabilities();
  }

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
    const sha256 = createHash('sha256').update(buffer).digest('hex');
    await this.checkManifestDuplicate(bucket, sha256);

    const resolvedMime = this.resolveMimeFromBuffer(mimeType, filename);
    const isImage = resolvedMime.startsWith('image/');

    let content = '';
    let isOcr = false;

    if (isImage) {
      isOcr = true;
    } else if (resolvedMime === 'application/pdf') {
      try {
        content = await this.parser.extractText(buffer, resolvedMime, filename);
      } catch (e) {
        if (e instanceof PdfNeedsOcrError) {
          isOcr = true;
        } else {
          throw e;
        }
      }
    } else {
      content = await this.parser.extractText(buffer, resolvedMime, filename);
    }

    if (isOcr) {
      const ocrFilename = filename || 'document.pdf';
      this.logger.log(`Calling FastAPI OCR Service directly for file ${ocrFilename}...`);
      content = await this.callFastApiOcr(buffer, ocrFilename);
    }

    const result = await this.runIngest({
      name: name.trim(),
      content,
      mimeType: isOcr ? 'application/json' : resolvedMime,
      bucket: bucket.trim(),
    }, userId);

    await this.updateManifest(bucket, sha256, {
      name: name.trim(),
      uploadedAt: new Date().toISOString(),
      docId: result.id,
      status: 'ingested',
    });

    return result;
  }

  async enqueueOcr(
    name: string, buffer: Buffer, bucket: string, userId: string, filename?: string
  ): Promise<IIngestResult> {
    if (!this.r2.isEnabled()) throw new Error('R2 is required but client is not initialised');
    const ocrBucket = this.config.get<string>('app.ocr.bucket', '') || process.env.OCR_R2_BUCKET || 'law-ai-rag-ocr';

    const sha256 = createHash('sha256').update(buffer).digest('hex');
    await this.checkManifestDuplicate(bucket, sha256);

    const ext = filename ? extname(filename).toLowerCase() : '.pdf';
    const isImage = ['.png', '.jpg', '.jpeg', '.tiff', '.bmp', '.gif', '.webp'].includes(ext);
    const ocrMimeType = isImage ? this.resolveMimeFromBuffer('image/png', filename) : 'application/pdf';
    const r2Key = `ocr-inbox/${randomUUID()}${ext}`;

    try {
      await this.r2.putObject(ocrBucket, r2Key, buffer, ocrMimeType);
    } catch (e: unknown) {
      throw new Error(`R2 upload failed: ${errorMessage(e)}`);
    }
    const doc = await this.docRepo.save(this.docRepo.create({
      name: name.trim(), r2Key, mimeType: ocrMimeType,
      bucketName: ocrBucket, bucketRegion: 'auto',
      sizeBytes: buffer.length, chunkCount: 0,
      status: RagDocumentStatus.OCR_PENDING, createdBy: userId,
    }));

    await this.updateManifest(bucket, sha256, {
      name: name.trim(),
      uploadedAt: new Date().toISOString(),
      docId: doc.id,
      status: 'ocr_pending',
    });

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

    const finalKey = `rag/${randomUUID()}.json`;
    if (this.r2.isEnabled()) {
      try {
        const jsonContent = JSON.stringify({
          documentId: doc.id,
          name: doc.name,
          text: cleaned,
        }, null, 2);
        await this.r2.putObject(doc.bucketName, finalKey, jsonContent, 'application/json');
        try { await this.r2.deleteObject(doc.bucketName, doc.r2Key); } catch { /* best-effort */ }
        await this.docRepo.update(doc.id, { r2Key: finalKey, mimeType: 'application/json' });
      } catch (e: unknown) {
        this.logger.warn(`Failed to save OCR JSON result to ${finalKey}: ${errorMessage(e)}`);
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

    const docId = randomUUID();
    const isJson = mimeType === 'application/json';
    const r2Key = `rag/${docId}${isJson ? '.json' : '.txt'}`;

    let r2Body = content;
    if (isJson) {
      r2Body = JSON.stringify({
        documentId: docId,
        name,
        text: content,
      }, null, 2);
    }

    try { await this.r2.putObject(bucket, r2Key, r2Body, mimeType); }
    catch (e: unknown) { throw new Error(`R2 upload failed: ${errorMessage(e)}`); }

    const doc = await this.docRepo.save(this.docRepo.create({
      id: docId,
      name, r2Key, mimeType, bucketName: bucket, bucketRegion: 'auto',
      sizeBytes: Buffer.byteLength(r2Body, 'utf8'),
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
    if (ext === '.html' || ext === '.htm') return 'text/html';
    if (ext === '.png') return 'image/png';
    if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
    if (ext === '.tiff') return 'image/tiff';
    if (ext === '.bmp') return 'image/bmp';
    if (ext === '.gif') return 'image/gif';
    if (ext === '.webp') return 'image/webp';
    return 'text/plain';
  }

  private async checkManifestDuplicate(bucket: string, sha256: string): Promise<void> {
    if (!this.r2.isEnabled()) return;
    try {
      const manifestText = await this.r2.getObjectText(bucket, 'manifest.json');
      const manifest = JSON.parse(manifestText);
      if (manifest && manifest[sha256]) {
        throw new ConflictException(
          `Document content already exists in VectorDB (manifest hash match: ${sha256})`
        );
      }
    } catch (e) {
      const errName = (e as any)?.name || (e as any)?.code || '';
      if (errName !== 'NoSuchKey' && errName !== 'NotFound' && !(e instanceof ConflictException)) {
        this.logger.warn(`Failed to read manifest.json: ${errorMessage(e)}`);
      }
      if (e instanceof ConflictException) throw e;
    }
  }

  private async updateManifest(bucket: string, sha256: string, data: any): Promise<void> {
    if (!this.r2.isEnabled()) return;
    let manifest: Record<string, any> = {};
    try {
      const manifestText = await this.r2.getObjectText(bucket, 'manifest.json');
      manifest = JSON.parse(manifestText);
    } catch (e) {
      // ignore
    }
    manifest[sha256] = data;
    try {
      await this.r2.putObject(bucket, 'manifest.json', JSON.stringify(manifest, null, 2), 'application/json');
    } catch (e) {
      this.logger.error(`Failed to update manifest.json in bucket ${bucket}: ${errorMessage(e)}`);
    }
  }

  private async callFastApiOcr(buffer: Buffer, filename: string): Promise<string> {
    const serviceUrl = this.config.get<string>('app.ocr.serviceUrl', '') || process.env.OCR_SERVICE_URL || 'http://127.0.0.1:8000/ocr';

    const formData = new FormData();
    const blob = new Blob([buffer], { type: 'application/octet-stream' });
    formData.append('file', blob, filename);

    try {
      const res = await fetch(serviceUrl, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`FastAPI OCR returned HTTP ${res.status}: ${errorText}`);
      }

      const response = (await res.json()) as { success: boolean; text: string; detail?: string };
      if (!response.success || !response.text) {
        throw new Error(`OCR failed: ${response.detail || 'unknown error'}`);
      }

      return response.text;
    } catch (e) {
      this.logger.error(`Failed to call FastAPI OCR service: ${errorMessage(e)}`);
      throw new Error(`OCR Service Error: ${errorMessage(e)}`);
    }
  }
}
