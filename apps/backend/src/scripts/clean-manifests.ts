import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { R2Service } from '../modules/rag/storage/r2.service';
import { DataSource } from 'typeorm';
import { RagDocument } from '../modules/rag/entities/rag-document.entity';

async function main() {
  console.log('Bootstrapping application context...');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    const r2Service = app.get(R2Service);
    const dataSource = app.get(DataSource);
    const docRepo = dataSource.getRepository(RagDocument);

    console.log('Fetching active buckets from R2...');
    const buckets = await r2Service.listBuckets();
    console.log(`Found ${buckets.length} buckets.`);

    // Load all document IDs from DB for quick lookup
    const docs = await docRepo.find({ select: ['id'] });
    const existingDocIds = new Set(docs.map((d) => d.id));
    console.log(`Loaded ${existingDocIds.size} documents from database.`);

    for (const bucket of buckets) {
      console.log(`Processing bucket: ${bucket}...`);
      try {
        let manifestText: string;
        try {
          manifestText = await r2Service.getObjectText(bucket, 'manifest.json');
        } catch (e: any) {
          const code = e.name || e.code || '';
          if (code === 'NoSuchKey' || code === 'NotFound') {
            console.log(`  No manifest.json found in bucket ${bucket}. Skipping.`);
            continue;
          }
          throw e;
        }

        const manifest = JSON.parse(manifestText);
        let updated = false;
        let removedCount = 0;

        for (const sha256 in manifest) {
          const docId = manifest[sha256]?.docId;
          // If docId is specified but no longer exists in DB, remove the hash entry
          if (docId && !existingDocIds.has(docId)) {
            console.log(`  Removing orphaned hash ${sha256} (referenced deleted doc ${docId})`);
            delete manifest[sha256];
            removedCount++;
            updated = true;
          }
        }

        if (updated) {
          await r2Service.putObject(bucket, 'manifest.json', JSON.stringify(manifest), 'application/json');
          console.log(`  Successfully updated manifest.json in bucket ${bucket}. Removed ${removedCount} orphaned entries.`);
        } else {
          console.log(`  Manifest in bucket ${bucket} is clean.`);
        }
      } catch (err) {
        console.error(`  Error processing bucket ${bucket}:`, err);
      }
    }
    console.log('Manifest cleaning completed successfully.');
  } catch (e) {
    console.error('Error cleaning manifests:', e);
  } finally {
    await app.close();
  }
}

main();
