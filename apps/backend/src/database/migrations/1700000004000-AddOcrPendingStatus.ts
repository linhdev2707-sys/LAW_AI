import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the `ocr_pending` value to the `rag_documents_status_enum`.
 *
 * Documents uploaded as scanned PDFs go through Cloudflare Workers AI for
 * OCR before chunking/embedding. We persist them in the same table with
 * `status = 'ocr_pending'` so the admin UI can show progress and the
 * callback handler can resume from the same row.
 *
 * Postgres requires `ALTER TYPE ... ADD VALUE` to be run outside a
 * transaction block, which is what `queryRunner.query` does at the
 * migration top level.
 */
export class AddOcrPendingStatus1700000004000 implements MigrationInterface {
  name = 'AddOcrPendingStatus1700000004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "rag_documents_status_enum" ADD VALUE IF NOT EXISTS 'ocr_pending'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Postgres has no DROP VALUE for enums — the only safe rollback is
    // to recreate the type. We don't attempt that here because it would
    // require touching every row. The migration is forward-only in
    // practice; the value is unused once the feature is removed.
    throw new Error('Cannot remove enum value "ocr_pending" without recreating the type');
  }
}
