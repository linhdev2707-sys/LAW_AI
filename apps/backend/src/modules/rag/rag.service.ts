import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { RagDocument, RagDocumentStatus } from './entities/rag-document.entity';
import { RagChunk } from './entities/rag-chunk.entity';
import { ChunkerService } from './chunking/chunker.service';
import { LocalEmbeddingService } from './embedding/local-embedding.service';
import { RetrieverService, IScoredChunk } from './retrieval/retriever.service';
import { R2Service } from './storage/r2.service';
import { DocumentParserService } from './parsers/document-parser.service';
import { CreateRagDocumentDto } from './dto/create-rag-document.dto';

export interface IIngestResult {
  id: string;
  chunkCount: number;
  status: RagDocumentStatus;
}

function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  constructor(
    @InjectRepository(RagDocument)
    private readonly docRepo: Repository<RagDocument>,
    @InjectRepository(RagChunk)
    private readonly chunkRepo: Repository<RagChunk>,
    private readonly chunker: ChunkerService,
    private readonly embeddings: LocalEmbeddingService,
    private readonly retriever: RetrieverService,
    private readonly r2: R2Service,
    private readonly parser: DocumentParserService,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  /**
   * Ingest from a plain-text DTO. Used by the JSON endpoint.
   * Throws on any failure — caller is responsible for HTTP error mapping.
   */
  ingest(dto: CreateRagDocumentDto, userId: string): Promise<IIngestResult> {
    const mimeType = dto.mimeType?.trim() || 'text/plain';
    return this.runIngest(
      {
        name: dto.name.trim(),
        content: dto.content,
        mimeType,
        bucket: dto.bucket.trim(),
        sourceKind: 'text',
      },
      userId,
    );
  }

  /**
   * Ingest from an uploaded file buffer. The parser extracts plain text
   * first, then the same pipeline as the JSON path takes over.
   */
  async ingestBuffer(
    name: string,
    buffer: Buffer,
    mimeType: string,
    filename: string | undefined,
    bucket: string,
    userId: string,
  ): Promise<IIngestResult> {
    const content = await this.parser.extractText(buffer, mimeType, filename);
    // Use the parser-resolved mime type for R2 storage so the file
    // round-trips with a useful Content-Type on download.
    const resolvedMime = this.resolveMimeFromBuffer(mimeType, filename);
    return this.runIngest(
      {
        name: name.trim(),
        content,
        mimeType: resolvedMime,
        bucket: bucket.trim(),
        sourceKind: 'file',
      },
      userId,
    );
  }

  /**
   * Stash a scanned PDF in R2 and create an `ocr_pending` row so the
   * Cloudflare Worker can pick it up via R2 Event Notification and
   * stream the OCR result back via the callback endpoint.
   *
   * Returns the same shape as the regular ingest path but with
   * `status: 'ocr_pending'` and `chunkCount: 0` so callers can show a
   * "processing" UI state.
   */
  async enqueueOcr(
    name: string,
    buffer: Buffer,
    bucket: string,
    userId: string,
  ): Promise<IIngestResult> {
    if (!this.r2.isEnabled()) {
      throw new Error('R2 is required but client is not initialised');
    }
    // The OCR Worker reads from a *dedicated* bucket (default
    // `law-ai-rag-ocr`), separate from the regular RAG bucket
    // (`law-ai-rag`). We must write the inbox PDF to the bucket the
    // Worker is actually watching, otherwise the cron tick sees zero
    // objects and the document stays in `ocr_pending` forever. The
    // `bucket` arg from the controller is the user's RAG bucket and
    // is only used downstream when we copy the extracted text — not
    // here.
    const ocrBucket =
      this.config.get<string>('app.ocr.bucket', '') ||
      process.env.OCR_R2_BUCKET ||
      'law-ai-rag-ocr';
    const r2Key = `ocr-inbox/${randomUUID()}.pdf`;
    try {
      await this.r2.putObject(ocrBucket, r2Key, buffer, 'application/pdf');
    } catch (e: unknown) {
      this.logger.error(`R2 upload failed (bucket=${ocrBucket}, key=${r2Key}): ${errorMessage(e)}`);
      throw new Error(`R2 upload failed: ${errorMessage(e)}`);
    }

    const doc = await this.docRepo.save(
      this.docRepo.create({
        name: name.trim(),
        r2Key,
        mimeType: 'application/pdf',
        bucketName: ocrBucket,
        bucketRegion: 'auto',
        sizeBytes: buffer.length,
        chunkCount: 0,
        status: RagDocumentStatus.OCR_PENDING,
        createdBy: userId,
      }),
    );

    this.logger.log(
      `Enqueued OCR for doc ${doc.id} (name="${name}", ocrBucket=${ocrBucket}, bytes=${buffer.length})`,
    );

    return {
      id: doc.id,
      chunkCount: 0,
      status: RagDocumentStatus.OCR_PENDING,
    };
  }

  /**
   * Handle the Worker's callback once OCR finishes. We:
   *  - look up the document (must still be `ocr_pending`),
   *  - upload the extracted text to a stable R2 key,
   *  - chunk + embed + insert chunks in a transaction,
   *  - flip status to `ready`.
   *
   * Idempotency: a second call for the same `documentId` returns 409
   * instead of double-chunking.
   */
  async completeOcr(documentId: string, text: string): Promise<IIngestResult> {
    const doc = await this.docRepo.findOne({ where: { id: documentId } });
    if (!doc) {
      throw new Error(`RagDocument ${documentId} not found`);
    }
    if (doc.status !== RagDocumentStatus.OCR_PENDING) {
      // Don't allow late callbacks to clobber a finished doc, and don't
      // double-chunk. Callers map this to 409.
      throw new Error(
        `RagDocument ${documentId} is in status "${doc.status}", cannot complete OCR`,
      );
    }

    const cleaned = text.replace(/\r\n/g, '\n').trim();
    if (!cleaned) {
      throw new Error('OCR returned empty text');
    }

    // Move the artifact from the inbox prefix to the standard `rag/` key
    // so future downloads / RAG inspection use the same key shape as
    // sync-ingested documents. We do a server-side copy first (cheap),
    // then delete the inbox copy. If the copy fails we still continue —
    // chunking is the source of truth, the inbox key is just staging.
    const finalKey = `rag/${randomUUID()}.txt`;
    if (this.r2.isEnabled()) {
      try {
        await this.r2.copyObject(doc.bucketName, doc.r2Key, finalKey, 'text/plain');
        try {
          await this.r2.deleteObject(doc.bucketName, doc.r2Key);
        } catch (e: unknown) {
          this.logger.warn(
            `Failed to delete OCR inbox object ${doc.bucketName}/${doc.r2Key}: ${errorMessage(e)}`,
          );
        }
        await this.docRepo.update(doc.id, { r2Key: finalKey });
      } catch (e: unknown) {
        this.logger.warn(
          `Failed to copy OCR result to ${finalKey}, keeping inbox key: ${errorMessage(e)}`,
        );
      }
    }

    return this.chunkAndEmbed(doc, cleaned);
  }

  /**
   * Shared pipeline used by both `runIngest` and `completeOcr`:
   *  1) Insert rag_documents (status=pending) → keep id  [skipped — caller passes existing doc]
   *  2) Chunk + embed in batches
   *  3) Insert rag_chunks
   *  4) Update status=ready, chunk_count
   * If embedding fails we mark status=failed and surface the error in
   * the `error` column so the admin can retry / inspect.
   */
  private async chunkAndEmbed(doc: RagDocument, content: string): Promise<IIngestResult> {
    try {
      const chunks = this.chunker.split(content);
      if (chunks.length === 0) {
        throw new Error('Document produced zero chunks (empty content?)');
      }

      const vectors = await this.embeddings.embedBatch(chunks);
      if (vectors.length !== chunks.length) {
        throw new Error(
          `Embedding count mismatch: got ${vectors.length} for ${chunks.length} chunks`,
        );
      }

      await this.dataSource.transaction(async (em) => {
        const chunkRepo = em.getRepository(RagChunk);
        const docRepo = em.getRepository(RagDocument);
        const rows = chunks.map((content, idx) =>
          chunkRepo.create({
            documentId: doc.id,
            chunkIndex: idx,
            content,
            tokenCount: this.chunker.countTokens(content),
            embedding: JSON.stringify(vectors[idx]),
          }),
        );
        await chunkRepo.createQueryBuilder().insert().values(rows).execute();
        await docRepo.update(doc.id, {
          status: RagDocumentStatus.READY,
          chunkCount: chunks.length,
          error: null,
        });
      });

      return {
        id: doc.id,
        chunkCount: chunks.length,
        status: RagDocumentStatus.READY,
      };
    } catch (e: unknown) {
      this.logger.error(`Ingest failed for ${doc.id}: ${errorMessage(e)}`);
      await this.docRepo.update(doc.id, {
        status: RagDocumentStatus.FAILED,
        error: errorMessage(e).slice(0, 1000),
      });
      throw e;
    }
  }

  /**
   * Shared pipeline used by both `ingest` and `ingestBuffer`:
   *  1) PUT raw content to R2 (mandatory — R2 is required by config)
   *  2) Insert rag_documents (status=pending) → keep id
   *  3) Chunk + embed in batches
   *  4) Insert rag_chunks
   *  5) Update status=ready, chunk_count
   * If embedding fails after R2 upload we mark status=failed and surface
   * the error in the `error` column so the admin can retry / inspect.
   */
  private async runIngest(
    input: {
      name: string;
      content: string;
      mimeType: string;
      bucket: string;
      sourceKind: 'text' | 'file';
    },
    userId: string,
  ): Promise<IIngestResult> {
    const { name, content, mimeType, bucket, sourceKind } = input;
    const r2Key = `rag/${randomUUID()}.txt`;

    // 1) Upload to R2 (mandatory). If R2 is misconfigured or the bucket
    //    doesn't exist (and we forgot to create it), throw — better to
    //    surface a 500/503 here than to leave the chunk index in an
    //    inconsistent state.
    if (!this.r2.isEnabled()) {
      // Should not happen — onModuleInit throws if credentials are missing.
      throw new Error('R2 is required but client is not initialised');
    }
    try {
      await this.r2.putObject(bucket, r2Key, content, mimeType);
    } catch (e: unknown) {
      this.logger.error(`R2 upload failed (bucket=${bucket}, key=${r2Key}): ${errorMessage(e)}`);
      throw new Error(`R2 upload failed: ${errorMessage(e)}`);
    }

    // 2) Insert pending row
    const doc = await this.docRepo.save(
      this.docRepo.create({
        name,
        r2Key,
        mimeType,
        bucketName: bucket,
        bucketRegion: 'auto',
        sizeBytes: Buffer.byteLength(content, 'utf8'),
        chunkCount: 0,
        status: RagDocumentStatus.PENDING,
        createdBy: userId,
      }),
    );

    this.logger.log(
      `Ingesting ${sourceKind} doc ${doc.id} (name="${name}", bucket=${bucket}, bytes=${doc.sizeBytes})`,
    );

    // 3-5) Reuse the shared chunk+embed path so sync and OCR-completion
    //      stay in lock-step.
    return this.chunkAndEmbed(doc, content);
  }

  /**
   * Mirror of DocumentParserService.resolveMimeType — duplicated here so
   * we can pick the right MIME for R2 storage without exposing the parser
   * just for this. Keep in sync with parser.service.ts.
   */
  private resolveMimeFromBuffer(mimeType: string, filename?: string): string {
    if (mimeType && mimeType !== 'application/octet-stream') return mimeType;
    if (!filename) return 'text/plain';
    const dot = filename.lastIndexOf('.');
    if (dot < 0) return 'text/plain';
    const ext = filename.slice(dot).toLowerCase();
    if (ext === '.pdf') return 'application/pdf';
    if (ext === '.docx')
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (ext === '.doc') return 'application/msword';
    if (ext === '.md' || ext === '.markdown') return 'text/markdown';
    if (ext === '.txt') return 'text/plain';
    return 'text/plain';
  }

  async listDocuments(): Promise<RagDocument[]> {
    return this.docRepo.find({ order: { createdAt: 'DESC' } });
  }

  async getDocument(id: string): Promise<RagDocument | null> {
    return this.docRepo.findOne({ where: { id } });
  }

  async deleteDocument(id: string): Promise<void> {
    const doc = await this.docRepo.findOne({ where: { id } });
    if (!doc) return;
    // Delete the object in the document's own bucket. We don't delete the
    // bucket itself — that's an admin operation managed elsewhere.
    if (this.r2.isEnabled()) {
      try {
        await this.r2.deleteObject(doc.bucketName, doc.r2Key);
      } catch (e: unknown) {
        this.logger.warn(`R2 delete failed for ${doc.bucketName}/${doc.r2Key}: ${errorMessage(e)}`);
      }
    }
    await this.docRepo.delete({ id });
  }

  /**
   * Bulk delete — runs deletes sequentially so a failure on one doc
   * doesn't blow up the whole batch and leave the caller with no info
   * about what was/wasn't removed. Returns a per-id outcome so the FE
   * can surface partial failures in a toast.
   *
   * We DO NOT wrap this in a transaction: R2 deletes are best-effort
   * outside the DB anyway (a failure there is logged and swallowed),
   * and a single Postgres transaction holding row locks across N
   * documents would just create contention for no real gain.
   */
  async deleteDocuments(
    ids: string[],
  ): Promise<{ id: string; ok: boolean; error?: string }[]> {
    const results: { id: string; ok: boolean; error?: string }[] = [];
    for (const id of ids) {
      try {
        await this.deleteDocument(id);
        results.push({ id, ok: true });
      } catch (e: unknown) {
        results.push({ id, ok: false, error: errorMessage(e) });
      }
    }
    this.logger.log(
      `Bulk delete: ${results.filter((r) => r.ok).length}/${results.length} succeeded`,
    );
    return results;
  }

  // ─── Bucket helpers (thin pass-through to R2Service) ─────────────────

  async listActiveBuckets(): Promise<string[]> {
    const rows = await this.docRepo
      .createQueryBuilder('doc')
      .select('DISTINCT doc.bucket_name', 'bucketName')
      .where('doc.status = :status', { status: RagDocumentStatus.READY })
      .getRawMany<{ bucketName: string }>();
    return rows.map((r) => r.bucketName).filter(Boolean);
  }

  listBuckets(): Promise<string[]> {
    if (!this.r2.isEnabled()) return Promise.resolve([]);
    return this.r2.listBuckets();
  }

  createBucket(name: string, region?: string): Promise<void> {
    return this.r2.createBucket(name, region);
  }

  /** Thin pass-through to the retriever. */
  retrieve(query: string, bucketName?: string): Promise<IScoredChunk[]> {
    return this.retriever.retrieve(query, bucketName);
  }
}
