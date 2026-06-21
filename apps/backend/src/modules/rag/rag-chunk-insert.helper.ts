import { DataSource } from 'typeorm';

export interface IInsertChunkRow {
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

/**
 * Bulk-insert chunks with raw SQL so pgvector accepts the array literal
 * directly. TypeORM's `createQueryBuilder().insert().values(...)` would
 * JSON.stringify the array and store it as text — which is the legacy
 * behaviour we're moving away from.
 *
 * The ON CONFLICT clause makes the insert idempotent on
 * (document_id, chunk_index) so re-runs of the reindex script don't
 * produce duplicates.
 */
export async function bulkInsertChunks(ds: DataSource, rows: IInsertChunkRow[]): Promise<void> {
  if (rows.length === 0) return;
  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const params: any[] = [];
    const placeholders: string[] = [];
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
  }
}
