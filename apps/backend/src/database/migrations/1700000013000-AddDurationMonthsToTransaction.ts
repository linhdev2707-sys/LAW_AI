import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDurationMonthsToTransaction1700000013000 implements MigrationInterface {
  name = 'AddDurationMonthsToTransaction1700000013000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD COLUMN "duration_months" integer NOT NULL DEFAULT 1`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "duration_months"`);
  }
}
