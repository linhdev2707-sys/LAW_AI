import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { User } from './modules/user/entities/user.entity';
import { Conversation } from './modules/chat/entities/conversation.entity';
import { Message } from './modules/chat/entities/message.entity';
import { RagDocument } from './modules/rag/entities/rag-document.entity';
import { RagChunk } from './modules/rag/entities/rag-chunk.entity';
import { Transaction } from './modules/payment/entities/transaction.entity';
import { DocumentVersion } from './modules/rag/entities/document-version.entity';
import { DocumentJob } from './modules/rag/entities/document-job.entity';
import { ProcessingLog } from './modules/rag/entities/processing-log.entity';
import { Feedback } from './modules/feedback/entities/feedback.entity';

// Load .env from the apps/backend folder (one level up from compiled /dist/data-source.js)
loadEnv({ path: resolve(__dirname, '../.env') });

/**
 * Standalone TypeORM DataSource for CLI usage.
 * Mirrors config/typeorm.config.ts.
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5433', 10),
  username: process.env.DATABASE_USER || 'lawai',
  password: process.env.DATABASE_PASSWORD || 'lawai_password',
  database: process.env.DATABASE_NAME || 'law_ai',
  entities: [
    User,
    Conversation,
    Message,
    RagDocument,
    RagChunk,
    Transaction,
    DocumentVersion,
    DocumentJob,
    ProcessingLog,
    Feedback,
  ],
  // Glob pattern is intentionally split into two (one per file extension)
  // instead of using brace expansion like `[0-9]*-*.{ts,js}`.
  // TypeORM's DirectoryExportedClassesLoader on Windows does not understand
  // brace expansion and fails with "The system cannot find the path specified".
  migrations: [
    resolve(__dirname, 'database/migrations/[0-9]*-*.ts'),
    resolve(__dirname, 'database/migrations/[0-9]*-*.js'),
  ],
  synchronize: false,
  logging: ['error', 'warn'],
});
