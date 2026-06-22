import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fix: `ON CONFLICT (document_id, chunk_index)` in bulkInsertChunks()
 * requires a UNIQUE constraint or UNIQUE index. The original
 * `IDX_rag_chunks_doc_index` (created in 1700000002000-RagTables) is a
 * plain (non-unique) B-tree, which Postgres rejects with:
 *   "there is no unique or exclusion constraint matching the ON CONFLICT specification"
 *
 * This migration:
 *  1) Drops the redundant non-unique index
 *  2) Creates a UNIQUE constraint on (document_id, chunk_index)
 *     which is what the bulk upsert expects
 */
export class UniqueChunkIndex1700000008000 implements MigrationInterface {
  name = 'UniqueChunkIndex1700000008000';

  public async up(q: QueryRunner): Promise<void> {
    // Drop the non-unique index if it exists
    await q.query(`DROP INDEX IF EXISTS "IDX_rag_chunks_doc_index"`);

    // Create a UNIQUE constraint (also implicitly creates a unique index)
    await q.query(`
      ALTER TABLE "rag_chunks"
        ADD CONSTRAINT "UQ_rag_chunks_doc_chunk_index"
        UNIQUE ("document_id", "chunk_index")
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE "rag_chunks"
        DROP CONSTRAINT IF EXISTS "UQ_rag_chunks_doc_chunk_index"
    `);
    await q.query(`
      CREATE INDEX IF NOT EXISTS "IDX_rag_chunks_doc_index"
        ON "rag_chunks" ("document_id", "chunk_index")
    `);
  }
}
