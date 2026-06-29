import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../../modules/user/entities/user.entity';
import { Conversation } from '../../modules/chat/entities/conversation.entity';
import { Message } from '../../modules/chat/entities/message.entity';
import { RagDocument } from '../../modules/rag/entities/rag-document.entity';
import { RagChunk } from '../../modules/rag/entities/rag-chunk.entity';
import { DocumentVersion } from '../../modules/rag/entities/document-version.entity';
import { DocumentJob } from '../../modules/rag/entities/document-job.entity';
import { ProcessingLog } from '../../modules/rag/entities/processing-log.entity';
import { UserRole } from '@law-ai/shared';

loadEnv({ path: resolve(__dirname, '../../../../.env') });

const databaseUrl = process.env.DATABASE_URL?.trim();
const isProd = process.env.NODE_ENV === 'production';

const AppDataSource = new DataSource(
  databaseUrl
    ? {
        type: 'postgres',
        url: databaseUrl,
        entities: [User, Conversation, Message, RagDocument, RagChunk, DocumentVersion, DocumentJob, ProcessingLog],
        ssl: isProd ? { rejectUnauthorized: false } : false,
      }
    : {
        type: 'postgres',
        host: process.env.DATABASE_HOST || 'localhost',
        port: parseInt(process.env.DATABASE_PORT || '5433', 10),
        username: process.env.DATABASE_USER || 'lawai',
        password: process.env.DATABASE_PASSWORD || 'lawai_password',
        database: process.env.DATABASE_NAME || 'law_ai',
        entities: [User, Conversation, Message, RagDocument, RagChunk, DocumentVersion, DocumentJob, ProcessingLog],
      },
);

async function seed() {
  console.log('[seed] connecting...');
  await AppDataSource.initialize();
  const userRepo = AppDataSource.getRepository(User);

  const adminEmail = 'admin@law.com';
  const existing = await userRepo.findOne({ where: { email: adminEmail } });

  if (!existing) {
    const hashedPassword = await bcrypt.hash('Admin@123456', 12);
    const admin = userRepo.create({
      email: adminEmail,
      password: hashedPassword,
      fullName: 'Administrator',
      role: UserRole.ADMIN,
      isActive: true,
      emailVerified: true,
      subscriptionPlan: 'premium',
    });
    await userRepo.save(admin);
    console.log('[seed] Admin user created: admin@law.com');
  } else {
    console.log('[seed] Admin user admin@law.com already exists.');
  }

  await AppDataSource.destroy();
  process.exit(0);
}

seed().catch((err) => {
  console.error('[seed] FAILED:', err);
  process.exit(1);
});
