import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { User } from '../modules/user/entities/user.entity';
import { Conversation } from '../modules/chat/entities/conversation.entity';
import { Message } from '../modules/chat/entities/message.entity';
import { RagDocument } from '../modules/rag/entities/rag-document.entity';
import { RagChunk } from '../modules/rag/entities/rag-chunk.entity';

/**
 * Build TypeORM options.
 *
 * Priority:
 *  1. DATABASE_URL  → use as-is (Railway / Neon / Supabase / Render style)
 *  2. APP_DATABASE_HOST + port + user + password + name → split form (self-hosted)
 *  3. Defaults (localhost) → local docker-compose
 */
export const typeOrmModuleOptions = (configService: ConfigService): TypeOrmModuleOptions => {
  const databaseUrl = process.env.DATABASE_URL;
  const isProd = configService.get<string>('app.env') === 'production';

  const baseOptions: TypeOrmModuleOptions = {
    type: 'postgres',
    entities: [User, Conversation, Message, RagDocument, RagChunk],
    // Glob matches migration files of the form "<timestamp>-<Name>.{ts,js}".
    // Avoids matching non-migration files (e.g. the standalone runner) in the
    // same directory, which would otherwise cause infinite recursion in
    // TypeORM's DirectoryExportedClassesLoader.
    migrations: [__dirname + '/../database/migrations/[0-9]*-*.{ts,js}'],
    migrationsRun: false,
    synchronize: false, // use migrations
    logging: isProd ? ['error'] : ['error', 'warn'],
  };

  // 1) Use DATABASE_URL if provided (Railway / Neon / Supabase / Render)
  if (databaseUrl && databaseUrl.trim().length > 0) {
    return {
      ...baseOptions,
      url: databaseUrl,
      // Neon/Supabase require SSL; Railway works without but accept sslmode=require
      ssl: isProd ? { rejectUnauthorized: false } : false,
      extra: isProd ? { ssl: { rejectUnauthorized: false } } : {},
    };
  }

  // 2) Fallback to split env vars (local dev / docker-compose)
  return {
    ...baseOptions,
    host: configService.get<string>('app.database.host'),
    port: configService.get<number>('app.database.port'),
    username: configService.get<string>('app.database.username'),
    password: configService.get<string>('app.database.password'),
    database: configService.get<string>('app.database.name'),
  };
};

export { ConfigModule };
