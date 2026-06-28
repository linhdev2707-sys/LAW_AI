import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixChunkUniqueConstraint1700000011000 implements MigrationInterface {
  name = 'FixChunkUniqueConstraint1700000011000';

  public async up(q: QueryRunner): Promise<void> {
    // 1. Create a version for each existing document
    await q.query(`
      INSERT INTO "document_versions" (
        "id", "document_id", "version_number", "r2_key", "mime_type",
        "size_bytes", "chunk_count", "status", "created_by", "created_at", "updated_at"
      )
      SELECT 
        gen_random_uuid(), "id", 1, "r2_key", "mime_type",
        "size_bytes", "chunk_count", 
        CASE WHEN "status" = 'ready' THEN 'ready' ELSE 'failed' END,
        "created_by", "created_at", "updated_at"
      FROM "rag_documents"
    `);

    // 2. Associate existing chunks with the newly created version
    await q.query(`
      UPDATE "rag_chunks" c
      SET "version_id" = v.id
      FROM "document_versions" v
      WHERE c.document_id = v.document_id
    `);

    // 3. Set active_version_id in rag_documents
    await q.query(`
      UPDATE "rag_documents" d
      SET "active_version_id" = v.id
      FROM "document_versions" v
      WHERE d.id = v.document_id
    `);

    // 4. Drop the old unique constraint UQ_rag_chunks_doc_chunk_index
    await q.query(`
      ALTER TABLE "rag_chunks"
      DROP CONSTRAINT IF EXISTS "UQ_rag_chunks_doc_chunk_index"
    `);

    // 5. Make version_id in rag_chunks NOT NULL (since all existing ones are updated)
    await q.query(`
      ALTER TABLE "rag_chunks"
      ALTER COLUMN "version_id" SET NOT NULL
    `);

    // 6. Create the new unique constraint on (version_id, chunk_index)
    await q.query(`
      ALTER TABLE "rag_chunks"
      ADD CONSTRAINT "UQ_rag_chunks_version_chunk_index"
      UNIQUE ("version_id", "chunk_index")
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE "rag_chunks"
      DROP CONSTRAINT IF EXISTS "UQ_rag_chunks_version_chunk_index"
    `);

    await q.query(`
      ALTER TABLE "rag_chunks"
      ALTER COLUMN "version_id" DROP NOT NULL
    `);

    await q.query(`
      ALTER TABLE "rag_chunks"
      ADD CONSTRAINT "UQ_rag_chunks_doc_chunk_index"
      UNIQUE ("document_id", "chunk_index")
    `);
  }
}
