import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { RagDocument, RagDocumentStatus } from './entities/rag-document.entity';
import { RagChunk } from './entities/rag-chunk.entity';
import { ChunkerService } from './chunking/chunker.service';
import { OpenAIEmbeddingService } from './embedding/openai-embedding.service';
import { RetrieverService, IScoredChunk } from './retrieval/retriever.service';
import { R2Service } from './storage/r2.service';
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
    private readonly embeddings: OpenAIEmbeddingService,
    private readonly retriever: RetrieverService,
    private readonly r2: R2Service,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Ingest a new document:
   *  1) PUT raw content to R2
   *  2) Insert rag_documents (status=pending) → keep id
   *  3) Chunk + embed in batches
   *  4) Insert rag_chunks
   *  5) Update status=ready, chunk_count
   * If embedding fails after R2 upload we mark status=failed and surface
   * the error in the `error` column so the admin can retry / inspect.
   */
  async ingest(dto: CreateRagDocumentDto, userId: string): Promise<IIngestResult> {
    const mimeType = dto.mimeType?.trim() || 'text/plain';
    const r2Key = `rag/${randomUUID()}.txt`;

    // 1) Upload to R2 (best-effort; we keep the row even if R2 is down so
    //    admins see the failure in the `error` column rather than a 500)
    if (this.r2.isEnabled()) {
      try {
        await this.r2.putObject(r2Key, dto.content, mimeType);
      } catch (e: unknown) {
        this.logger.error(`R2 upload failed: ${errorMessage(e)}`);
        throw new Error(`R2 upload failed: ${errorMessage(e)}`);
      }
    } else {
      this.logger.warn('R2 disabled — skipping raw upload (chunks still indexed)');
    }

    // 2) Insert pending row
    const doc = await this.docRepo.save(
      this.docRepo.create({
        name: dto.name.trim(),
        r2Key,
        mimeType,
        sizeBytes: Buffer.byteLength(dto.content, 'utf8'),
        chunkCount: 0,
        status: RagDocumentStatus.PENDING,
        createdBy: userId,
      }),
    );

    try {
      // 3) Chunk
      const chunks = this.chunker.split(dto.content);
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

  async listDocuments(): Promise<RagDocument[]> {
    return this.docRepo.find({ order: { createdAt: 'DESC' } });
  }

  async getDocument(id: string): Promise<RagDocument | null> {
    return this.docRepo.findOne({ where: { id } });
  }

  async deleteDocument(id: string): Promise<void> {
    const doc = await this.docRepo.findOne({ where: { id } });
    if (!doc) return;
    if (this.r2.isEnabled()) {
      try {
        await this.r2.deleteObject(doc.r2Key);
      } catch (e: unknown) {
        this.logger.warn(`R2 delete failed for ${doc.r2Key}: ${errorMessage(e)}`);
      }
    }
    await this.docRepo.delete({ id });
  }

  /** Thin pass-through to the retriever. */
  retrieve(query: string): Promise<IScoredChunk[]> {
    return this.retriever.retrieve(query);
  }
}
