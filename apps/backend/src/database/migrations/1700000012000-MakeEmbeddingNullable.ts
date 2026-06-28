import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeEmbeddingNullable1700000012000 implements MigrationInterface {
  name = 'MakeEmbeddingNullable1700000012000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE "rag_chunks"
      ALTER COLUMN "embedding" DROP NOT NULL
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE "rag_chunks"
      ALTER COLUMN "embedding" SET NOT NULL
    `);
  }
}
