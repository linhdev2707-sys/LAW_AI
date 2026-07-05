import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFeedbackTable1700000015000 implements MigrationInterface {
  name = 'CreateFeedbackTable1700000015000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "feedback" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid,
        "responses" jsonb NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_feedback" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_feedback_user_id" ON "feedback" ("user_id")
    `);
    await queryRunner.query(`
      ALTER TABLE "feedback"
      ADD CONSTRAINT "FK_feedback_users"
      FOREIGN KEY ("user_id")
      REFERENCES "users"("id")
      ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "feedback" DROP CONSTRAINT "FK_feedback_users"
    `);
    await queryRunner.query(`
      DROP INDEX "IDX_feedback_user_id"
    `);
    await queryRunner.query(`
      DROP TABLE "feedback"
    `);
  }
}
