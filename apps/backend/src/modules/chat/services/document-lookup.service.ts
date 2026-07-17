import { Injectable } from '@nestjs/common';
import { RetrieverService, IScoredChunk } from '../../rag/retrieval/retriever.service';
import { ArticleRegexService } from './article-regex.service';

/**
 * Events emitted by DocumentLookupService for chat-mode `lookup`. The
 * ChatService translates these into SSE frames; the FE renders them as
 * a citation-only response.
 *
 * Why an AsyncGenerator instead of a single object: future-proof. If
 * we later add per-chunk metadata enrichment (e.g. fetching document
 * page numbers or article headings), we can yield incrementally
 * without changing the consumer.
 */
export type LookupEvent =
  | { kind: 'lookup_intro'; count: number; query: string }
  | { kind: 'source'; chunk: IScoredChunk }
  | { kind: 'meta'; count: number }
  | { kind: 'done'; count: number };

/**
 * Citation-only retrieval path for chat mode `lookup`. No LLM call —
 * the response body is built from the raw retrieved chunks.
 *
 * The user's query is passed through `ArticleRegexService.boost()` so a
 * reference like "Điều 12 BLLĐ" gets a strong BM25 boost on the literal
 * phrase, surfacing the exact provision when one exists.
 */
@Injectable()
export class DocumentLookupService {
  constructor(
    private readonly retriever: RetrieverService,
    private readonly articleRegex: ArticleRegexService,
  ) {}

  async *stream(
    query: string,
    bucketName?: string,
    signal?: AbortSignal,
  ): AsyncGenerator<LookupEvent> {
    const trimmed = query.trim();
    if (!trimmed) {
      yield { kind: 'lookup_intro', count: 0, query };
      yield { kind: 'done', count: 0 };
      return;
    }

    // Boost the query with literal "Điều X" / "khoản Y" if present.
    const boosted = this.articleRegex.boost(trimmed);

    if (signal?.aborted) return;
    const chunks = await this.retriever.retrieve(boosted, bucketName);

    yield { kind: 'lookup_intro', count: chunks.length, query: trimmed };

    for (const chunk of chunks) {
      if (signal?.aborted) return;
      yield { kind: 'source', chunk };
    }

    yield { kind: 'meta', count: chunks.length };
    yield { kind: 'done', count: chunks.length };
  }
}
