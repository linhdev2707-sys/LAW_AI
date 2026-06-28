/**
 * Standalone migration runner.
 *
 * Run automatically on container start (see Dockerfile CMD) before the
 * NestJS app boots, so the database schema is always in sync with the
 * current code without needing a manual `pnpm migration:run` step.
 *
 * Connects via DATABASE_URL when available (Railway / Neon / Supabase /
 * Render), otherwise falls back to the split DATABASE_HOST / PORT / USER /
 * PASSWORD / NAME env vars used by local docker-compose.
 */
import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { DataSource } from 'typeorm';
import { User } from '../../modules/user/entities/user.entity';
import { Conversation } from '../../modules/chat/entities/conversation.entity';
import { Message } from '../../modules/chat/entities/message.entity';
import { RagDocument } from '../../modules/rag/entities/rag-document.entity';
import { RagChunk } from '../../modules/rag/entities/rag-chunk.entity';
import { DocumentVersion } from '../../modules/rag/entities/document-version.entity';
import { DocumentJob } from '../../modules/rag/entities/document-job.entity';
import { ProcessingLog } from '../../modules/rag/entities/processing-log.entity';

// Best-effort .env load. In production (Railway) env vars are injected by
// the platform, so this is a no-op there; locally it picks up the dev .env.
loadEnv({ path: resolve(__dirname, '../../../../.env') });

const databaseUrl = process.env.DATABASE_URL?.trim();
const isProd = process.env.NODE_ENV === 'production';

const baseOptions = {
  type: 'postgres' as const,
  entities: [User, Conversation, Message, RagDocument, RagChunk, DocumentVersion, DocumentJob, ProcessingLog],
  // Glob matches migration files of the form "<timestamp>-<Name>.{ts,js}"
  // (e.g. 1700000000000-InitialSchema.js). Excludes this runner itself,
  // which would otherwise recurse infinitely during migrations discovery.
  migrations: [__dirname + '/[0-9]*-*.{ts,js}'],
  synchronize: false,
  logging: ['error', 'warn'] as ('error' | 'warn')[],
};

export const AppDataSource = new DataSource(
  databaseUrl
    ? {
        ...baseOptions,
        url: databaseUrl,
        ssl: isProd ? { rejectUnauthorized: false } : false,
      }
    : {
        ...baseOptions,
        host: process.env.DATABASE_HOST || 'localhost',
        port: parseInt(process.env.DATABASE_PORT || '5433', 10),
        username: process.env.DATABASE_USER || 'lawai',
        password: process.env.DATABASE_PASSWORD || 'lawai_password',
        database: process.env.DATABASE_NAME || 'law_ai',
      },
);

AppDataSource.initialize()
  .then(async (ds) => {
    console.log('[migrations] connecting...');
    const ran = await ds.runMigrations({ transaction: 'each' });
    if (ran.length === 0) {
      console.log('[migrations] schema is up to date (nothing to apply).');
    } else {
      console.log(`[migrations] done. Applied ${ran.length} migration(s):`);
      ran.forEach((m) => console.log('  ✓ ' + m.name));
    }
    await ds.destroy();
    process.exit(0);
  })
  .catch((err) => {
    console.error('[migrations] FAILED:', err);
    process.exit(1);
  });
