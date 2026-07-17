import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `bucket_name` + `bucket_region` columns to `rag_documents`.
 *
 * The original `RagTables` migration (1700000002000) created the table
 * without these columns, but the `RagDocument` entity declares them.
 * Local environments typically had `synchronize: true` at some point
 * (or were created with the entity directly), so the discrepancy
 * wasn't visible. Fresh production databases (e.g. VPS) running only
 * the migration history end up with a table that's missing the
 * columns the entity selects, which causes:
 *
 *   column "rag_documents"."bucket_name" does not exist
 *
 * Fix: add the two columns explicitly. Both are NOT NULL in the
 * entity, but existing rows in any environment that previously had
 * the columns (or that hasn't run yet) are handled below:
 *   - ADD COLUMN ... NOT NULL DEFAULT ...  — safe because every
 *     existing row gets the default value, satisfying the constraint.
 *   - The DEFAULT is later dropped from `bucket_name` so new rows
 *     must supply it explicitly (matching the entity).
 */
export class AddBucketToRagDocument1700000005000 implements MigrationInterface {
  name = 'AddBucketToRagDocument1700000005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // bucket_name — NOT NULL with a default so existing rows are valid.
    await queryRunner.query(
      `ALTER TABLE "rag_documents" ADD COLUMN IF NOT EXISTS "bucket_name" varchar(100) NOT NULL DEFAULT 'law-documents'`,
    );
    // Drop the default so new rows must provide a value (entity requires it).
    await queryRunner.query(`ALTER TABLE "rag_documents" ALTER COLUMN "bucket_name" DROP DEFAULT`);

    // bucket_region — entity has default 'auto'; keep DB default too.
    await queryRunner.query(
      `ALTER TABLE "rag_documents" ADD COLUMN IF NOT EXISTS "bucket_region" varchar(20) NOT NULL DEFAULT 'auto'`,
    );

    // Mirror the entity index on bucket_name for filtering.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_rag_documents_bucket_name" ON "rag_documents" ("bucket_name")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_rag_documents_bucket_name"`);
    await queryRunner.query(`ALTER TABLE "rag_documents" DROP COLUMN IF EXISTS "bucket_region"`);
    await queryRunner.query(`ALTER TABLE "rag_documents" DROP COLUMN IF EXISTS "bucket_name"`);
  }
}
