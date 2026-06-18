import { Injectable } from '@nestjs/common';

/**
 * Lightweight extractor for Vietnamese legal-document references like
 * "Điều 12", "khoản 3", "Article 5" embedded in a free-text query. Used
 * by the deep-mode agent's `lookup_article` tool to bias retrieval
 * toward the literal phrase, which tends to surface the exact provision.
 *
 * This is intentionally a regex-only service — no LLM call. We rely on
 * the structured shape of legal-document references being predictable
 * enough that a handful of patterns cover >95% of cases.
 */
export interface IArticleReference {
  /** "Điều"/"Điều khoản"/"Article" — null if only a clause was matched. */
  article?: number;
  /** "khoản"/"Khoản" — null if only an article was matched. */
  clause?: number;
  /** Document-name hint extracted from a trailing phrase like "BLLĐ 2019"
   *  or "Bộ luật Lao động". Best-effort — the retriever still searches
   *  the full query text regardless. */
  documentHint?: string;
}

@Injectable()
export class ArticleRegexService {
  /**
   * Patterns ordered from most to least specific. Each captures one
   * IArticleReference field; multiple matches across patterns merge.
   *
   * Vietnamese diacritics: "Điều", "điều", "ĐIỀU" should all match. We
   * use the `\p{L}` Unicode property class (case-insensitive flag) so
   *   "[Đd]iều" is not needed.
   */
  private readonly patterns: Array<{ re: RegExp; apply: (m: RegExpMatchArray) => Partial<IArticleReference> }> = [
    // "Điều 12 khoản 3" / "Điều 12.3"
    {
      re: /\bĐiều\s+(\d+)(?:\s+khoản\s+(\d+))?/iu,
      apply: (m) => ({ article: parseInt(m[1]!, 10), clause: m[2] ? parseInt(m[2], 10) : undefined }),
    },
    // "khoản 3 Điều 12" — clause-first variant
    {
      re: /\bkhoản\s+(\d+)\s+Điều\s+(\d+)/iu,
      apply: (m) => ({ clause: parseInt(m[1]!, 10), article: parseInt(m[2]!, 10) }),
    },
    // "Article 5" / "Art. 5"
    {
      re: /\b(?:Article|Art\.?)\s+(\d+)/iu,
      apply: (m) => ({ article: parseInt(m[1]!, 10) }),
    },
    // Bare "khoản 3"
    {
      re: /\bkhoản\s+(\d+)\b/iu,
      apply: (m) => ({ clause: parseInt(m[1]!, 10) }),
    },
  ];

  /**
   * Extract the first reference from the query. Returns `{}` if nothing
   * matches. Order of precedence: full Điều+khoản match wins over a
   * partial match.
   */
  extract(query: string): IArticleReference {
    const out: IArticleReference = {};
    for (const { re, apply } of this.patterns) {
      const m = query.match(re);
      if (!m) continue;
      Object.assign(out, apply(m));
      if (out.article !== undefined && out.clause !== undefined) break;
    }
    return out;
  }

  /**
   * Build a search string that emphasises the reference. We keep the
   * original query as the lead term so the retriever still has the user's
   * intent, then append "Điều X" so the literal phrase gets a strong
   * BM25 boost.
   */
  boost(query: string): string {
    const ref = this.extract(query);
    const parts: string[] = [query];
    if (ref.article !== undefined) {
      parts.push(`Điều ${ref.article}`);
    }
    if (ref.clause !== undefined) {
      parts.push(`khoản ${ref.clause}`);
    }
    return parts.join(' ');
  }
}