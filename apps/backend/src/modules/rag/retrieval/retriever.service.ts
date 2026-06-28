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

  /**
   * Set once at boot by detectCapabilities(). If false, the retriever
   * falls back to JSON-cosine over the `embedding` TEXT column instead
   * of using pgvector's `<=>` operator + HNSW index.
   */
  private usePgVector = false;
  /** Cached flag — true if rag_chunks.embedding_vec column exists. */

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
   * Detect whether the pgvector column exists on rag_chunks. Called
   * once from RagModule.onModuleInit. If missing, the retriever uses
   * the legacy JSON-cosine path so the system still works on plain
   * Postgres without the pgvector package.
   */
  async detectCapabilities(): Promise<void> {
    try {
      const rows = await this.dataSource.query<Array<{ column_name: string }>>(
        `SELECT column_name FROM information_schema.columns
          WHERE table_name = 'rag_chunks' AND column_name = 'embedding_vec'
          LIMIT 1`,
      );
      this.usePgVector = rows.length > 0;
      this.logger.log(
        this.usePgVector
          ? 'pgvector column `embedding_vec` detected — using native HNSW cosine'
          : 'pgvector column missing — falling back to JSON `embedding` TEXT + in-memory cosine',
      );
    } catch (e) {
      this.usePgVector = false;
      this.logger.warn(`detectCapabilities failed: ${(e as Error).message} — using JSON fallback`);
    }
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

    // 2) Build metadata WHERE clauses.
    //    Each search method prepends its own positional params:
    //      - vectorSearchPgVector: $1 = vecLit, where starts at $2
    //      - vectorSearchJsonFallback: NO reserved, where starts at $1
    //      - bm25Search: $1 = query, where starts at $2
    //    The path that actually runs depends on the pgvector detection
    //    at boot. The unused `where` instance is built with the
    //    appropriate offset to keep SQL indices unique.
    const usePg = this.usePgVector;
    const vectorWhere = usePg
      ? this.buildWhere(filters, 2)
      : this.buildWhere(filters, 1);
    const bm25Where = this.buildWhere(filters, 2);

    // 3) Vector search
    const vectorRows = await this.vectorSearch(qVec, vectorWhere, this.candidateK);

    // 4) BM25 search via tsvector
    const bm25Rows = await this.bm25Search(trimmed, bm25Where, this.candidateK);

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
  // Vector search (pgvector native cosine via <=> operator, or JSON fallback)
  // ─────────────────────────────────────────────────────────────────────

  private async vectorSearch(
    qVec: number[],
    where: { sql: string; params: any[] },
    limit: number,
  ): Promise<IChunkHit[]> {
    if (this.usePgVector) {
      return this.vectorSearchPgVector(qVec, where, limit);
    }
    return this.vectorSearchJsonFallback(qVec, where, limit);
  }

  private async vectorSearchPgVector(
    qVec: number[],
    where: { sql: string; params: any[] },
    limit: number,
  ): Promise<IChunkHit[]> {
    // Layout: [vecLit, ...where.params, status, limit]
    //   $1     $2...            $2+N    $3+N
    // The where clause is built with startIndex=2 so the first filter
    // param becomes $2, the next $3, etc. status sits after the where
    // params at index $1 + 1 + where.params.length.
    const vecLit = `[${qVec.join(',')}]`;
    const statusIdx = 1 + 1 + where.params.length;
    const limitIdx = statusIdx + 1;
    const rows = await this.dataSource.query<Array<{
      id: string; document_id: string; document_name: string;
      content: string; breadcrumb: string;
      law_name: string | null; law_number: string | null;
      chapter: string | null; section: string | null;
      article: string; clause: string | null; point: string | null;
      embedding: string | null;
      cosine: number;
    }>>(
      `
      SELECT c.id, c.document_id, d.name AS document_name,
             c.raw_text AS content, c.breadcrumb,
             c.law_name, c.law_number, c.chapter, c.section,
             c.article, c.clause, c.point,
             c.embedding_vec::text AS embedding,
             1 - (c.embedding_vec <=> $1::vector) AS cosine
        FROM rag_chunks c
        JOIN rag_documents d ON d.id = c.document_id
       WHERE d.status = $${statusIdx}::rag_documents_status_enum
         AND c.embedding_vec IS NOT NULL
         ${where.sql}
       ORDER BY c.embedding_vec <=> $1::vector
       LIMIT $${limitIdx}
      `,
      [vecLit, ...where.params, RagDocumentStatus.READY, limit],
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
      embedding: parsePgVector(r.embedding),
    }));
  }

  /**
   * Legacy path: load all ready chunks, parse JSON `embedding` column,
   * compute cosine in Node.js, sort + slice. Slow at >10k chunks but
   * works without pgvector.
   */
  private async vectorSearchJsonFallback(
    qVec: number[],
    where: { sql: string; params: any[] },
    limit: number,
  ): Promise<IChunkHit[]> {
    // No fixed positional params here. The where clause owns the
    // indices starting at $1. status is appended after the where
    // params, so it sits at $1 + where.params.length. Limit is unused
    // here (we slice in Node after scoring) but we keep the param
    // bound so the SQL stays uniform across search paths.
    const statusIdx = 1 + where.params.length;
    const rows = await this.dataSource.query<Array<{
      id: string; document_id: string; document_name: string;
      content: string; breadcrumb: string;
      law_name: string | null; law_number: string | null;
      chapter: string | null; section: string | null;
      article: string; clause: string | null; point: string | null;
      embedding: string | null;
    }>>(
      `
      SELECT c.id, c.document_id, d.name AS document_name,
             c.raw_text AS content, c.breadcrumb,
             c.law_name, c.law_number, c.chapter, c.section,
             c.article, c.clause, c.point,
             c.embedding
        FROM rag_chunks c
        JOIN rag_documents d ON d.id = c.document_id
       WHERE d.status = $${statusIdx}::rag_documents_status_enum
         AND c.embedding IS NOT NULL
         ${where.sql}
      `,
      [...where.params, RagDocumentStatus.READY],
    );

    const scored = rows
      .map((r): IChunkHit | null => {
        let vec: number[];
        try {
          vec = JSON.parse(r.embedding ?? '[]');
        } catch {
          return null;
        }
        if (vec.length !== qVec.length) return null;
        return {
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
          embedding: vec,
        };
      })
      .filter((c): c is IChunkHit => c !== null)
      .map((c) => ({ hit: c, score: cosine(qVec, c.embedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => s.hit);
    return scored;
  }

  // ─────────────────────────────────────────────────────────────────────
  // BM25 search (tsvector)
  // ─────────────────────────────────────────────────────────────────────

  private async bm25Search(
    query: string,
    where: { sql: string; params: any[] },
    limit: number,
  ): Promise<IChunkHit[]> {
    // Layout: [query, ...where.params, status, limit]
    //   $1     $2...            $2+N    $3+N
    // The `where.sql` from buildWhere was generated assuming startIndex=2
    // (because $1 is the query string in this method). status is at
    // $1 + 1 + where.params.length = $2 + where.params.length.
    const statusIdx = 1 + 1 + where.params.length;
    const limitIdx = statusIdx + 1;
    const selectEmbedding = this.usePgVector
      ? 'c.embedding_vec::text AS embedding'
      : 'c.embedding';

    const rows = await this.dataSource.query<Array<{
      id: string; document_id: string; document_name: string;
      content: string; breadcrumb: string;
      law_name: string | null; law_number: string | null;
      chapter: string | null; section: string | null;
      article: string; clause: string | null; point: string | null;
      embedding: string | null;
      rank: number;
    }>>(
      `
      SELECT c.id, c.document_id, d.name AS document_name,
             c.raw_text AS content, c.breadcrumb,
             c.law_name, c.law_number, c.chapter, c.section,
             c.article, c.clause, c.point,
             ${selectEmbedding},
             ts_rank(c.tsv, plainto_tsquery('simple', $1)) AS rank
        FROM rag_chunks c
        JOIN rag_documents d ON d.id = c.document_id
       WHERE d.status = $${statusIdx}::rag_documents_status_enum
         AND c.tsv @@ plainto_tsquery('simple', $1)
         ${where.sql}
       ORDER BY rank DESC
       LIMIT $${limitIdx}
      `,
      [query, ...where.params, RagDocumentStatus.READY, limit],
    );

    return rows.map((r) => {
      let vec: number[] = [];
      if (r.embedding) {
        try {
          vec = this.usePgVector
            ? parsePgVector(r.embedding)
            : JSON.parse(r.embedding);
        } catch {
          vec = [];
        }
      }
      return {
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
        embedding: vec,
      };
    });
  }

  // ─────────────────────────────────────────────────────────────────────
  // Filter builder
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Build the WHERE clause for a filter set, parameterised from a
   * given starting index. The starting index lets the caller prepend
   * fixed positional params (e.g. the query string) so the final
   * `$N` indices in the composed SQL are unique.
   */
  private buildWhere(f: IRetrieverFilters, startIndex = 1): { sql: string; params: any[] } {
    const clauses: string[] = [];
    const params: any[] = [];
    // The first pushed param will sit at $startIndex, the next at
    // $startIndex+1, etc. So we use `startIndex + params.length`
    // BEFORE pushing (params.length is the index of the new param).
    const push = (val: any, clause: string): void => {
      const idx = startIndex + params.length;
      params.push(val);
      clauses.push(clause.replace('?', `$${idx}`));
    };
    if (f.bucketName) {
      push(f.bucketName, 'AND d.bucket_name = ?');
    } else if (this.allowedBuckets.length > 0) {
      push(this.allowedBuckets, 'AND d.bucket_name = ANY(?::text[])');
    }
    if (f.lawNumber) {
      push(f.lawNumber, 'AND c.law_number = ?');
    }
    if (f.lawName) {
      push(`%${f.lawName}%`, 'AND c.law_name ILIKE ?');
    }
    if (f.article) {
      push(f.article, 'AND c.article = ?');
    }
    if (f.clause) {
      push(f.clause, 'AND c.clause = ?');
    }
    if (f.legalStatus) {
      push(f.legalStatus, 'AND d.legal_status = ?::rag_documents_legal_status_enum');
    }
    if (f.effectiveFrom) {
      push(f.effectiveFrom, 'AND d.effective_date >= ?::date');
    }
    if (f.effectiveTo) {
      push(f.effectiveTo, 'AND d.effective_date <= ?::date');
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

function parsePgVector(val: string | null): number[] {
  if (!val) return [];
  return val.substring(1, val.length - 1).split(',').map(Number);
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
