import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// `@xenova/transformers` (v2.x) is a Node port of Hugging Face transformers.
// API is identical to `@huggingface/transformers` (v3+); we pin to the
// xenova fork because it's smaller and bundles its own onnxruntime.
// We `require` it dynamically inside `onModuleInit` so the module is
// not evaluated at import time — that keeps the import graph small and
// also lets us catch loading errors at boot rather than at first use.

type XenovaModule = typeof import('@xenova/transformers');

interface XenovaHandle {
  module: XenovaModule;
  model: import('@xenova/transformers').PreTrainedModel;
  tokenizer: import('@xenova/transformers').PreTrainedTokenizer;
}

/**
 * Local embedding service.
 *
 * Runs `Xenova/bge-m3` (multilingual, dim 1024) in-process via ONNX
 * runtime. Chosen because:
 * - high quality on Vietnamese (good fit for legal corpora)
 * - no API key, no network egress, no per-token cost
 * - dense 1024-dim output works with the existing cosine top-K in
 * `RetrieverService` (it filters dim mismatches automatically)
 *
 * The first boot downloads the quantized model to
 * `node_modules/@xenova/transformers/.cache` (or `EMBEDDING_CACHE_DIR` if
 * set) — ~600 MB for bge-m3 quantized. Subsequent boots load from cache
 * in a few seconds.
 *
 * `OnModuleInit` is async — Nest awaits it before considering the module
 * ready, so `isReady()` is always true once `app.listen()` resolves.
 */
@Injectable()
export class LocalEmbeddingService implements OnModuleInit {
  private readonly logger = new Logger(LocalEmbeddingService.name);
  private handle: XenovaHandle | null = null;
  private readonly model: string;
  private readonly dim: number;
  private readonly cfAccountId: string;
  private readonly cfApiToken: string;
  private isCfEnabled = false;

  constructor(private readonly config: ConfigService) {
    this.model = this.config.get<string>('app.embedding.model', 'Xenova/bge-m3');
    this.dim = this.config.get<number>('app.embedding.dim', 1024);
    this.cfAccountId = this.config.get<string>('app.cloudflare.accountId', '');
    this.cfApiToken = this.config.get<string>('app.cloudflare.apiToken', '');
  }

  async onModuleInit(): Promise<void> {
    if (this.cfApiToken && this.cfAccountId) {
      this.isCfEnabled = true;
      this.logger.log(
        `Using Cloudflare Workers AI for embedding model "${this.model}" (dim=${this.dim})`,
      );
      return;
    }

    this.logger.log(`Loading local embedding model "${this.model}" (dim=${this.dim})…`);
    const t0 = Date.now();
    try {
      // `@xenova/transformers@2.x` is ESM-only. The backend compiles to
      // CommonJS, so a plain `await import(...)` gets down-leveled to
      // `require(...)` by `tsc` and crashes at runtime with
      // `ERR_REQUIRE_ESM`. The `new Function(...)` trick keeps the call
      // as a real dynamic import that Node can dispatch to the ESM loader.
      // (Cheaper than flipping the whole project to `module: Node16`.)
      const dynamicImport = new Function('m', 'return import(m)') as <T = unknown>(
        m: string,
      ) => Promise<T>;
      const mod = (await dynamicImport('@xenova/transformers')) as XenovaModule;
      // Allow the cache dir to be redirected (useful in Docker — mount a
      // volume so the model survives image rebuilds).
      const cacheDir = process.env.EMBEDDING_CACHE_DIR;
      if (cacheDir) mod.env.cacheDir = cacheDir;

      // Use hf-mirror.com as a fast fallback to prevent network timeouts/blockage on VPS
      const hfEndpoint = process.env.HF_ENDPOINT || 'https://hf-mirror.com/';
      mod.env.remoteHost = hfEndpoint;

      // Quiet the per-file progress bar in dev logs.
      mod.env.allowLocalModels = true;

      const [model, tokenizer] = await Promise.all([
        mod.AutoModel.from_pretrained(this.model, { quantized: true }),
        mod.AutoTokenizer.from_pretrained(this.model),
      ]);
      this.handle = { module: mod, model, tokenizer };
      this.logger.log(
        `Local embedding model ready (model=${this.model}, loaded in ${Date.now() - t0}ms)`,
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`Failed to load embedding model: ${msg}`);
      throw e;
    }
  }

