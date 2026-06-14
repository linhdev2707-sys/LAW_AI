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

  constructor(private readonly config: ConfigService) {
    this.model = this.config.get<string>('app.embedding.model', 'Xenova/bge-m3');
    this.dim = this.config.get<number>('app.embedding.dim', 1024);
  }

  async onModuleInit(): Promise<void> {
    this.logger.log(`Loading embedding model "${this.model}" (dim=${this.dim})…`);
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
      // Quiet the per-file progress bar in dev logs.
      mod.env.allowLocalModels = true;

      const [model, tokenizer] = await Promise.all([
        mod.AutoModel.from_pretrained(this.model, { quantized: true }),
        mod.AutoTokenizer.from_pretrained(this.model),
      ]);
      this.handle = { module: mod, model, tokenizer };
      this.logger.log(
        `Embedding model ready (model=${this.model}, loaded in ${Date.now() - t0}ms)`,
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`Failed to load embedding model: ${msg}`);
      throw e;
    }
  }

  isReady(): boolean {
    return this.handle !== null;
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
    if (!this.handle) throw new Error('Local embedding not configured');
    if (texts.length === 0) return [];

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
      //
      // Why not on `Tensor`? `Tensor` in @xenova/transformers 2.x has
      // no `.expand()` — only `.view()`, which keeps the element count
      // fixed. Going from [B, T, 1] to [B, T, H] needs a factor of H
      // more elements, so it throws "Tensor's size(N) does not match
      // data length(M)". There's no strided broadcast either, so the
      // simplest reliable path is to drop to JS arrays for the per-
      // token math. For batch 64 × seq 512 × hidden 1024 that's ~32M
      // mul-add ops — well under 50ms on a modern CPU, and only runs
      // once per ingest batch.
      const hidden = last_hidden_state.tolist() as number[][][]; // [B, T, H]
      const mask2d = attentionMask.tolist() as number[][]; // [B, T]
      for (let b = 0; b < hidden.length; b++) {
        const tokens = hidden[b]!;
        const mask = mask2d[b]!;
        const dim = tokens[0]?.length ?? 0;
        const sum = new Array<number>(dim).fill(0);
        let count = 0;
        for (let t = 0; t < tokens.length; t++) {
          // `mask` is the attention mask — its backing tensor is int64, so
          // `tolist()` returns `BigInt`. Coerce to plain `number` here so the
          // multiply below doesn't throw "Cannot mix BigInt and other types".
          // (Hidden states are float32 → `number` already.)
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
}
