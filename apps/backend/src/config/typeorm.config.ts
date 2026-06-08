import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { User } from '../modules/user/entities/user.entity';
import { Conversation } from '../modules/chat/entities/conversation.entity';
import { Message } from '../modules/chat/entities/message.entity';

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
    entities: [User, Conversation, Message],
    migrations: [__dirname + '/../database/migrations/*.{ts,js}'],
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
