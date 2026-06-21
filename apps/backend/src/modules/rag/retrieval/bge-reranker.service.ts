import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IScoredChunk } from './retriever.service';

/**
 * Cross-encoder reranker using `Xenova/bge-reranker-v2-m3`.
 *
 * Why a reranker: bi-encoders (the embedder) compress a query/document
 * into a SINGLE vector — interaction between query terms and document
 * terms is lost. A cross-encoder sees (query, document) TOGETHER and
 * outputs a calibrated relevance score. In practice reranking the top
 * 50 retrieval results down to top 5 with a cross-encoder lifts
 * Recall@5 by 15-25 points on legal benchmarks.
 *
 * Local mode is the default; set `app.reranker.backend=cohere` to use
 * the Cohere API.
 */
@Injectable()
export class BgeRerankerService implements OnModuleInit {
  private readonly logger = new Logger(BgeRerankerService.name);
  private readonly model: string;
  private readonly maxLength: number;
  private readonly backend: 'local' | 'cohere';
  private readonly enabled: boolean;
  private handle: { module: typeof import('@xenova/transformers'); model: any; tokenizer: any } | null = null;
  private cohereKey = '';

  constructor(private readonly config: ConfigService) {
    this.model = config.get<string>('app.reranker.model', 'Xenova/bge-reranker-v2-m3');
    this.maxLength = config.get<number>('app.reranker.maxLength', 512);
    this.backend = config.get<string>('app.reranker.backend', 'local') === 'cohere' ? 'cohere' : 'local';
    this.cohereKey = config.get<string>('app.cohere.apiKey', '');
    this.enabled = config.get<boolean>('app.reranker.enabled', true);
  }

  async onModuleInit(): Promise<void> {
    if (!this.enabled) {
      this.logger.log('Reranker disabled via config — skipping init');
      return;
    }
    if (this.backend === 'cohere') {
      if (!this.cohereKey) {
        this.logger.warn('Cohere reranker selected but COHERE_API_KEY is empty — reranker will be a no-op');
        return;
      }
      this.logger.log('Reranker: Cohere rerank-v3.5');
      return;
    }
    try {
      const dynamicImport = new Function('m', 'return import(m)') as <T = unknown>(m: string) => Promise<T>;
      const mod = (await dynamicImport('@xenova/transformers')) as typeof import('@xenova/transformers');
      if (process.env.EMBEDDING_CACHE_DIR) mod.env.cacheDir = process.env.EMBEDDING_CACHE_DIR;
      if (process.env.HF_ENDPOINT) mod.env.remoteHost = process.env.HF_ENDPOINT;
      const [model, tokenizer] = await Promise.all([
        mod.AutoModelForSequenceClassification.from_pretrained(this.model, { quantized: true }),
        mod.AutoTokenizer.from_pretrained(this.model),
      ]);
      this.handle = { module: mod, model, tokenizer };
      this.logger.log(`Reranker: local ${this.model} ready`);
    } catch (e: unknown) {
      this.logger.error(`Failed to load reranker model: ${(e as Error).message}`);
      this.logger.warn('Reranker disabled — retrieval will return unranked candidates');
      this.handle = null;
    }
  }

  isReady(): boolean {
    if (!this.enabled) return false;
    if (this.backend === 'cohere') return this.cohereKey.length > 0;
    return this.handle !== null;
  }

  /**
   * Rerank `chunks` against `query` and return the top-`topN` in
   * descending relevance order. The `score` field of each result is
   * REPLACED with the reranker score; `index` is reassigned 1-based.
   *
   * If the reranker is not ready (disabled, missing model, network
   * error), this is a no-op pass-through: it sorts by the existing
   * `score` desc and slices to topN. The retrieval pipeline never
   * fails because the reranker is unavailable.
   */
  async rerank(query: string, chunks: IScoredChunk[], topN: number): Promise<IScoredChunk[]> {
    if (chunks.length === 0) return [];
    if (chunks.length <= topN) {
      return chunks.map((c, i) => ({ ...c, index: i + 1 }));
    }
    if (!this.isReady()) {
      this.logger.debug('Reranker not ready — returning top-N by existing score');
      return chunks
        .slice()
        .sort((a, b) => b.score - a.score)
        .slice(0, topN)
        .map((c, i) => ({ ...c, index: i + 1 }));
    }

    try {
      if (this.backend === 'cohere') return await this.rerankCohere(query, chunks, topN);
      return await this.rerankLocal(query, chunks, topN);
    } catch (e: unknown) {
      this.logger.warn(`Rerank failed, falling back to score-order: ${(e as Error).message}`);
      return chunks
        .slice()
        .sort((a, b) => b.score - a.score)
        .slice(0, topN)
        .map((c, i) => ({ ...c, index: i + 1 }));
    }
  }

  // ─────────────────────────────────────────────────────────────────────

  private async rerankLocal(query: string, chunks: IScoredChunk[], topN: number): Promise<IScoredChunk[]> {
    if (!this.handle) throw new Error('Reranker not loaded');
    const { model, tokenizer } = this.handle;
    const pairs = chunks.map((c) => [query, c.content] as [string, string]);
    const BATCH = 16;
    const scores: number[] = [];
    for (let i = 0; i < pairs.length; i += BATCH) {
      const slice = pairs.slice(i, i + BATCH);
      const inputs = await tokenizer(slice, {
        padding: true,
        truncation: true,
        max_length: this.maxLength,
      });
      const outputs = await model(inputs);
      const logits = outputs.logits.tolist() as number[][];
      for (const row of logits) {
        // bge-reranker emits a single logit per pair; sigmoid to get a probability.
        const s = row.length > 1 ? row[1]! : row[0]!;
        scores.push(1 / (1 + Math.exp(-s)));
      }
    }
    return chunks
      .map((c, i) => ({ c, s: scores[i]! }))
      .sort((a, b) => b.s - a.s)
      .slice(0, topN)
      .map(({ c, s }, i) => ({ ...c, score: s, index: i + 1 }));
  }

  private async rerankCohere(query: string, chunks: IScoredChunk[], topN: number): Promise<IScoredChunk[]> {
    const docs = chunks.map((c) => c.content);
    const res = await fetch('https://api.cohere.ai/v1/rerank', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.cohereKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'rerank-v3.5',
        query,
        documents: docs,
        top_n: topN,
        return_documents: false,
      }),
    });
    if (!res.ok) throw new Error(`Cohere rerank failed: ${res.status}`);
    const body = (await res.json()) as { results: Array<{ index: number; relevance_score: number }> };
    return body.results
      .map((r) => ({ ...chunks[r.index]!, score: r.relevance_score }))
      .sort((a, b) => b.score - a.score)
      .map((c, i) => ({ ...c, index: i + 1 }));
  }
}
