import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ILegalChunk } from '../chunking/legal-hierarchical-chunker.service';

/**
 * Embedding service specialized for legal chunks.
 *
 * Each chunk is wrapped with its breadcrumb BEFORE embedding so the
 * vector space captures the legal context. Without this, two chunks
 * with identical text but different parent (Điều 15 vs Điều 99) would
 * hash to the same vector — the most common cause of "retrieval returns
 * the wrong article" failures.
 *
 * Backed by `Xenova/bge-m3` (1024-dim, multilingual). Falls back to
 * Cloudflare Workers AI when configured.
 */
@Injectable()
export class LegalEmbeddingService implements OnModuleInit {
  private readonly logger = new Logger(LegalEmbeddingService.name);
  private readonly dim: number;
  private readonly model: string;
  private readonly prefixEnabled: boolean;
  private readonly backend: 'local' | 'cloudflare';
  private handle: {
    module: typeof import('@xenova/transformers');
    model: any;
    tokenizer: any;
  } | null = null;
  private cfAccountId = '';
  private cfApiToken = '';

  constructor(private readonly config: ConfigService) {
    this.dim = config.get<number>('app.embedding.dim', 1024);
    this.model = config.get<string>('app.embedding.model', 'Xenova/bge-m3');
    this.prefixEnabled = config.get<boolean>('app.embedding.useBgePrefix', false);
    this.backend =
      config.get<string>('app.embedding.backend', 'local') === 'cloudflare'
        ? 'cloudflare'
        : 'local';
    this.cfAccountId = config.get<string>('app.cloudflare.accountId', '');
    this.cfApiToken = config.get<string>('app.cloudflare.apiToken', '');
  }

  async onModuleInit(): Promise<void> {
    if (this.backend === 'cloudflare') {
      if (!this.cfAccountId || !this.cfApiToken) {
        throw new Error('Cloudflare backend selected but credentials missing');
      }
      this.logger.log(`Embedding: Cloudflare @cf/baai/bge-m3 (dim=${this.dim})`);
      return;
    }
    const t0 = Date.now();
    const dynamicImport = new Function('m', 'return import(m)') as <T = unknown>(
      m: string,
    ) => Promise<T>;
    const mod = (await dynamicImport(
      '@xenova/transformers',
    )) as typeof import('@xenova/transformers');
    if (process.env.EMBEDDING_CACHE_DIR) mod.env.cacheDir = process.env.EMBEDDING_CACHE_DIR;
    if (process.env.HF_ENDPOINT) mod.env.remoteHost = process.env.HF_ENDPOINT;
    const [model, tokenizer] = await Promise.all([
      mod.AutoModel.from_pretrained(this.model, { quantized: true }),
      mod.AutoTokenizer.from_pretrained(this.model),
    ]);
    this.handle = { module: mod, model, tokenizer };
    this.logger.log(`Embedding: local ${this.model} ready in ${Date.now() - t0}ms`);
  }

  isReady(): boolean {
    return this.backend === 'cloudflare' || this.handle !== null;
  }

  getDim(): number {
    return this.dim;
  }

  /**
   * Build the input string passed to the embedder for a chunk.
   * Public so unit tests can verify the format.
   */
  buildEmbeddingText(chunk: ILegalChunk): string {
    const parts: string[] = [];
    if (this.prefixEnabled) parts.push('passage:');
    if (chunk.lawName)
      parts.push(
        `Văn bản: ${chunk.lawName}${chunk.lawNumber ? ' (số ' + chunk.lawNumber + ')' : ''}.`,
      );
    if (chunk.chapter) parts.push(`Chương ${chunk.chapter}.`);
    if (chunk.section) parts.push(`Mục ${chunk.section}.`);
    if (chunk.article) parts.push(`Điều ${chunk.article}.`);
    if (chunk.clause) parts.push(`Khoản ${chunk.clause}.`);
    if (chunk.point) parts.push(`Điểm ${chunk.point}.`);
    parts.push(chunk.rawText);
    return parts.join(' ');
  }

  async embedChunks(chunks: ILegalChunk[]): Promise<number[][]> {
    if (chunks.length === 0) return [];
    const texts = chunks.map((c) => this.buildEmbeddingText(c));
    return this.embedRaw(texts);
  }

  async embedQueries(queries: string[]): Promise<number[][]> {
    if (queries.length === 0) return [];
    const texts = this.prefixEnabled ? queries.map((q) => `query: ${q}`) : queries;
    return this.embedRaw(texts);
  }

  // ─────────────────────────────────────────────────────────────────────

  private async embedRaw(texts: string[]): Promise<number[][]> {
    if (this.backend === 'cloudflare') return this.embedCloudflare(texts);
    if (!this.handle) throw new Error('Embedding model not loaded');
    const { model, tokenizer } = this.handle;
    const BATCH = 32;
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += BATCH) {
      const slice = texts.slice(i, i + BATCH);
      const inputs = await tokenizer(slice, { padding: true, truncation: true, max_length: 512 });
      const { last_hidden_state } = await model(inputs);
      const mask = inputs.attention_mask as import('@xenova/transformers').Tensor;
      const hidden = last_hidden_state.tolist() as number[][][];
      const m2 = mask.tolist() as number[][];
      for (let b = 0; b < hidden.length; b++) {
        const tokens = hidden[b]!;
        const m = m2[b]!;
        const dim = tokens[0]?.length ?? 0;
        const sum = new Array<number>(dim).fill(0);
        let count = 0;
        for (let t = 0; t < tokens.length; t++) {
          const mm = Number(m[t] ?? 0);
          if (mm === 0) continue;
          const tok = tokens[t]!;
          for (let h = 0; h < dim; h++) sum[h]! += (tok[h] as number) * mm;
          count += mm;
        }
        const denom = count > 0 ? count : 1e-9;
        const pooled = sum.map((v) => v / denom);
        let norm = 0;
        for (const v of pooled) norm += v * v;
        norm = Math.sqrt(norm) || 1e-9;
        out.push(pooled.map((v) => v / norm));
      }
    }
    return out;
  }

  private async embedCloudflare(texts: string[]): Promise<number[][]> {
    const BATCH = 32;
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += BATCH) {
      const slice = texts.slice(i, i + BATCH);
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.cfAccountId}/ai/run/@cf/baai/bge-m3`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.cfApiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: slice }),
        },
      );
      if (!res.ok) throw new Error(`CF embed failed: ${res.status} ${await res.text()}`);
      const body = (await res.json()) as { result?: { data?: number[][] }; success: boolean };
      if (!body.success || !body.result?.data) throw new Error('CF embed: bad response');
      out.push(...body.result.data);
    }
    return out;
  }
}
