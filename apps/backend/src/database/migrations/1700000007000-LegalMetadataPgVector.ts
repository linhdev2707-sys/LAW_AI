import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 1: Legal metadata + pgvector for the Legal Agentic RAG migration.
 *
 * Adds:
 *  - document_type / law_name / law_number / issuer / effective_date /
 *    expiry_date / issued_date / legal_status / source_url /
 *    amendment_of / extra_metadata columns on rag_documents
 *  - raw_text / breadcrumb / law_name / law_number / chapter / section /
 *    article / clause / point / embedding_vec (pgvector, optional) /
 *    char_start / char_end on rag_chunks
 *  - HNSW index for cosine similarity over embedding_vec (only when pgvector
 *    is available — see below)
 *  - GIN index on extra_metadata, B-tree on (law_number, article, clause)
 *  - new status enum values: 'parsing', 'chunking', 'embedding'
 *  - tsv generated column rebuilt on raw_text (was on content)
 *
 * pgvector is OPTIONAL: if the server doesn't have the extension installed
 * (e.g. plain `postgres:16-alpine` image without the pgvector package), the
 * migration gracefully skips the vector column and HNSW index. The RAG
 * service auto-detects this case at boot and falls back to the legacy
 * in-memory cosine path over the JSON `embedding` TEXT column. To enable
 * pgvector: switch the image to `pgvector/pgvector:pg16-alpine` and run
 * this migration again — the column + index will be added.
 */
export class LegalMetadataPgVector1700000007000 implements MigrationInterface {
  name = 'LegalMetadataPgVector1700000007000';