  isReady(): boolean {
    return this.isCfEnabled || this.handle !== null;
  }

  getDim(): number {
    return this.dim;
  }

  /**
   * Embed a batch of texts. Returns one vector per input, in the same order.
   * Splits into chunks of 64 to keep peak memory bounded (bge-m3 with
   * seq-len 512 ≈ 80–120 MB per batch on CPU).
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    if (this.isCfEnabled) {
      return this.embedBatchCloudflare(texts);
    }

    if (!this.handle) throw new Error('Local embedding not configured');

    const { model, tokenizer } = this.handle;
    const BATCH = 64;
    const result: number[][] = [];
    for (let i = 0; i < texts.length; i += BATCH) {
      const slice = texts.slice(i, i + BATCH);
      // bge-m3 docs: prepend the query/passage prefix? — bge-m3 does NOT
      // require a prefix; we pass the raw text. If we ever swap in
      // `bge-small-en-v1.5` or `bge-large-en-v1.5`, add a prefix here.
      const inputs = await tokenizer(slice, { padding: true, truncation: true });
      // `BaseModelOutput` (the type returned by encoder-only models like
      // bge-m3) only exposes `last_hidden_state`/`hidden_states`/`attentions`.
      // The attention mask lives on the **inputs** (tokenizer output), not
      // on the model output — so we read it from `inputs.attention_mask`.
      // Using `output.attention_mask` returns `undefined`.
      const { last_hidden_state } = await model(inputs);
      const attentionMask = inputs.attention_mask as import('@xenova/transformers').Tensor;

      // Mean-pool with attention mask, then L2-normalize.
      const hidden = last_hidden_state.tolist() as number[][][]; // [B, T, H]
      const mask2d = attentionMask.tolist() as number[][]; // [B, T]
      for (let b = 0; b < hidden.length; b++) {
        const tokens = hidden[b]!;
        const mask = mask2d[b]!;
        const dim = tokens[0]?.length ?? 0;
        const sum = new Array<number>(dim).fill(0);
        let count = 0;
        for (let t = 0; t < tokens.length; t++) {
          const m = Number(mask[t] ?? 0);
          if (m === 0) continue;
          const tok = tokens[t]!;
          for (let h = 0; h < dim; h++) sum[h]! += (tok[h] as number) * m;
          count += m;
        }
        const denom = count > 0 ? count : 1e-9;
        const pooled = sum.map((v) => v / denom);
        // L2-normalize so cosine in the retriever is a plain dot product.
        let norm = 0;
        for (const v of pooled) norm += v * v;
        norm = Math.sqrt(norm) || 1e-9;
        result.push(pooled.map((v) => v / norm));
      }
    }
    return result;
  }

  private async embedBatchCloudflare(texts: string[]): Promise<number[][]> {
    const BATCH = 32;
    const result: number[][] = [];

    for (let i = 0; i < texts.length; i += BATCH) {
      const slice = texts.slice(i, i + BATCH);
      const url = `https://api.cloudflare.com/client/v4/accounts/${this.cfAccountId}/ai/run/@cf/baai/bge-m3`;

      const t0 = Date.now();
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.cfApiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: slice,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        this.logger.error(
          `Cloudflare Workers AI embedding request failed: Status ${response.status} - ${errText}`,
        );
        throw new Error(`Cloudflare Workers AI embedding failed with status ${response.status}`);
      }

      const resBody = (await response.json()) as {
        result?: { data?: number[][] };
        success: boolean;
        errors?: any[];
      };

      if (!resBody.success || !resBody.result?.data) {
        const errors = JSON.stringify(resBody.errors || []);
        this.logger.error(`Cloudflare Workers AI error: ${errors}`);
        throw new Error(`Cloudflare Workers AI failed: ${errors}`);
      }

      result.push(...resBody.result.data);
      this.logger.debug(
        `Embedded batch of ${slice.length} items via Cloudflare in ${Date.now() - t0}ms`,
      );
    }

    return result;
  }
}
