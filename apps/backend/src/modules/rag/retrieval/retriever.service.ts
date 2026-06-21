import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { RagChunk } from '../entities/rag-chunk.entity';
import { RagDocument } from '../entities/rag-document.entity';
import { RagDocumentStatus } from '../entities/rag-document.entity';
import { LegalEmbeddingService } from '../embedding/legal-embedding.service';
import { BgeRerankerService } from './bge-reranker.service';
import { reciprocalRankFusion } from './reciprocal-rank-fusion';

export interface IScoredChunk {
  id: string;
  documentId: string;
  documentName: string;
  content: string;
  breadcrumb: string;
  lawName?: string | null;
  lawNumber?: string | null;
  chapter?: string | null;
  section?: string | null;
  article: string;
  clause?: string | null;
  point?: string | null;
  score: number;
  source: 'vector' | 'bm25' | 'hybrid';
  index: number;
}

/**
 * Optional metadata filters pushed down into the retriever's SQL.
 * All fields are AND-ed; pass only the ones the caller cares about.
 */
export interface IRetrieverFilters {
  bucketName?: string;
  lawNumber?: string;
  lawName?: string;
  article?: string;
  clause?: string;
  /** ISO date — only chunks from documents effective on/after this date. */
  effectiveFrom?: string;
  /** ISO date — only chunks from documents effective on/before this date. */
  effectiveTo?: string;
  legalStatus?: string;
}

/** Internal row shape for the merged ranking pipeline. */
interface IChunkHit {
  id: string;
  documentId: string;
  documentName: string;
  content: string;
  breadcrumb: string;
  lawName: string | null;
  lawNumber: string | null;
  chapter: string | null;
  section: string | null;
  article: string;
  clause: string | null;
  point: string | null;
  embedding: number[];
}

@Injectable()
export class RetrieverService {
  private readonly logger = new Logger(RetrieverService.name);
  private readonly candidateK: number;
  private readonly topK: number;
  private readonly fusionK: number;
  private readonly minCosineScore: number;
  private readonly allowedBuckets: readonly string[];

  constructor(
    config: ConfigService,
    private readonly embeddings: LegalEmbeddingService,
    private readonly reranker: BgeRerankerService,
    @InjectRepository(RagChunk)
    private readonly chunkRepo: Repository<RagChunk>,
    @InjectRepository(RagDocument)
    private readonly docRepo: Repository<RagDocument>,
    private readonly dataSource: DataSource,
  ) {
    this.candidateK = config.get<number>('app.rag.candidateK', 50);
    this.topK = config.get<number>('app.rag.topK', 5);
    this.fusionK = config.get<number>('app.rag.fusionK', 60);
    this.minCosineScore = config.get<number>('app.rag.minCosineScore', 0.30);
    this.allowedBuckets = config.get<string[]>('app.rag.allowedBuckets', []);
  }

  /**
   * Hybrid retrieval: pgvector cosine + Postgres tsvector BM25, merged
   * with Reciprocal Rank Fusion, optionally filtered by legal metadata,
   * then reranked with a cross-encoder and sliced to topK.
   *
   * Backward-compat: `filtersOrBucket` may be a plain bucket string.
   */
  async retrieve(query: string, filtersOrBucket?: IRetrieverFilters | string): Promise<IScoredChunk[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];
    if (!this.embeddings.isReady()) {
      this.logger.warn('Embeddings not ready — returning empty retrieval');
      return [];
    }

    const filters: IRetrieverFilters = typeof filtersOrBucket === 'string'
      ? { bucketName: filtersOrBucket }
      : (filtersOrBucket ?? {});

    // 1) Embed query
    const [qVec] = await this.embeddings.embedQueries([trimmed]);
    if (!qVec) return [];

    // 2) Build metadata WHERE clause
    const where = this.buildWhere(filters);

    // 3) Vector search via pgvector (HNSW index)
    const vectorRows = await this.vectorSearch(qVec, where, this.candidateK);

    // 4) BM25 search via tsvector
    const bm25Rows = await this.bm25Search(trimmed, where, this.candidateK);

    if (vectorRows.length === 0 && bm25Rows.length === 0) {
      this.logger.debug(`No candidates for query="${trimmed.slice(0, 60)}…"`);
      return [];
    }

    // 5) RRF merge
    const merged = reciprocalRankFusion<IChunkHit>([vectorRows, bm25Rows], this.fusionK);

    // 6) Re-score with cosine (so the floor filter makes sense)
    const rescored = merged
      .filter((c) => c.embedding.length > 0)
      .map((c) => ({ chunk: c, score: cosine(qVec, c.embedding) }))
      .filter((s) => s.score >= this.minCosineScore);

    // 7) Build scored chunks for reranker
    const poolSize = Math.min(rescored.length, this.candidateK);
    const rerankInput: IScoredChunk[] = rescored
      .slice(0, poolSize)
      .map((s) => this.toScoredChunk(s.chunk, s.score, 'hybrid'));

    // 8) Rerank top candidates with cross-encoder
    const final = await this.reranker.rerank(trimmed, rerankInput, this.topK);

