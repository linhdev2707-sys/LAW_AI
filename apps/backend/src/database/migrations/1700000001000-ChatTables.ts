import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChatTables1700000001000 implements MigrationInterface {
  name = 'ChatTables1700000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "conversations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "title" varchar(200) NOT NULL DEFAULT 'New chat',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_conversations" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_conversations_user_id" ON "conversations" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_conversations_user_updated" ON "conversations" ("user_id", "updated_at" DESC)`,
    );

    await queryRunner.query(`
      CREATE TYPE "messages_role_enum" AS ENUM ('user', 'assistant', 'system')
    `);

    await queryRunner.query(`
      CREATE TABLE "messages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "conversation_id" uuid NOT NULL,
        "role" "messages_role_enum" NOT NULL,
        "content" text NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_messages" PRIMARY KEY ("id"),
        CONSTRAINT "FK_messages_conversation"
          FOREIGN KEY ("conversation_id")
          REFERENCES "conversations"("id")
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_messages_conversation_id" ON "messages" ("conversation_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_messages_conversation_created" ON "messages" ("conversation_id", "created_at" ASC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_messages_conversation_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_messages_conversation_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "messages"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "messages_role_enum"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_conversations_user_updated"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_conversations_user_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "conversations"`);
  }
}
