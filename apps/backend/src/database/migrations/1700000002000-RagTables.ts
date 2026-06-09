import { MigrationInterface, QueryRunner } from 'typeorm';

export class RagTables1700000002000 implements MigrationInterface {
  name = 'RagTables1700000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // rag_documents ─────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TYPE "rag_documents_status_enum" AS ENUM ('pending', 'ready', 'failed')
    `);

    await queryRunner.query(`
      CREATE TABLE "rag_documents" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" varchar(200) NOT NULL,
        "r2_key" varchar(500) NOT NULL,
        "mime_type" varchar(100) NOT NULL DEFAULT 'text/plain',
        "size_bytes" integer NOT NULL,
        "chunk_count" integer NOT NULL DEFAULT 0,
        "status" "rag_documents_status_enum" NOT NULL DEFAULT 'pending',
        "error" text,
        "created_by" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_rag_documents" PRIMARY KEY ("id"),
        CONSTRAINT "FK_rag_documents_created_by"
          FOREIGN KEY ("created_by")
          REFERENCES "users"("id")
          ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_rag_documents_status" ON "rag_documents" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_rag_documents_created_by" ON "rag_documents" ("created_by")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_rag_documents_created_at" ON "rag_documents" ("created_at" DESC)`,
    );

    // rag_chunks ────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "rag_chunks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "document_id" uuid NOT NULL,
        "chunk_index" integer NOT NULL,
        "content" text NOT NULL,
        "token_count" integer NOT NULL,
        "embedding" text NOT NULL,
        "tsv" tsvector GENERATED ALWAYS AS (to_tsvector('simple', "content")) STORED,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_rag_chunks" PRIMARY KEY ("id"),
        CONSTRAINT "FK_rag_chunks_document"
          FOREIGN KEY ("document_id")
          REFERENCES "rag_documents"("id")
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_rag_chunks_doc_index" ON "rag_chunks" ("document_id", "chunk_index")`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_rag_chunks_tsv" ON "rag_chunks" USING GIN ("tsv")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_rag_chunks_tsv"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_rag_chunks_doc_index"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "rag_chunks"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_rag_documents_created_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_rag_documents_created_by"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_rag_documents_status"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "rag_documents"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "rag_documents_status_enum"`);
  }
}
