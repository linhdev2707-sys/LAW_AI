import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import { join, sep, relative } from 'path';
import { createHash } from 'crypto';
import { RagService } from './rag.service';

/**
 * Bulk-import legal documents that have already been scraped + OCR'd
 * into `processed/<category>/<docId>/v1.json`. Each file becomes one
 * `rag_documents` row + N `rag_chunks` rows after going through the
 * normal ingest pipeline (chunk → embed → store in pgvector).
 *
 * Folder layout (must be exactly this shape):
 * <dir>/
 * hinh_su/
 * 215260/
 * v1.json
 * 214312/
 * v1.json
 * dan_su/
 * 12345/
 * v1.json
 *
 * v1.json is an array of `{ level, label, text }` sections. We just
 * concatenate them with light separators — the legal hierarchical
 * chunker re-parses the joined text on its own.
 */
export interface IImportFileResult {
  ok: boolean;
  skipped?: boolean;
  /** docId (UUID) returned by RagService — present when `ok`. */
  docId?: string;
  /** Number of chunks the ingest produced. */
  chunkCount?: number;
  /** Final status from `RagDocumentStatus` (e.g. READY, FAILED). */
  status?: string;
  /** Human-readable error when `ok=false`. */
  error?: string;
  /** Wall-clock milliseconds spent on this file. */
  durationMs: number;
}

export interface IImportSummary {
  ok: number;
  skipped: number;
  failed: number;
  total: number;
  durationMs: number;
  results: Array<{ key: string; result: IImportFileResult }>;
}

/** One section entry as produced by the OCR pipeline. */
interface ILegalSection {
  level: string;
  label: string;
  text: string;
}

@Injectable()
export class KnowledgeImportService {
  private readonly logger = new Logger(KnowledgeImportService.name);

  constructor(
    private readonly ragService: RagService,
    private readonly config: ConfigService,
  ) {}

  // ─── Public API ─────────────────────────────────────────────────────

  /**
   * Walk a directory, ingest every `v1.json` file under it.
   * Concurrency is bounded by `KNOWLEDGE_IMPORT_CONCURRENCY` (default 3)
   * to keep the embedding backend (local bge-m3 or Cloudflare Workers AI)
   * from being overrun by parallel jobs.
   */
  async importFolder(dir: string): Promise<IImportSummary> {
    const start = Date.now();
    const bucket = this.config.get<string>('app.knowledgeImport.bucket') || 'law-ai-rag-knowledge';
    const concurrency = this.config.get<number>('app.knowledgeImport.concurrency', 3);
    const dryRun = this.config.get<boolean>('app.knowledgeImport.dryRun') ?? false;

    const files = await this.findJsonFiles(dir);
    this.logger.log(
      `[knowledge-import] Found ${files.length} JSON file(s) under ${dir} ` +
        `(bucket=${bucket}, concurrency=${concurrency}, dryRun=${dryRun})`,
    );

    const results: Array<{ key: string; result: IImportFileResult }> = [];
    // Sequential batches of `concurrency` — preserves order in logs and
    // caps memory + embedding load. No external dep (p-limit) needed.
    for (let i = 0; i < files.length; i += concurrency) {
      const batch = files.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(async (f) => {
          const key = this.fileKey(dir, f);
          try {
            const r = await this.importFile(f, bucket, dryRun);
            return { key, result: r };
          } catch (e) {
            // Belt-and-braces — importFile already catches, but a thrown
            // rejection here would tear down the whole batch.
            return {
              key,
              result: {
                ok: false,
                error: e instanceof Error ? e.message : String(e),
                durationMs: 0,
              },
            };
          }
        }),
      );
      results.push(...batchResults);
    }

    const summary: IImportSummary = {
      ok: results.filter((r) => r.result.ok).length,
      skipped: results.filter((r) => r.result.skipped).length,
      failed: results.filter((r) => !r.result.ok).length,
      total: results.length,
      durationMs: Date.now() - start,
      results,
    };

