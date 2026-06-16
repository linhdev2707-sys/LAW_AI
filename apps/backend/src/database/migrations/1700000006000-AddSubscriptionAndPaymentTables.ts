import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSubscriptionAndPaymentTables1700000006000 implements MigrationInterface {
  name = 'AddSubscriptionAndPaymentTables1700000006000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add columns to users table
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "subscription_plan" varchar(50) NOT NULL DEFAULT 'free'`
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "subscription_expires_at" timestamptz DEFAULT NULL`
    );

    // Create transactions table
    await queryRunner.query(`
      CREATE TABLE "transactions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "code" varchar(50) NOT NULL,
        "plan" varchar(50) NOT NULL,
        "amount" integer NOT NULL,
        "status" varchar(50) NOT NULL DEFAULT 'pending',
        "payment_gateway" varchar(50) NOT NULL DEFAULT 'casso',
        "transaction_id" varchar(100),
        "paid_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_transactions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_transactions_code" UNIQUE ("code"),
        CONSTRAINT "FK_transactions_user_id" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
      )
    `);

    // Create indices
    await queryRunner.query(`CREATE INDEX "IDX_transactions_user_id" ON "transactions" ("user_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_transactions_code" ON "transactions" ("code")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indices
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_transactions_code"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_transactions_user_id"`);

    // Drop table
    await queryRunner.query(`DROP TABLE IF EXISTS "transactions"`);

    // Drop columns from users table
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "subscription_expires_at"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "subscription_plan"`);
  }
}
