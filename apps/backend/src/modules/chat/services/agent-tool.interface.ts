import { IScoredChunk, IRetrieverFilters } from '../../rag/retrieval/retriever.service';
import { IExtractedReference } from '../../rag/parsers/reference-extractor.service';

/** Tool name constants — keep in sync with the TOOLS array in AgentService. */
export const AGENT_TOOL_NAMES = {
  SEMANTIC_SEARCH: 'searchSemantic',
  KEYWORD_SEARCH: 'searchKeyword',
  GET_ARTICLE: 'getArticle',
  GET_DOCUMENT: 'getDocument',
  EXPAND_REFERENCES: 'expandReferences',
  COMPARE_ARTICLES: 'compareArticles',
  EFFECTIVE_DATE_CHECK: 'effectiveDateCheck',
} as const;

export type AgentToolName = typeof AGENT_TOOL_NAMES[keyof typeof AGENT_TOOL_NAMES];

/** OpenAI-compatible tool definition (DeepSeek reuses this format). */
export interface IToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, { type: string; description: string; enum?: string[] }>;
      required: string[];
    };
  };
}

// ─── Per-tool argument shapes ─────────────────────────────────────────

export interface ISemanticSearchArgs {
  query: string;
  lawNumber?: string;
  lawName?: string;
  article?: string;
  clause?: string;
  topK?: number;
}

export interface IKeywordSearchArgs {
  query: string;
  lawNumber?: string;
  topK?: number;
}

export interface IGetArticleArgs {
  lawNumber?: string;
  lawName?: string;
  article: string;
  clause?: string;
  point?: string;
}

export interface IGetDocumentArgs {
  lawNumber?: string;
  lawName?: string;
  documentId?: string;
}

export interface IExpandReferencesArgs {
  /** Reference text as it appears in the source, e.g. "Điều 15 Bộ luật Lao động 2019". */
  text: string;
  /** "forward" = who this references, "backward" = who references this. */
  direction?: 'forward' | 'backward' | 'both';
}

export interface ICompareArticlesArgs {
  lawA: string;
  articleA: string;
  lawB: string;
  articleB: string;
}

export interface IEffectiveDateCheckArgs {
  lawNumber?: string;
  lawName?: string;
  article: string;
}

// ─── Per-tool result shapes ───────────────────────────────────────────

/**
 * Self-contained citation unit. `breadcrumb` is the human-readable
 * "Bộ luật Lao động 2019 > Chương II > Mục 1 > Điều 15 > Khoản 2".
 * `content` is the raw chunk text (no breadcrumb header).
 */
export interface IArticleRef {
  documentId: string;
  documentName: string;
  lawName?: string | null;
  lawNumber?: string | null;
  article: string;
  clause?: string | null;
  point?: string | null;
  breadcrumb: string;
  content: string;
}

export interface ISearchToolResult {
  hits: IScoredChunk[];
  totalCandidates: number;
  filtersApplied: IRetrieverFilters;
}

export interface IGetArticleResult {
  found: boolean;
  article?: IArticleRef;
  related?: IArticleRef[];
}

export interface IGetDocumentResult {
  found: boolean;
  documentId?: string;
  lawName?: string | null;
  lawNumber?: string | null;
  documentType?: string;
  effectiveDate?: string | null;
  legalStatus?: string;
  articles: IArticleRef[];
}

export interface IExpandReferencesResult {
  text: string;
  direction: 'forward' | 'backward' | 'both';
  resolved: IExtractedReference[];
  /** Backward refs (who references this). Requires KG — empty until Phase 4. */
  backward?: Array<{ lawName: string; lawNumber?: string; article: string; relation: string }>;
}

export interface ICompareArticlesResult {
  a: IArticleRef | null;
  b: IArticleRef | null;
  diff?: string;
}

export interface IEffectiveDateCheckResult {
  lawName?: string;
  lawNumber?: string;
  article: string;
  effectiveDate?: string | null;
  expiryDate?: string | null;
  legalStatus: string;
  currentlyEffective: boolean;
}