    this.logger.log(
      `[knowledge-import] Done. ok=${summary.ok} skipped=${summary.skipped} ` +
        `failed=${summary.failed} total=${summary.total} ` +
        `in ${(summary.durationMs / 1000).toFixed(1)}s`,
    );
    return summary;
  }

  /**
   * Import a single `v1.json` file. Always resolves — never throws.
   * Designed for both the sweeper (which logs and moves on) and the CLI
   * (which prints per-file status). Failures are encoded in the result.
   */
  async importFile(filePath: string, bucket: string, dryRun: boolean): Promise<IImportFileResult> {
    const start = Date.now();
    try {
      // 1. Validate path shape — must be <dir>/<category>/<docId>/v1.json
      const parsed = this.parseRelativePath(filePath);
      if (!parsed) {
        return {
          ok: false,
          error: `unexpected path shape, want <dir>/<category>/<docId>/v1.json`,
          durationMs: Date.now() - start,
        };
      }
      const { category, docId } = parsed;
      const name = `${category}/${docId}`;

      // 2. Read + parse JSON
      const raw = await fs.readFile(filePath, 'utf8');
      let sections: ILegalSection[];
      try {
        sections = JSON.parse(raw);
      } catch (e) {
        return {
          ok: false,
          error: `invalid JSON: ${e instanceof Error ? e.message : String(e)}`,
          durationMs: Date.now() - start,
        };
      }
      if (!Array.isArray(sections) || sections.length === 0) {
        return {
          ok: false,
          error: 'empty or non-array JSON payload',
          durationMs: Date.now() - start,
        };
      }
      const content = joinLegalSections(sections);
      if (!content.trim()) {
        return {
          ok: false,
          error: 'joined content is empty',
          durationMs: Date.now() - start,
        };
      }

      // 3. sha256 — used for dedup check below.
      const sha256 = createHash('sha256').update(content).digest('hex');

      if (dryRun) {
        this.logger.log(
          `[knowledge-import] [DRY-RUN] ${name} would ingest ` +
            `(${sections.length} sections, ${content.length} chars, sha256=${sha256.slice(0, 12)}…)`,
        );
        return {
          ok: true,
          skipped: false,
          chunkCount: sections.length,
          status: 'DRY_RUN',
          durationMs: Date.now() - start,
        };
      }

      // 4. Delegate to RagService.ingest — it runs the full pipeline:
      // R2 upload → chunking → embedding → DB insert → manifest update.
      // checkManifestDuplicate is also called inside ingestBuffer path,
      // but ingest() (the JSON variant) goes straight through, so we do
      // the dedup check here explicitly.
      try {
        await this.ragService['checkManifestDuplicate'](bucket, sha256);
      } catch (e) {
        // ConflictException = duplicate; anything else is a real R2 read
        // problem — let it bubble so we don't silently skip uploads.
        if (e && typeof e === 'object' && 'name' in e) {
          const errName = (e as { name?: string }).name;
          if (errName === 'ConflictException' || errName === 'BadRequestException') {
            this.logger.log(
              `[knowledge-import] [${name}] ⊘ duplicate (sha256=${sha256.slice(0, 12)}…)`,
            );
            return {
              ok: true,
              skipped: true,
              durationMs: Date.now() - start,
            };
          }
        }
        // NoSuchKey / NotFound = first ingest into this bucket, that's fine.
        // rethrow anything else.
        if (
          !(e instanceof Error) ||
          !['NoSuchKey', 'NotFound'].includes((e as { name?: string }).name ?? '')
        ) {
          // Bubble up real errors (auth, network, etc.)
          // but ignore "missing manifest" which is the common case.
          const msg = e instanceof Error ? e.message : String(e);
          if (!/manifest/i.test(msg)) {
            return {
              ok: false,
              error: `manifest check failed: ${msg}`,
              durationMs: Date.now() - start,
            };
          }
        }
      }

      // 5. Run the actual ingest. Use the JSON entrypoint so mimeType is
      // application/json — RagService serialises content into a structured
      // R2 object (documentId + name + text) instead of a raw .txt blob.
      const result = await this.ragService.ingest(
        {
          name,
          content,
          mimeType: 'application/json',
          bucket,
        },
        // Synthetic system user — bulk import is server-driven, not admin-
        // driven. The `createdBy` field is only used for audit display.
        'system:knowledge-import',
      );

      this.logger.log(
        `[knowledge-import] [${name}] ✓ ${result.chunkCount} chunks ` +
          `(${(Date.now() - start) / 1000}s)`,
      );
      return {
        ok: true,
        skipped: false,
        docId: result.id,
        chunkCount: result.chunkCount,
        status: result.status,
        durationMs: Date.now() - start,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`[knowledge-import] [${filePath}] ✗ ${msg}`);
      return {
        ok: false,
        error: msg,
        durationMs: Date.now() - start,
      };
    }
  }

  // ─── Internals ──────────────────────────────────────────────────────

  /** Recursively find every `v1.json` under `dir`. */
  private async findJsonFiles(dir: string): Promise<string[]> {
    const out: string[] = [];
    const stack = [dir];
    while (stack.length) {
      const current = stack.pop()!;
      let entries;
      try {
        entries = await fs.readdir(current, { withFileTypes: true });
      } catch (e) {
        this.logger.warn(
          `[knowledge-import] cannot read ${current}: ${
            e instanceof Error ? e.message : String(e)
          }`,
        );
        continue;
      }
      for (const e of entries) {
        const full = join(current, e.name);
        if (e.isDirectory()) stack.push(full);
        else if (e.isFile() && e.name === 'v1.json') out.push(full);
      }
    }
    out.sort(); // deterministic order across runs
    return out;
  }

  /**
   * Derive `<category>/<docId>` key from absolute path.
   * Returns null if the path doesn't match the expected shape so the
   * caller can log a clear error.
   */
  private fileKey(rootDir: string, filePath: string): string {
    const rel = relative(rootDir, filePath).split(sep).join('/');
    const parts = rel.split('/');
    // ["<category>", "<docId>", "v1.json"]
    if (parts.length !== 3 || parts[2] !== 'v1.json') return rel;
    return `${parts[0]}/${parts[1]}`;
  }

  private parseRelativePath(filePath: string): { category: string; docId: string } | null {
    const parts = filePath.split(/[/\\]/);
    // …/<rootDir>/<category>/<docId>/v1.json
    if (parts.length < 4) return null;
    const filename = parts[parts.length - 1];
    if (filename !== 'v1.json') return null;
    const docId = parts[parts.length - 2];
    const category = parts[parts.length - 3];
    if (!category || !docId) return null;
    return { category, docId };
  }
}

/**
 * Join the `{ level, label, text }` sections into a single flat text
 * the legal chunker can re-segment. We keep sections in order but don't
 * try to be clever about nesting — the chunker reads `text` fields as
 * the unit of truth and re-derives Điều/Khoản boundaries from there.
 *
 * Format:
 * <label>
 * <text>
 * <blank>
 *
 * The blank line lets the regex-based structure parser pick up section
 * breaks later.
 */
export function joinLegalSections(sections: ILegalSection[]): string {
  const blocks: string[] = [];
  for (const s of sections) {
    if (!s || typeof s.text !== 'string') continue;
    const label = (s.label ?? '').toString().trim();
    const text = s.text.trim();
    if (!text) continue;
    if (label) blocks.push(`${label}\n${text}`);
    else blocks.push(text);
  }
  return blocks.join('\n\n');
}
