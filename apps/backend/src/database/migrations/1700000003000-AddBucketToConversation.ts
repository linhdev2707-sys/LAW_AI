import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBucketToConversation1700000003000 implements MigrationInterface {
  name = 'AddBucketToConversation1700000003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "conversations" ADD COLUMN "bucket_name" varchar(63)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "conversations" DROP COLUMN "bucket_name"`);
  }
}
