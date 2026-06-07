import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { User } from './modules/user/entities/user.entity';
import { Conversation } from './modules/chat/entities/conversation.entity';
import { Message } from './modules/chat/entities/message.entity';

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
  entities: [User, Conversation, Message],
  migrations: [resolve(__dirname, 'database/migrations/*.{ts,js}')],
  synchronize: false,
  logging: ['error', 'warn'],
});

export default AppDataSource;
