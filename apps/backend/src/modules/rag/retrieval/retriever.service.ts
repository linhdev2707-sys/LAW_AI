import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { RagChunk } from '../entities/rag-chunk.entity';
import { RagDocument } from '../entities/rag-document.entity';
import { RagDocumentStatus } from '../entities/rag-document.entity';
import { OpenAIEmbeddingService } from '../embedding/openai-embedding.service';
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
}

@Injectable()
export class RetrieverService {
  private readonly logger = new Logger(RetrieverService.name);
  private readonly candidateK: number;
  private readonly topK: number;
  private readonly fusionK: number;

  constructor(
    config: ConfigService,
    private readonly embeddings: OpenAIEmbeddingService,
    @InjectRepository(RagChunk)
    private readonly chunkRepo: Repository<RagChunk>,
    @InjectRepository(RagDocument)
    private readonly docRepo: Repository<RagDocument>,
    private readonly dataSource: DataSource,
  ) {
    this.candidateK = config.get<number>('app.rag.candidateK', 50);
    this.topK = config.get<number>('app.rag.topK', 5);
    this.fusionK = config.get<number>('app.rag.fusionK', 60);
  }

  /**
   * Hybrid retrieval: cosine (Node-side, in-memory) + BM25/tsvector
   * (Postgres full-text), merged with Reciprocal Rank Fusion.
   */
  async retrieve(query: string): Promise<IScoredChunk[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];
    if (!this.embeddings.isReady()) {
      this.logger.warn('Embeddings not ready — returning empty retrieval');
      return [];
    }

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
      `,
      [RagDocumentStatus.READY],
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
        return {
          id: r.id,
          documentId: r.document_id,
          documentName: r.document_name,
          content: r.content,
          embedding: vec,
        };
      })
      .filter((c): c is IChunkWithEmbedding => c !== null)
      .map((c) => ({ chunk: c, score: cosine(qVec, c.embedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, this.candidateK)
      .map((s) => s.chunk);

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
       ORDER BY rank DESC
       LIMIT $3
      `,
      [trimmed, RagDocumentStatus.READY, this.candidateK],
    );

    const bm25Ranked = bm25Rows.map((r) => ({
      id: r.id,
      documentId: r.document_id,
      documentName: r.document_name,
      content: r.content,
      embedding: [] as number[],
    }));

    // 5) RRF merge
    const merged = reciprocalRankFusion<IChunkWithEmbedding>([scored, bm25Ranked], this.fusionK);

    // 6) Take top-K and assign 1-based index
    return merged.slice(0, this.topK).map((c, i) => ({
      id: c.id,
      documentId: c.documentId,
      documentName: c.documentName,
      content: c.content,
      index: i + 1,
      score: 0,
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
