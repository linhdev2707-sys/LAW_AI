import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { RagChunk } from '../entities/rag-chunk.entity';
import { RagDocument } from '../entities/rag-document.entity';
import { RagDocumentStatus } from '../entities/rag-document.entity';
import { LocalEmbeddingService } from '../embedding/local-embedding.service';
import { reciprocalRankFusion } from './reciprocal-rank-fusion';

export interface IScoredChunk {
  id: string;
  documentId: string;
  documentName: string;
  content: string;
  index: number; // 1-based rank in the merged list
  score: number;
}

interface IChunkWithEmbedding {
  id: string;
  documentId: string;
  documentName: string;
  content: string;
  embedding: number[];
  /** Cosine similarity with the query (set by the retriever). */
  cosineScore: number;
}

@Injectable()
export class RetrieverService {
  private readonly logger = new Logger(RetrieverService.name);
  private readonly candidateK: number;
  private readonly topK: number;
  private readonly fusionK: number;
  /** Cosine floor  chunks below this are dropped before slicing topK. */
  private readonly minCosineScore: number;
  /** Optional bucket whitelist. Empty = no filter. */
  private readonly allowedBuckets: readonly string[];

  constructor(
    config: ConfigService,
    private readonly embeddings: LocalEmbeddingService,
    @InjectRepository(RagChunk)
    private readonly chunkRepo: Repository<RagChunk>,
    @InjectRepository(RagDocument)
    private readonly docRepo: Repository<RagDocument>,
    private readonly dataSource: DataSource,
  ) {
    this.candidateK = config.get<number>('app.rag.candidateK', 50);
    this.topK = config.get<number>('app.rag.topK', 5);
    this.fusionK = config.get<number>('app.rag.fusionK', 60);
    this.minCosineScore = config.get<number>('app.rag.minCosineScore', 0.35);
    this.allowedBuckets = config.get<string[]>('app.rag.allowedBuckets', []);
  }

  /**
   * Hybrid retrieval: cosine (Node-side, in-memory) + BM25/tsvector
   * (Postgres full-text), merged with Reciprocal Rank Fusion.
   */
  async retrieve(query: string, bucketName?: string): Promise<IScoredChunk[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];
    if (!this.embeddings.isReady()) {
      this.logger.warn('Embeddings not ready — returning empty retrieval');
      return [];
    }

    const searchBuckets = bucketName ? [bucketName] : this.allowedBuckets;

    // 1) Embed query
    const qVecs = await this.embeddings.embedBatch([trimmed]);
    const qVec = qVecs[0];
    if (!qVec) return [];

    // 2) Load candidate chunks with their embeddings (status=ready only)
    const rows = await this.dataSource.query<
      Array<{
        id: string;
        document_id: string;
        document_name: string;
        content: string;
        embedding: string;
      }>
    >(
      `
      SELECT c.id,
             c.document_id,
             c.content,
             d.name AS document_name,
             c.embedding
        FROM rag_chunks c
        JOIN rag_documents d ON d.id = c.document_id
       WHERE d.status = $1
         AND (cardinality($2::text[]) = 0 OR d.bucket_name = ANY($2))
      `,
      [RagDocumentStatus.READY, searchBuckets],
    );

    if (rows.length === 0) return [];

    // 3) Cosine top-K
    const scored = rows
      .map((r): IChunkWithEmbedding | null => {
        let vec: number[];
        try {
          vec = JSON.parse(r.embedding);
        } catch {
          vec = [];
        }
        if (vec.length !== qVec.length) return null;
        const score = cosine(qVec, vec);
        return {
          id: r.id,
          documentId: r.document_id,
          documentName: r.document_name,
          content: r.content,
          embedding: vec,
          cosineScore: score,
        };
      })
      .filter((c): c is IChunkWithEmbedding => c !== null)
      .sort((a, b) => b.cosineScore - a.cosineScore)
      .slice(0, this.candidateK);

    // 4) BM25-ish via Postgres tsvector
    const bm25Rows = await this.dataSource.query<
      Array<{
        id: string;
        document_id: string;
        document_name: string;
        content: string;
        rank: number;
      }>
    >(
      `
      SELECT c.id,
             c.document_id,
             d.name AS document_name,
             c.content,
             ts_rank(c.tsv, plainto_tsquery('simple', $1)) AS rank
        FROM rag_chunks c
        JOIN rag_documents d ON d.id = c.document_id
       WHERE d.status = $2
         AND c.tsv @@ plainto_tsquery('simple', $1)
         AND (cardinality($3::text[]) = 0 OR d.bucket_name = ANY($3))
       ORDER BY rank DESC
       LIMIT $4
      `,
      [trimmed, RagDocumentStatus.READY, searchBuckets, this.candidateK],
    );

    const bm25Ranked = bm25Rows.map((r) => ({
      id: r.id,
      documentId: r.document_id,
      documentName: r.document_name,
      content: r.content,
      embedding: [] as number[],
      cosineScore: 0,
    }));

    // 5) RRF merge
    const merged = reciprocalRankFusion<IChunkWithEmbedding>([scored, bm25Ranked], this.fusionK);

    // 6) Re-score with cosine and drop chunks below the floor.
    const final = merged
      .map((c) => ({ chunk: c, score: cosine(qVec, c.embedding) }))
      .filter((s) => s.score >= this.minCosineScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, this.topK);

    // 7) Assign 1-based index and return.
    return final.map((s, i) => ({
      id: s.chunk.id,
      documentId: s.chunk.documentId,
      documentName: s.chunk.documentName,
      content: s.chunk.content,
      index: i + 1,
      score: s.score,
    }));
  }
}

function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i]!;
    const bi = b[i]!;
    dot += ai * bi;
    na += ai * ai;
    nb += bi * bi;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}
