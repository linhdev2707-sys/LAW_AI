/**
 * Chat mode picker. The user picks one of three modes per message:
 *
 * - `fast`   — single retrieval pass + LLM streaming answer. Default mode.
 *              Today this is exactly what every chat message does.
 * - `deep`   — agentic RAG. DeepSeek function-calling loop with up to 5
 *              iterations and 2 tools (`rag_search`, `lookup_article`).
 *              More accurate but ~5× the LLM cost.
 * - `lookup` — citation-only. Returns the raw retrieved chunks without
 *              invoking the LLM at all. Fastest, cheapest, most precise
 *              for legal document lookup.
 *
 * Single source of truth shared between FE (dropdown options) and BE
 * (DTO validation + service dispatcher). `CHAT_MODES` is a const tuple
 * so it can be reused by `class-validator`'s `@IsIn` and iterated over
 * by the FE without manual enum gymnastics.
 */
export const CHAT_MODES = ['fast', 'deep', 'lookup'] as const;
export type ChatMode = typeof CHAT_MODES[number];

/**
 * Display metadata for each mode. Used by the ModePicker dropdown to
 * render the label + short description. Kept in the shared package so
 * BE (e.g. log lines, admin tools) and FE render the same strings.
 */
export const CHAT_MODE_LABELS: Record<
  ChatMode,
  { label: string; }
> = {
  fast: {
    label: 'Nhanh'
  },
  deep: {
    label: 'Suy nghĩ sâu'
  },
  lookup: {
    label: 'Tra cứu văn bản'
  },
};

/**
 * Type guard for runtime validation of values that came from
 * `localStorage` or an untrusted client. Invalid values fall back to
 * the default `fast` mode.
 */
export function isChatMode(value: unknown): value is ChatMode {
  return typeof value === 'string' && (CHAT_MODES as readonly string[]).includes(value);
}