  public async up(q: QueryRunner): Promise<void> {
    // ── 1) Try to enable pgvector (optional) ─────────────────────────
    // We use a SAVEPOINT so that if `CREATE EXTENSION vector` fails
    // (because the pgvector package isn't installed on the server, e.g.
    // the plain `postgres:16-alpine` image), the failure is contained
    // and the outer transaction can continue. Without the savepoint,
    // Postgres would mark the entire transaction as ABORTED and every
    // subsequent statement would fail with `25P02 current transaction
    // is aborted`.
    let hasVector = false;
    const sp = 'sp_pgvector_check';
    try {
      await q.query(`SAVEPOINT ${sp}`);
      await q.query(`CREATE EXTENSION IF NOT EXISTS vector`);
      await q.query(`RELEASE SAVEPOINT ${sp}`);
      hasVector = true;
    } catch (e) {
      await q.query(`ROLLBACK TO SAVEPOINT ${sp}`);
      // eslint-disable-next-line no-console
      console.warn(
        '[LegalMetadataPgVector] pgvector extension not available — ' +
          'skipping embedding_vec column + HNSW index. RAG will use the ' +
          'legacy JSON `embedding` TEXT column with in-memory cosine. ' +
          'To enable pgvector, switch to the `pgvector/pgvector:pg16-alpine` ' +
          'image and re-run this migration.',
      );
      hasVector = false;
    }

    // ── 2) Add new status values to the document status enum ─────────
    // `ALTER TYPE ... ADD VALUE` cannot run inside a transaction block
    // (Postgres restriction). We use the same SAVEPOINT trick to wrap
    // each statement: if it fails because the value already exists, the
    // savepoint is rolled back and we move on. The previous migration
    // `AddOcrPendingStatus` uses the same pattern and works.
    const enumAdditions = ['parsing', 'chunking', 'embedding'];
    for (const value of enumAdditions) {
      const sp2 = `sp_enum_add_${value}`;
      try {
        await q.query(`SAVEPOINT ${sp2}`);
        await q.query(`
          ALTER TYPE "rag_documents_status_enum"
            ADD VALUE IF NOT EXISTS '${value}'
        `);
        await q.query(`RELEASE SAVEPOINT ${sp2}`);
      } catch (e) {
        await q.query(`ROLLBACK TO SAVEPOINT ${sp2}`);
        // Either the value already exists (benign) or we're in a context
        // where ADD VALUE can't run. Either way, the migration continues.
        // eslint-disable-next-line no-console
        console.warn(
          `[LegalMetadataPgVector] could not add enum value '${value}': ${(e as Error).message}`,
        );
      }
    }

    // ── 3) Document legal metadata columns ──────────────────────────
    await q.query(`
      CREATE TYPE "rag_documents_document_type_enum" AS ENUM (
        'luat', 'nghi_dinh', 'thong_tu', 'quyet_dinh',
        'nghi_quyet', 'phap_lenh', 'hop_dong', 'van_ban_khac'
      )
    `);
    await q.query(`
      CREATE TYPE "rag_documents_legal_status_enum" AS ENUM (
        'con_hieu_luc', 'het_hieu_luc', 'het_hieu_luc_mot_phan',
        'chua_co_hieu_luc', 'khong_xac_dinh'
      )
    `);

    await q.query(`
      ALTER TABLE "rag_documents"
        ADD COLUMN IF NOT EXISTS "document_type" "rag_documents_document_type_enum"
          NOT NULL DEFAULT 'van_ban_khac',
        ADD COLUMN IF NOT EXISTS "law_name" varchar(300),
        ADD COLUMN IF NOT EXISTS "law_number" varchar(100),
        ADD COLUMN IF NOT EXISTS "issuer" varchar(300),
        ADD COLUMN IF NOT EXISTS "effective_date" date,
        ADD COLUMN IF NOT EXISTS "expiry_date" date,
        ADD COLUMN IF NOT EXISTS "issued_date" date,
        ADD COLUMN IF NOT EXISTS "legal_status" "rag_documents_legal_status_enum"
          NOT NULL DEFAULT 'khong_xac_dinh',
        ADD COLUMN IF NOT EXISTS "source_url" text,
        ADD COLUMN IF NOT EXISTS "amendment_of" uuid,
        ADD COLUMN IF NOT EXISTS "extra_metadata" jsonb
    `);

    await q.query(`
      CREATE INDEX IF NOT EXISTS "IDX_rag_documents_law_number"
        ON "rag_documents" ("law_number")
    `);
    await q.query(`
      CREATE INDEX IF NOT EXISTS "IDX_rag_documents_legal_status"
        ON "rag_documents" ("legal_status")
    `);
    await q.query(`
      CREATE INDEX IF NOT EXISTS "IDX_rag_documents_effective_date"
        ON "rag_documents" ("effective_date")
    `);
    await q.query(`
      CREATE INDEX IF NOT EXISTS "IDX_rag_documents_extra_metadata"
        ON "rag_documents" USING GIN ("extra_metadata")
    `);

    // ── 4) Chunk legal coordinates + pgvector column ───────────────
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
        ${hasVector ? 'ADD COLUMN IF NOT EXISTS "embedding_vec" vector(1024),' : ''}
        ADD COLUMN IF NOT EXISTS "char_start" integer,
        ADD COLUMN IF NOT EXISTS "char_end" integer
    `);

    // Backfill raw_text from content for existing rows so the new
    // NOT NULL constraint is satisfied.
    await q.query(`
      UPDATE "rag_chunks"
         SET "raw_text" = "content"
       WHERE "raw_text" IS NULL
    `);
    // For breadcrumb we default to a placeholder; the reindex script
    // fills it in for real.
    await q.query(`
      UPDATE "rag_chunks"
         SET "breadcrumb" = COALESCE("breadcrumb", '')
       WHERE "breadcrumb" IS NULL
    `);
    await q.query(`
      ALTER TABLE "rag_chunks"
        ALTER COLUMN "raw_text" SET NOT NULL
    `);

    await q.query(`
      CREATE INDEX IF NOT EXISTS "IDX_rag_chunks_law_article"
        ON "rag_chunks" ("law_number", "article", "clause")
    `);
    await q.query(`
      CREATE INDEX IF NOT EXISTS "IDX_rag_chunks_breadcrumb"
        ON "rag_chunks" ("breadcrumb")
    `);
    await q.query(`
      CREATE INDEX IF NOT EXISTS "IDX_rag_chunks_law_name"
        ON "rag_chunks" ("law_name")
    `);
    await q.query(`
      CREATE INDEX IF NOT EXISTS "IDX_rag_chunks_chapter"
        ON "rag_chunks" ("chapter")
    `);

    // ── 5) HNSW index for cosine similarity (pgvector) ───────────
    // m=16, ef_construction=64 are the bge-m3 sweet-spot defaults.
    // Only created if pgvector extension was successfully enabled.
    if (hasVector) {
      await q.query(`
        CREATE INDEX IF NOT EXISTS "IDX_rag_chunks_embedding_vec_hnsw"
          ON "rag_chunks" USING hnsw ("embedding_vec" vector_cosine_ops)
          WITH (m = 16, ef_construction = 64)
      `);
    }

    // ── 6) Rebuild tsv generated column on raw_text ───────────────
    await q.query(`DROP INDEX IF EXISTS "IDX_rag_chunks_tsv"`);
    await q.query(`ALTER TABLE "rag_chunks" DROP COLUMN IF EXISTS "tsv"`);
    await q.query(`
      ALTER TABLE "rag_chunks"
        ADD COLUMN "tsv" tsvector
        GENERATED ALWAYS AS (to_tsvector('simple', coalesce("raw_text", ''))) STORED
    `);
    await q.query(`
      CREATE INDEX "IDX_rag_chunks_tsv"
        ON "rag_chunks" USING GIN ("tsv")
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    // Revert in reverse order. Removing enum values is non-trivial in
    // Postgres; we leave that to a manual op.
    await q.query(`DROP INDEX IF EXISTS "IDX_rag_chunks_tsv"`);
    await q.query(`ALTER TABLE "rag_chunks" DROP COLUMN IF EXISTS "tsv"`);
    await q.query(`
      ALTER TABLE "rag_chunks"
        ADD COLUMN "tsv" tsvector
        GENERATED ALWAYS AS (to_tsvector('simple', "content")) STORED
    `);
    await q.query(`
      CREATE INDEX "IDX_rag_chunks_tsv" ON "rag_chunks" USING GIN ("tsv")
    `);

    await q.query(`DROP INDEX IF EXISTS "IDX_rag_chunks_embedding_vec_hnsw"`);
    await q.query(`
      ALTER TABLE "rag_chunks"
        DROP COLUMN IF EXISTS "char_end",
        DROP COLUMN IF EXISTS "char_start",
        DROP COLUMN IF EXISTS "embedding_vec",
        DROP COLUMN IF EXISTS "point",
        DROP COLUMN IF EXISTS "clause",
        DROP COLUMN IF EXISTS "article",
        DROP COLUMN IF EXISTS "section",
        DROP COLUMN IF EXISTS "chapter",
        DROP COLUMN IF EXISTS "law_number",
        DROP COLUMN IF EXISTS "law_name",
        DROP COLUMN IF EXISTS "breadcrumb",
        DROP COLUMN IF EXISTS "raw_text"
    `);

    await q.query(`DROP INDEX IF EXISTS "IDX_rag_chunks_chapter"`);
    await q.query(`DROP INDEX IF EXISTS "IDX_rag_chunks_law_name"`);
    await q.query(`DROP INDEX IF EXISTS "IDX_rag_chunks_breadcrumb"`);
    await q.query(`DROP INDEX IF EXISTS "IDX_rag_chunks_law_article"`);

    await q.query(`DROP INDEX IF EXISTS "IDX_rag_documents_extra_metadata"`);
    await q.query(`DROP INDEX IF EXISTS "IDX_rag_documents_effective_date"`);
    await q.query(`DROP INDEX IF EXISTS "IDX_rag_documents_legal_status"`);
    await q.query(`DROP INDEX IF EXISTS "IDX_rag_documents_law_number"`);

    await q.query(`
      ALTER TABLE "rag_documents"
        DROP COLUMN IF EXISTS "extra_metadata",
        DROP COLUMN IF EXISTS "amendment_of",
        DROP COLUMN IF EXISTS "source_url",
        DROP COLUMN IF EXISTS "legal_status",
        DROP COLUMN IF EXISTS "issued_date",
        DROP COLUMN IF EXISTS "expiry_date",
        DROP COLUMN IF EXISTS "effective_date",
        DROP COLUMN IF EXISTS "issuer",
        DROP COLUMN IF EXISTS "law_number",
        DROP COLUMN IF EXISTS "law_name",
        DROP COLUMN IF EXISTS "document_type"
    `);

    await q.query(`DROP TYPE IF EXISTS "rag_documents_legal_status_enum"`);
    await q.query(`DROP TYPE IF EXISTS "rag_documents_document_type_enum"`);
  }
}
