/**
 * One-shot reindex script. Walks every ready document, re-runs the
 * metadata enricher + hierarchical chunker + legal embedder, and
 * replaces chunks in a single transaction.
 *
 * Run with:
 *   npx ts-node -r tsconfig-paths/register src/scripts/reindex-legal.ts
 *
 * Set DRY_RUN=1 to only report what would be reindexed without writing.
 */
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { RagDocument, RagDocumentStatus } from '../modules/rag/entities/rag-document.entity';
import { RagChunk } from '../modules/rag/entities/rag-chunk.entity';
import { DocumentVersion } from '../modules/rag/entities/document-version.entity';
import { LegalStructureParser } from '../modules/rag/parsers/legal-structure.parser';
import { LegalHierarchicalChunkerService } from '../modules/rag/chunking/legal-hierarchical-chunker.service';
import { MetadataEnricherService } from '../modules/rag/parsers/metadata-enricher.service';
import { ReferenceExtractorService } from '../modules/rag/parsers/reference-extractor.service';
import { LegalEmbeddingService } from '../modules/rag/embedding/legal-embedding.service';
import { R2Service } from '../modules/rag/storage/r2.service';
import { DocumentParserService } from '../modules/rag/parsers/document-parser.service';
import { bulkInsertChunks } from '../modules/rag/rag-chunk-insert.helper';
import type { ConfigService } from '@nestjs/config';

