import { Injectable, Logger } from '@nestjs/common';
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

    try {
      // 3) Chunk
      const chunks = this.chunker.split(content);
      if (chunks.length === 0) {
        throw new Error('Document produced zero chunks (empty content?)');
      }

      // 4) Embed
      const vectors = await this.embeddings.embedBatch(chunks);
      if (vectors.length !== chunks.length) {
        throw new Error(
          `Embedding count mismatch: got ${vectors.length} for ${chunks.length} chunks`,
        );
      }

      // 5) Insert chunks + mark ready (in a single transaction)
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
        });
      });

      return { id: doc.id, chunkCount: chunks.length };
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