    this.logger.debug(
      `retrieve("${trimmed.slice(0, 60)}…"): vector=${vectorRows.length}, bm25=${bm25Rows.length}, reranked=${final.length}`,
    );
    return final;
  }

  // ─────────────────────────────────────────────────────────────────────
  // Vector search (pgvector native cosine via <=> operator)
  // ─────────────────────────────────────────────────────────────────────

  private async vectorSearch(
    qVec: number[],
    where: { sql: string; params: any[] },
    limit: number,
  ): Promise<IChunkHit[]> {
    const vecLit = `[${qVec.join(',')}]`;
    const rows = await this.dataSource.query<Array<{
      id: string; document_id: string; document_name: string;
      content: string; breadcrumb: string;
      law_name: string | null; law_number: string | null;
      chapter: string | null; section: string | null;
      article: string; clause: string | null; point: string | null;
      cosine: number;
    }>>(
      `
      SELECT c.id, c.document_id, d.name AS document_name,
             c.raw_text AS content, c.breadcrumb,
             c.law_name, c.law_number, c.chapter, c.section,
             c.article, c.clause, c.point,
             1 - (c.embedding_vec <=> $1::vector) AS cosine
        FROM rag_chunks c
        JOIN rag_documents d ON d.id = c.document_id
       WHERE d.status = $${where.params.length + 2}::rag_documents_status_enum
         AND c.embedding_vec IS NOT NULL
         ${where.sql}
       ORDER BY c.embedding_vec <=> $1::vector
       LIMIT $${where.params.length + 3}
      `,
      [vecLit, ...where.params, RagDocumentStatus.READY, limit],
    );

    // pgvector returns vectors as text "[...]" — but we don't need the
    // raw embedding here because we use the server-computed `cosine`.
    // We still populate `embedding` so the cosine floor filter works
    // in the merged pipeline.
    return rows.map((r) => ({
      id: r.id,
      documentId: r.document_id,
      documentName: r.document_name,
      content: r.content,
      breadcrumb: r.breadcrumb,
      lawName: r.law_name,
      lawNumber: r.law_number,
      chapter: r.chapter,
      section: r.section,
      article: r.article,
      clause: r.clause,
      point: r.point,
      embedding: [],   // vector path doesn't need raw vec — cosine is already on the row
    }));
  }

  // ─────────────────────────────────────────────────────────────────────
  // BM25 search (tsvector)
  // ─────────────────────────────────────────────────────────────────────

  private async bm25Search(
    query: string,
    where: { sql: string; params: any[] },
    limit: number,
  ): Promise<IChunkHit[]> {
    const rows = await this.dataSource.query<Array<{
      id: string; document_id: string; document_name: string;
      content: string; breadcrumb: string;
      law_name: string | null; law_number: string | null;
      chapter: string | null; section: string | null;
      article: string; clause: string | null; point: string | null;
      rank: number;
    }>>(
      `
      SELECT c.id, c.document_id, d.name AS document_name,
             c.raw_text AS content, c.breadcrumb,
             c.law_name, c.law_number, c.chapter, c.section,
             c.article, c.clause, c.point,
             ts_rank(c.tsv, plainto_tsquery('simple', $1)) AS rank
        FROM rag_chunks c
        JOIN rag_documents d ON d.id = c.document_id
       WHERE d.status = $${where.params.length + 2}::rag_documents_status_enum
         AND c.tsv @@ plainto_tsquery('simple', $1)
         ${where.sql}
       ORDER BY rank DESC
       LIMIT $${where.params.length + 3}
      `,
      [query, ...where.params, RagDocumentStatus.READY, limit],
    );

    return rows.map((r) => ({
      id: r.id,
      documentId: r.document_id,
      documentName: r.document_name,
      content: r.content,
      breadcrumb: r.breadcrumb,
      lawName: r.law_name,
      lawNumber: r.law_number,
      chapter: r.chapter,
      section: r.section,
      article: r.article,
      clause: r.clause,
      point: r.point,
      embedding: [],
    }));
  }

  // ─────────────────────────────────────────────────────────────────────
  // Filter builder
  // ─────────────────────────────────────────────────────────────────────

  private buildWhere(f: IRetrieverFilters): { sql: string; params: any[] } {
    const clauses: string[] = [];
    const params: any[] = [];
    if (f.bucketName) {
      params.push(f.bucketName);
      clauses.push(`AND d.bucket_name = $${params.length}`);
    } else if (this.allowedBuckets.length > 0) {
      params.push(this.allowedBuckets);
      clauses.push(`AND d.bucket_name = ANY($${params.length}::text[])`);
    }
    if (f.lawNumber) {
      params.push(f.lawNumber);
      clauses.push(`AND c.law_number = $${params.length}`);
    }
    if (f.lawName) {
      params.push(`%${f.lawName}%`);
      clauses.push(`AND c.law_name ILIKE $${params.length}`);
    }
    if (f.article) {
      params.push(f.article);
      clauses.push(`AND c.article = $${params.length}`);
    }
    if (f.clause) {
      params.push(f.clause);
      clauses.push(`AND c.clause = $${params.length}`);
    }
    if (f.legalStatus) {
      params.push(f.legalStatus);
      clauses.push(`AND d.legal_status = $${params.length}::rag_documents_legal_status_enum`);
    }
    if (f.effectiveFrom) {
      params.push(f.effectiveFrom);
      clauses.push(`AND d.effective_date >= $${params.length}::date`);
    }
    if (f.effectiveTo) {
      params.push(f.effectiveTo);
      clauses.push(`AND d.effective_date <= $${params.length}::date`);
    }
    return { sql: clauses.join('\n         '), params };
  }

  private toScoredChunk(h: IChunkHit, score: number, source: IScoredChunk['source']): IScoredChunk {
    return {
      id: h.id,
      documentId: h.documentId,
      documentName: h.documentName,
      content: h.content,
      breadcrumb: h.breadcrumb,
      lawName: h.lawName,
      lawNumber: h.lawNumber,
      chapter: h.chapter,
      section: h.section,
      article: h.article,
      clause: h.clause,
      point: h.point,
      score,
      source,
      index: 0,
    };
  }
}

function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i]!; const bi = b[i]!;
    dot += ai * bi; na += ai * ai; nb += bi * bi;
  }
  const d = Math.sqrt(na) * Math.sqrt(nb);
  return d === 0 ? 0 : dot / d;
}
