import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Safety-net migration for `rag_chunks`.
 *
 * The 1700000007000-LegalMetadataPgVector migration is wrapped in a
 * SAVEPOINT to tolerate servers without the pgvector extension. On some
 * VPS setups, that SAVEPOINT rolls back *more* than just the vector
 * statements (e.g. when the database was started in an older state where
 * the enum value 'embedding' could not be added, or when the chunker
 * schema diverged). When that happens:
 *
 * - `raw_text` is NOT NULL in the entity but the column is still NULL
 * for any pre-existing rows → the next bulk INSERT fails with
 * `null value in column "raw_text" of relation "rag_chunks" violates
 * not-null constraint`
 * - `breadcrumb` / `article` / `law_name` etc. may also be missing or
 * contain NULLs from earlier partial applies.
 *
 * This migration is *fully idempotent* and *independent* of pgvector. It
 * runs `ADD COLUMN IF NOT EXISTS`, backfills from `content` (or a safe
 * placeholder) for every NULL row, then enforces NOT NULL where the
 * entity requires it. It can be applied safely to any schema state.
 */
export class RagChunksSafetyBackfill1700000010000 implements MigrationInterface {
  name = 'RagChunksSafetyBackfill1700000010000';

  public async up(q: QueryRunner): Promise<void> {
    // ── 1) Ensure all Phase-1 columns exist. All ADD COLUMN statements
    // use IF NOT EXISTS so this migration is a no-op on a clean DB
    // that already ran migration 700 end-to-end.
    await q.query(`
 ALTER TABLE "rag_chunks"
 ADD COLUMN IF NOT EXISTS "raw_text" text,
 ADD COLUMN IF NOT EXISTS "breadcrumb" text,
 ADD COLUMN IF NOT EXISTS "law_name" varchar(300),
 ADD COLUMN IF NOT EXISTS "law_number" varchar(100),
 ADD COLUMN IF NOT EXISTS "chapter" varchar(20),
 ADD COLUMN IF NOT EXISTS "section" varchar(20),
 ADD COLUMN IF NOT EXISTS "article" varchar(20),
 ADD COLUMN IF NOT EXISTS "clause" varchar(20),
 ADD COLUMN IF NOT EXISTS "point" varchar(20),
 ADD COLUMN IF NOT EXISTS "char_start" integer,
 ADD COLUMN IF NOT EXISTS "char_end" integer
 `);

    // ── 2) Backfill existing rows so the upcoming NOT NULL is satisfiable.
    // `raw_text` and `breadcrumb` are the only NOT-NULL columns in
    // the entity; the rest are nullable and need no backfill.
    await q.query(`
 UPDATE "rag_chunks"
 SET "raw_text" = COALESCE("raw_text", "content", '')
 WHERE "raw_text" IS NULL
 `);
    await q.query(`
 UPDATE "rag_chunks"
 SET "breadcrumb" = COALESCE("breadcrumb", '')
 WHERE "breadcrumb" IS NULL
 `);

    // ── 3) Enforce NOT NULL where the entity requires it. We use a
    // DO block so a partial apply (NOT NULL already in place) does
    // not abort the rest of the migration.
    await q.query(`
 DO $$
 BEGIN
 IF EXISTS (
 SELECT 1 FROM information_schema.columns
 WHERE table_name = 'rag_chunks'
 AND column_name = 'raw_text'
 AND is_nullable = 'YES'
 ) THEN
 ALTER TABLE "rag_chunks"
 ALTER COLUMN "raw_text" SET NOT NULL;
 END IF;
 END$$;
 `);

    await q.query(`
 DO $$
 BEGIN
 IF EXISTS (
 SELECT 1 FROM information_schema.columns
 WHERE table_name = 'rag_chunks'
 AND column_name = 'breadcrumb'
 AND is_nullable = 'YES'
 ) THEN
 ALTER TABLE "rag_chunks"
 ALTER COLUMN "breadcrumb" SET NOT NULL;
 END IF;
 END$$;
 `);

    await q.query(`
 DO $$
 BEGIN
 IF EXISTS (
 SELECT 1 FROM information_schema.columns
 WHERE table_name = 'rag_chunks'
 AND column_name = 'article'
 AND is_nullable = 'YES'
 ) THEN
 -- article is the entity NOT NULL legal coordinate.
 -- Default to ? for any legacy rows that pre-date the column.
 UPDATE "rag_chunks"
 SET "article" = '?'
 WHERE "article" IS NULL;
 ALTER TABLE "rag_chunks"
 ALTER COLUMN "article" SET NOT NULL;
 END IF;
 END$$;
 `);

    // ── 4) Make sure the UNIQUE constraint that bulkInsertChunks()
    // relies on (`ON CONFLICT (document_id, chunk_index)`) exists.
    // Migration 800 normally creates it; this is the safety net for
    // any DB where 800 didn't run or was rolled back.
    await q.query(`
 DO $$
 BEGIN
 IF NOT EXISTS (
 SELECT 1 FROM pg_constraint
 WHERE conname = 'UQ_rag_chunks_doc_chunk_index'
 ) THEN
 ALTER TABLE "rag_chunks"
 ADD CONSTRAINT "UQ_rag_chunks_doc_chunk_index"
 UNIQUE ("document_id", "chunk_index");
 END IF;
 END$$;
 `);
  }

  public async down(q: QueryRunner): Promise<void> {
    // Drop the unique constraint we may have added.
    await q.query(`
 ALTER TABLE "rag_chunks"
 DROP CONSTRAINT IF EXISTS "UQ_rag_chunks_doc_chunk_index"
 `);

    // Re-open the columns so rolling back is symmetric with migration 700.
    await q.query(`
 ALTER TABLE "rag_chunks"
 ALTER COLUMN "article" DROP NOT NULL,
 ALTER COLUMN "breadcrumb" DROP NOT NULL,
 ALTER COLUMN "raw_text" DROP NOT NULL
 `);
  }
}
