/**
 * Smoke test: parse a sample Vietnamese legal document with the
 * LegalStructureParser + LegalHierarchicalChunker. Run with:
 *
 *   npx ts-node -r tsconfig-paths/register src/scripts/smoke-test.ts
 */
import 'dotenv/config';
import { readFileSync } from 'fs';
import { LegalStructureParser } from '../modules/rag/parsers/legal-structure.parser';
import { LegalHierarchicalChunkerService } from '../modules/rag/chunking/legal-hierarchical-chunker.service';
import { MetadataEnricherService } from '../modules/rag/parsers/metadata-enricher.service';
import { ReferenceExtractorService } from '../modules/rag/parsers/reference-extractor.service';
import type { ConfigService } from '@nestjs/config';

const cfg: ConfigService = {
  get: <T>(key: string, fallback?: T): T | undefined => {
    const m: Record<string, string> = {
      'app.rag.chunkSize': '480',
      'app.rag.hardChunkSize': '720',
      'app.rag.chunkOverlap': '50',
      'app.rag.enricherUseLlm': 'false',
    };
    const v = m[key];
    if (v === undefined) return fallback;
    if (typeof fallback === 'number') return parseFloat(v) as unknown as T;
    if (typeof fallback === 'boolean') return (v === 'true') as unknown as T;
    return v as unknown as T;
  },
} as unknown as ConfigService;

const text = readFileSync(process.argv[2] ?? 'sample-law.txt', 'utf8');
console.log(`\n========== SMOKE TEST ==========`);
console.log(`Input: ${text.length} chars\n`);

const parser = new LegalStructureParser();
const structure = parser.parse(text);
const articles = parser.flattenArticles(structure);

console.log(`── LegalStructureParser ──`);
console.log(`  Chương: ${structure.chuongList.length}`);
for (const c of structure.chuongList) {
  console.log(`    Chương ${c.roman} (${c.title || '(no title)'})`);
  for (const d of c.dieuList) {
    console.log(
      `      Điều ${d.number} (${d.title || '(no title)'}) — ${d.khoanList.length} khoản`,
    );
  }
  for (const m of c.mucList) {
    console.log(`    Mục ${m.number} (${m.title || '(no title)'})`);
    for (const d of m.dieuList) {
      console.log(`      Điều ${d.number} — ${d.khoanList.length} khoản`);
    }
  }
}
console.log(`  Preamble Điều: ${structure.preambleDieuList.length}`);
console.log(`  Total articles: ${articles.length}`);

const chunker = new LegalHierarchicalChunkerService(parser, cfg);
const chunks = chunker.chunk(text, 'Bộ luật Lao động 2019', '45/2019/QH14');

console.log(`\n── LegalHierarchicalChunker ──`);
console.log(`  Chunks: ${chunks.length}\n`);
for (const c of chunks.slice(0, 8)) {
  console.log(`  [${c.chunkIndex}] ${c.breadcrumb}`);
  console.log(
    `      law=${c.lawName} chương=${c.chapter ?? '-'} điều=${c.article} khoản=${c.clause ?? '-'} điểm=${c.point ?? '-'}`,
  );
  console.log(`      tokens=${c.tokenCount} chars=${c.rawText.length}`);
  console.log(`      text: ${c.rawText.slice(0, 80).replace(/\n/g, ' ')}…\n`);
}

const enricher = new MetadataEnricherService(cfg, undefined);
enricher
  .enrich({ documentName: 'Bộ luật Lao động 2019', fullText: text })
  .then((enrichment) => {
    console.log(`── MetadataEnricher ──`);
    console.log(`  lawName:    ${enrichment.lawName}`);
    console.log(`  lawNumber:  ${enrichment.lawNumber}`);
    console.log(`  documentType: ${enrichment.documentType}`);
    console.log(`  issuer:     ${enrichment.issuer}`);
    console.log(`  legalStatus: ${enrichment.legalStatus}`);
  })
  .catch((e) => console.warn('enrichment failed', e));

const refExtractor = new ReferenceExtractorService();
const refs = refExtractor.extract(text);
console.log(`\n── ReferenceExtractor ──`);
console.log(`  References: ${refs.length}`);
for (const r of refs.slice(0, 5)) {
  console.log(
    `    [${r.charStart}..${r.charEnd}] ${r.raw} → article=${r.article ?? '-'} target=${r.targetLawName ?? '-'}`,
  );
}