async function main() {
  const dryRun = process.env.DRY_RUN === '1';
  console.log(`[reindex] dryRun=${dryRun}`);

  const ds = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    username: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    entities: [RagDocument, RagChunk, DocumentVersion],
    synchronize: false,
    logging: ['error', 'warn'],
  });
  await ds.initialize();

  const docRepo = ds.getRepository(RagDocument);
  const docs = await docRepo.find({ where: { status: RagDocumentStatus.READY } });
  console.log(`[reindex] Found ${docs.length} ready documents`);

  if (docs.length === 0) {
    await ds.destroy();
    return;
  }

  // Lightweight ConfigService shim — read directly from env.
  const cfg: ConfigService = {
    get: <T>(key: string, fallback?: T): T | undefined => {
      const m: Record<string, string> = {
        'app.embedding.model': process.env.EMBEDDING_MODEL || 'Xenova/bge-m3',
        'app.embedding.dim': process.env.EMBEDDING_DIM || '1024',
        'app.embedding.useBgePrefix': process.env.EMBEDDING_USE_PREFIX || 'false',
        'app.embedding.backend': process.env.EMBEDDING_BACKEND || 'local',
        'app.cloudflare.accountId': process.env.R2_ACCOUNT_ID || '',
        'app.cloudflare.apiToken': process.env.CLOUDFLARE_API_TOKEN || '',
        'app.rag.chunkSize': process.env.RAG_CHUNK_SIZE || '480',
        'app.rag.hardChunkSize': process.env.RAG_HARD_CHUNK_SIZE || '720',
        'app.rag.chunkOverlap': process.env.RAG_CHUNK_OVERLAP || '50',
        'app.rag.enricherUseLlm': process.env.RAG_ENRICHER_USE_LLM || 'true',
      };
      const v = m[key];
      if (v === undefined) return fallback;
      // Best-effort type coercion
      if (fallback === undefined) return v as unknown as T;
      if (typeof fallback === 'number') {
        const n = parseFloat(v);
        return (Number.isFinite(n) ? n : fallback) as unknown as T;
      }
      if (typeof fallback === 'boolean') {
        return (v === 'true' || v === '1') as unknown as T;
      }
      return v as unknown as T;
    },
  } as unknown as ConfigService;

  const r2 = new R2Service(cfg);
  await r2.onModuleInit();
  if (!r2.isEnabled()) {
    console.error('[reindex] R2 is not enabled — cannot read source text. Aborting.');
    await ds.destroy();
    process.exit(1);
  }
  const parser = new DocumentParserService();
  const enricher = new MetadataEnricherService(cfg);
  const chunker = new LegalHierarchicalChunkerService(new LegalStructureParser(), cfg);
  const refExtractor = new ReferenceExtractorService();
  const embedder = new LegalEmbeddingService(cfg);
  await embedder.onModuleInit();

  let ok = 0,
    fail = 0,
    skipped = 0;

  for (const doc of docs) {
    try {
      const buf = await r2.getObjectBuffer(doc.bucketName, doc.r2Key);
      const mime = doc.mimeType || 'text/plain';
      const filename = doc.r2Key;
      const text = await parser.extractText(buf, mime, filename);
      if (!text || !text.trim()) {
        console.warn(`  · ${doc.id} (${doc.name}): empty text, skipping`);
        skipped++;
        continue;
      }

      const refs = refExtractor.extract(text);
      const enrichment = await enricher.enrich({
        documentName: doc.name,
        fullText: text,
        sourceUrl: doc.sourceUrl,
      });

      const lawName = enrichment.lawName ?? doc.name;
      const newChunks = chunker.chunk(text, lawName, enrichment.lawNumber ?? undefined);
      if (newChunks.length === 0) {
        console.warn(`  · ${doc.id} (${doc.name}): produced 0 chunks, skipping`);
        skipped++;
        continue;
      }

      if (dryRun) {
        console.log(
          `  · ${doc.id} (${doc.name}): would reindex → ${newChunks.length} chunks ` +
            `(${refs.length} refs, law="${enrichment.lawName ?? '?'}", ` +
            `number=${enrichment.lawNumber ?? '-'})`,
        );
        ok++;
        continue;
      }

      const vectors = await embedder.embedChunks(newChunks);
      if (vectors.length !== newChunks.length) {
        throw new Error(
          `vector count mismatch: got ${vectors.length} for ${newChunks.length} chunks`,
        );
      }

      await ds.transaction(async (em) => {
        const verRepo = em.getRepository(DocumentVersion);
        let versionId = doc.activeVersionId;
        if (!versionId) {
          const latest = await verRepo.findOne({
            where: { documentId: doc.id },
            order: { versionNumber: 'DESC' },
          });
          if (latest) {
            versionId = latest.id;
          } else {
            const newVer = await verRepo.save(
              verRepo.create({
                documentId: doc.id,
                versionNumber: 1,
                r2Key: doc.r2Key || 'legacy',
                mimeType: doc.mimeType || 'text/plain',
                sizeBytes: doc.sizeBytes || 0,
                status: 'ready' as any,
                createdBy: doc.createdBy || '00000000-0000-0000-0000-000000000000',
              }),
            );
            versionId = newVer.id;
          }
        }

        await em.query('DELETE FROM rag_chunks WHERE version_id = $1', [versionId]);
        await bulkInsertChunks(
          ds,
          newChunks.map((c, i) => ({
            documentId: doc.id,
            versionId: versionId!,
            chunkIndex: c.chunkIndex,
            content: c.content,
            rawText: c.rawText,
            tokenCount: c.tokenCount,
            breadcrumb: c.breadcrumb,
            lawName: c.lawName,
            lawNumber: c.lawNumber ?? null,
            chapter: c.chapter ?? null,
            section: c.section ?? null,
            article: c.article,
            clause: c.clause ?? null,
            point: c.point ?? null,
            charStart: c.charStart,
            charEnd: c.charEnd,
            embeddingVec: vectors[i]!,
          })),
        );
        await em.getRepository(RagDocument).update(doc.id, {
          documentType: enrichment.documentType,
          lawName: enrichment.lawName,
          lawNumber: enrichment.lawNumber,
          issuer: enrichment.issuer,
          effectiveDate: enrichment.effectiveDate,
          expiryDate: enrichment.expiryDate,
          issuedDate: enrichment.issuedDate,
          legalStatus: enrichment.legalStatus,
          extraMetadata: enrichment.extraMetadata as never,
          chunkCount: newChunks.length,
          activeVersionId: versionId,
        });
      });
      ok++;
      console.log(`  ✓ ${doc.id} (${doc.name}) → ${newChunks.length} chunks`);
    } catch (e) {
      fail++;
      console.error(`  ✗ ${doc.id} (${doc.name}): ${(e as Error).message}`);
    }
  }

  console.log(`[reindex] Done. ok=${ok} fail=${fail} skipped=${skipped} total=${docs.length}`);
  await ds.destroy();
}

main().catch((e) => {
  console.error('[reindex] Fatal:', e);
  process.exit(1);
});
