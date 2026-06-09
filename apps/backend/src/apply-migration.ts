/**
 * Standalone migration runner.
 * Usage: ts-node src/apply-migration.ts
 *
 * Bypasses TypeORM CLI which has Windows path issues.
 */
import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { DataSource } from 'typeorm';
import { User } from './modules/user/entities/user.entity';
import { Conversation } from './modules/chat/entities/conversation.entity';
import { Message } from './modules/chat/entities/message.entity';
import { RagDocument } from './modules/rag/entities/rag-document.entity';
import { RagChunk } from './modules/rag/entities/rag-chunk.entity';
import { InitialSchema1700000000000 } from './database/migrations/1700000000000-InitialSchema';
import { ChatTables1700000001000 } from './database/migrations/1700000001000-ChatTables';
import { RagTables1700000002000 } from './database/migrations/1700000002000-RagTables';

loadEnv({ path: resolve(__dirname, '../.env') });

const ds = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5433', 10),
  username: process.env.DATABASE_USER || 'lawai',
  password: process.env.DATABASE_PASSWORD || 'lawai_password',
  database: process.env.DATABASE_NAME || 'law_ai',
  entities: [User, Conversation, Message, RagDocument, RagChunk],
  migrations: [InitialSchema1700000000000, ChatTables1700000001000, RagTables1700000002000],
  synchronize: false,
  logging: ['error', 'warn', 'migration'],
});

async function main() {
  try {
    await ds.initialize();
    console.log('✅ DataSource initialized');
    const ran = await ds.runMigrations({ transaction: 'each' });
    console.log(
      `✅ Applied ${ran.length} migration(s):`,
      ran.map((m) => m.name),
    );
    await ds.destroy();
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

main();
