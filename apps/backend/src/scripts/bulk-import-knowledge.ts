/**
 * One-shot CLI: walk a processed/ directory and bulk-ingest every
 * `processed/<category>/<docId>/v1.json` file into the RAG pipeline.
 *
 * Runs through the full Nest DI graph (no manual service wiring) so
 * the configuration, TypeORM connection, and R2 client all boot the
 * same way they do in `pnpm start`. This catches config drift between
 * dev and the cron path early — if the env is wrong, this script
 * fails the same way the server would.
 *
 * Run with:
 * pnpm bulk-import:knowledge
 *
 * Required env:
 * - KNOWLEDGE_IMPORT_DIR absolute path to the processed/ root
 * - DATABASE_* (or DATABASE_URL)
 * - R2_* (account, key, secret, endpoint)
 *
 * Optional env:
 * - KNOWLEDGE_IMPORT_BUCKET (default `law-ai-rag-knowledge`)
 * - KNOWLEDGE_IMPORT_CONCURRENCY (default 3)
 * - KNOWLEDGE_IMPORT_DRY_RUN=true → walk + count only, no R2/DB writes
 * - KNOWLEDGE_IMPORT_ENABLED=false → no-op exit 0
 *
 * Exit codes:
 * - 0 — every file ok or skipped (duplicates), OR disabled
 * - 1 — at least one file failed to ingest
 * - 2 — fatal setup error (missing env, DB unreachable, etc.)
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../app.module';
import { KnowledgeImportService } from '../modules/rag/knowledge-import.service';

async function main() {
  const log = new Logger('bulk-import-knowledge');

  const enabled = process.env.KNOWLEDGE_IMPORT_ENABLED !== 'false';
  if (!enabled) {
    log.log('KNOWLEDGE_IMPORT_ENABLED=false → exiting without doing anything');
    process.exit(0);
  }

  const dir = process.env.KNOWLEDGE_IMPORT_DIR;
  if (!dir) {
    log.error(
      'KNOWLEDGE_IMPORT_DIR is required (absolute path to processed/ root). ' +
        'Set it in .env or pass it inline.',
    );
    process.exit(2);
  }

  log.log(`Booting Nest application context…`);
  const app = await NestFactory.createApplicationContext(AppModule, {
    // Quieter logs — we want our own pipeline output to stand out.
    logger: ['error', 'warn', 'log'],
  });

  try {
    const service = app.get(KnowledgeImportService);
    const summary = await service.importFolder(dir);

    // Always print a machine-parseable summary line at the end so a
    // shell wrapper can grep for it.
    log.log(
      `SUMMARY ok=${summary.ok} skipped=${summary.skipped} ` +
        `failed=${summary.failed} total=${summary.total} ` +
        `durationMs=${summary.durationMs}`,
    );

    process.exit(summary.failed > 0 ? 1 : 0);
  } catch (e) {
    log.error(
      `Fatal: ${e instanceof Error ? e.message : String(e)}`,
      e instanceof Error ? e.stack : undefined,
    );
    process.exit(2);
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  // Top-level safety net — main() already catches its own errors, but
  // if something throws *outside* the try (e.g. NestFactory itself
  // blowing up), we still want a non-zero exit code.
  console.error(`[bulk-import-knowledge] uncaught: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(2);
});
