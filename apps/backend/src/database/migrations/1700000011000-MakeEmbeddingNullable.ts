import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeEmbeddingNullable1700000011000 implements MigrationInterface {
  name = 'MakeEmbeddingNullable1700000011000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "rag_chunks"
      ALTER COLUMN "embedding" DROP NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Note: if there are null values in the database, setting it back to NOT NULL will fail.
    // However, this is standard down behavior.
    await queryRunner.query(`
      ALTER TABLE "rag_chunks"
      ALTER COLUMN "embedding" SET NOT NULL
    `);
  }
}
