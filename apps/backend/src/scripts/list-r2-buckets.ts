import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { R2Service } from '../modules/rag/storage/r2.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    const r2Service = app.get(R2Service);
    const buckets = await r2Service.listBuckets();
    console.log('--- AVAILABLE BUCKETS ON CLOUDFLARE R2 ---');
    console.log(buckets);
    console.log('-----------------------------------------');
  } catch (e) {
    console.error('Error fetching buckets:', e);
  } finally {
    await app.close();
  }
}

main();
