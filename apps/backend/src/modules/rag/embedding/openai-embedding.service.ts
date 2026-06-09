import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

/**
 * Embedding service backed by OpenAI's `text-embedding-3-small` model.
 *
 * DeepSeek does not expose an embedding endpoint, so we hit OpenAI
 * directly. The two keys are intentionally separate so they can be
 * rotated / billed independently.
 */
@Injectable()
export class OpenAIEmbeddingService implements OnModuleInit {
  private readonly logger = new Logger(OpenAIEmbeddingService.name);
  private client: OpenAI | null = null;
  private model: string;
  private dim: number;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const apiKey = this.config.get<string>('app.openai.apiKey', '');
    this.model = this.config.get<string>('app.openai.embeddingModel', 'text-embedding-3-small');
    this.dim = this.config.get<number>('app.openai.embeddingDim', 1536);

    if (!apiKey) {
      this.logger.warn('OPENAI_API_KEY is empty — embeddings will fail. Set it in .env.');
      return;
    }
    this.client = new OpenAI({ apiKey, maxRetries: 1, timeout: 60_000 });
    this.logger.log(`OpenAI embeddings ready (model=${this.model}, dim=${this.dim})`);
  }

  isReady(): boolean {
    return this.client !== null;
  }

  getDim(): number {
    return this.dim;
  }

  /**
   * Embed a batch of texts. Returns one vector per input, in the same order.
   * Splits the input into chunks of 96 to stay comfortably under OpenAI's
   * per-request limit and to surface partial failures.
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!this.client) throw new Error('OpenAI embeddings not configured');
    if (texts.length === 0) return [];

    const BATCH = 96;
    const result: number[][] = [];
    for (let i = 0; i < texts.length; i += BATCH) {
      const slice = texts.slice(i, i + BATCH);
      const res = await this.client.embeddings.create({
        model: this.model,
        input: slice,
      });
      for (const item of res.data) {
        result.push(item.embedding as number[]);
      }
    }
    return result;
  }
}
