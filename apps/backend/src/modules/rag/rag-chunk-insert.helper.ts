import { DataSource } from 'typeorm';
import { Logger } from '@nestjs/common';

interface IInsertRow {
  documentId: string;
  chunkIndex: number;
  content: string;
  rawText: string;
  tokenCount: number;
  breadcrumb: string;
  lawName: string | null;
  lawNumber: string | null;
  chapter: string | null;
  section: string | null;
  article: string;
  clause: string | null;
  point: string | null;
  charStart: number | null;
  charEnd: number | null;
  embeddingVec: number[];
}

const log = new Logger('BulkInsertChunks');

/** Cached capability flag — true once we confirm `embedding_vec` exists. */
let hasVectorColumn: boolean | null = null;

async function detectVectorColumn(ds: DataSource): Promise<boolean> {
  if (hasVectorColumn !== null) return hasVectorColumn;
  try {
    const rows = await ds.query<Array<{ column_name: string }>>(
      `SELECT column_name FROM information_schema.columns
        WHERE table_name = 'rag_chunks' AND column_name = 'embedding_vec'
        LIMIT 1`,
    );
    hasVectorColumn = rows.length > 0;
    if (!hasVectorColumn) {
      log.warn('pgvector `embedding_vec` column missing — using JSON `embedding` TEXT fallback');
    }
  } catch {
    hasVectorColumn = false;
  }
  return hasVectorColumn;
}

/**
 * Bulk-insert chunks with raw SQL so pgvector (when available) accepts
 * the array literal directly. Falls back to writing only the JSON
 * `embedding` column when the pgvector extension / column is missing.
 */
export async function bulkInsertChunks(ds: DataSource, rows: IInsertRow[]): Promise<void> {
  if (rows.length === 0) return;
  const hasVec = await detectVectorColumn(ds);
  const BATCH = 500;

  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const params: any[] = [];
    const placeholders: string[] = [];

    if (hasVec) {
      slice.forEach((r, idx) => {
        const base = idx * 16;
        placeholders.push(`(
          $${base + 1}::uuid, $${base + 2}::int, $${base + 3}::text, $${base + 4}::text,
          $${base + 5}::int, $${base + 6}::text, $${base + 7}::varchar, $${base + 8}::varchar,
          $${base + 9}::varchar, $${base + 10}::varchar, $${base + 11}::varchar, $${base + 12}::varchar,
          $${base + 13}::varchar, $${base + 14}::int, $${base + 15}::int, $${base + 16}::vector
        )`);
        params.push(
          r.documentId, r.chunkIndex, r.content, r.rawText,
          r.tokenCount, r.breadcrumb, r.lawName, r.lawNumber,
          r.chapter, r.section, r.article, r.clause, r.point,
          r.charStart, r.charEnd, `[${r.embeddingVec.join(',')}]`,
        );
      });
      await ds.query(
        `INSERT INTO rag_chunks (
           document_id, chunk_index, content, raw_text, token_count,
           breadcrumb, law_name, law_number, chapter, section,
           article, clause, point, char_start, char_end, embedding_vec
         ) VALUES ${placeholders.join(',')}
         ON CONFLICT (document_id, chunk_index) DO UPDATE SET
           content = EXCLUDED.content,
           raw_text = EXCLUDED.raw_text,
           token_count = EXCLUDED.token_count,
           breadcrumb = EXCLUDED.breadcrumb,
           law_name = EXCLUDED.law_name,
           law_number = EXCLUDED.law_number,
           chapter = EXCLUDED.chapter,
           section = EXCLUDED.section,
           article = EXCLUDED.article,
           clause = EXCLUDED.clause,
           point = EXCLUDED.point,
           char_start = EXCLUDED.char_start,
           char_end = EXCLUDED.char_end,
           embedding_vec = EXCLUDED.embedding_vec`,
        params,
      );
    } else {
      // JSON-only fallback: write the legacy `embedding` TEXT column.
      slice.forEach((r, idx) => {
        const base = idx * 16;
        placeholders.push(`(
          $${base + 1}::uuid, $${base + 2}::int, $${base + 3}::text, $${base + 4}::text,
          $${base + 5}::int, $${base + 6}::text, $${base + 7}::varchar, $${base + 8}::varchar,
          $${base + 9}::varchar, $${base + 10}::varchar, $${base + 11}::varchar, $${base + 12}::varchar,
          $${base + 13}::varchar, $${base + 14}::int, $${base + 15}::int, $${base + 16}::text
        )`);
        params.push(
          r.documentId, r.chunkIndex, r.content, r.rawText,
          r.tokenCount, r.breadcrumb, r.lawName, r.lawNumber,
          r.chapter, r.section, r.article, r.clause, r.point,
          r.charStart, r.charEnd, JSON.stringify(r.embeddingVec),
        );
      });
      await ds.query(
        `INSERT INTO rag_chunks (
           document_id, chunk_index, content, raw_text, token_count,
           breadcrumb, law_name, law_number, chapter, section,
           article, clause, point, char_start, char_end, embedding
         ) VALUES ${placeholders.join(',')}
         ON CONFLICT (document_id, chunk_index) DO UPDATE SET
           content = EXCLUDED.content,
           raw_text = EXCLUDED.raw_text,
           token_count = EXCLUDED.token_count,
           breadcrumb = EXCLUDED.breadcrumb,
           law_name = EXCLUDED.law_name,
           law_number = EXCLUDED.law_number,
           chapter = EXCLUDED.chapter,
           section = EXCLUDED.section,
           article = EXCLUDED.article,
           clause = EXCLUDED.clause,
           point = EXCLUDED.point,
           char_start = EXCLUDED.char_start,
           char_end = EXCLUDED.char_end,
           embedding = EXCLUDED.embedding`,
        params,
      );
    }
  }
}
