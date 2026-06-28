import { MigrationInterface, QueryRunner } from 'typeorm';

export class PipelineTables1700000010000 implements MigrationInterface {
  name = 'PipelineTables1700000010000';

  public async up(q: QueryRunner): Promise<void> {
    // 1. Create document_versions table
    await q.query(`
      CREATE TABLE "document_versions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "document_id" uuid NOT NULL,
        "version_number" integer NOT NULL,
        "r2_key" varchar(500) NOT NULL,
        "mime_type" varchar(100) NOT NULL,
        "size_bytes" integer NOT NULL,
        "chunk_count" integer NOT NULL DEFAULT 0,
        "status" varchar(50) NOT NULL DEFAULT 'pending',
        "error" text,
        "created_by" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_document_versions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_document_versions_document"
          FOREIGN KEY ("document_id")
          REFERENCES "rag_documents"("id")
          ON DELETE CASCADE,
        CONSTRAINT "UQ_document_versions_doc_num"
          UNIQUE ("document_id", "version_number")
      )
    `);

    // 2. Add active_version_id to rag_documents
    await q.query(`
      ALTER TABLE "rag_documents"
      ADD COLUMN "active_version_id" uuid
    `);
    await q.query(`
      ALTER TABLE "rag_documents"
      ADD CONSTRAINT "FK_rag_documents_active_version"
      FOREIGN KEY ("active_version_id")
      REFERENCES "document_versions"("id")
      ON DELETE SET NULL
    `);

    // 3. Add version_id to rag_chunks
    await q.query(`
      ALTER TABLE "rag_chunks"
      ADD COLUMN "version_id" uuid
    `);
    await q.query(`
      ALTER TABLE "rag_chunks"
      ADD CONSTRAINT "FK_rag_chunks_version"
      FOREIGN KEY ("version_id")
      REFERENCES "document_versions"("id")
      ON DELETE CASCADE
    `);

    // 4. Create document_jobs table
    await q.query(`
      CREATE TABLE "document_jobs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "document_id" uuid NOT NULL,
        "version_id" uuid NOT NULL,
        "bullmq_job_id" varchar(100),
        "queue_name" varchar(50) NOT NULL,
        "status" varchar(50) NOT NULL DEFAULT 'pending',
        "progress" integer NOT NULL DEFAULT 0,
        "current_step" varchar(50) NOT NULL,
        "retries" integer NOT NULL DEFAULT 0,
        "max_retries" integer NOT NULL DEFAULT 3,
        "error_message" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_document_jobs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_document_jobs_document"
          FOREIGN KEY ("document_id")
          REFERENCES "rag_documents"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_document_jobs_version"
          FOREIGN KEY ("version_id")
          REFERENCES "document_versions"("id")
          ON DELETE CASCADE
      )
    `);

    await q.query(`
      CREATE INDEX "IDX_document_jobs_status" ON "document_jobs"("status")
    `);

    // 5. Create processing_logs table
    await q.query(`
      CREATE TABLE "processing_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "job_id" uuid NOT NULL,
        "step" varchar(50) NOT NULL,
        "level" varchar(20) NOT NULL,
        "message" text NOT NULL,
        "duration_ms" integer,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_processing_logs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_processing_logs_job"
          FOREIGN KEY ("job_id")
          REFERENCES "document_jobs"("id")
          ON DELETE CASCADE
      )
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "processing_logs"`);
    await q.query(`DROP TABLE IF EXISTS "document_jobs"`);
    
    await q.query(`ALTER TABLE "rag_chunks" DROP CONSTRAINT IF EXISTS "FK_rag_chunks_version"`);
    await q.query(`ALTER TABLE "rag_chunks" DROP COLUMN IF EXISTS "version_id"`);

    await q.query(`ALTER TABLE "rag_documents" DROP CONSTRAINT IF EXISTS "FK_rag_documents_active_version"`);
    await q.query(`ALTER TABLE "rag_documents" DROP COLUMN IF EXISTS "active_version_id"`);

    await q.query(`DROP TABLE IF EXISTS "document_versions"`);
  }
}
