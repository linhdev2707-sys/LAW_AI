import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase: subscription / quota enforcement.
 *
 * Adds a `chat_quotas` table that tracks per-user per-month usage.
 * One row per (user_id, year, month). The row is UPSERTed on every
 * chat call so we don't need a cron to reset.
 *
 * Quota limits live in `PlanCatalog` (TypeScript) keyed by the
 * `users.subscription_plan` column; switching plans is just an update
 * to that column.
 */
export class ChatQuotas1700000009000 implements MigrationInterface {
  name = 'ChatQuotas1700000009000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "chat_quotas" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "year" integer NOT NULL,
        "month" integer NOT NULL,
        "plan" varchar(50) NOT NULL DEFAULT 'free',
        "used" integer NOT NULL DEFAULT 0,
        "last_used_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_chat_quotas" PRIMARY KEY ("id"),
        CONSTRAINT "FK_chat_quotas_user"
          FOREIGN KEY ("user_id")
          REFERENCES "users"("id")
          ON DELETE CASCADE,
        CONSTRAINT "UQ_chat_quotas_user_period"
          UNIQUE ("user_id", "year", "month")
      )
    `);
    await q.query(`
      CREATE INDEX "IDX_chat_quotas_user_period"
        ON "chat_quotas" ("user_id", "year" DESC, "month" DESC)
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "chat_quotas"`);
  }
}
