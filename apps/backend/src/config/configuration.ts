import { registerAs } from '@nestjs/config';

const intEnv = (name: string, fallback: number): number => {
  const v = process.env[name];
  if (!v) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
};

const floatEnv = (name: string, fallback: number): number => {
  const v = process.env[name];
  if (!v) return fallback;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
};

export default registerAs('app', () => ({
  env: process.env.NODE_ENV || 'development',
  port: intEnv('BACKEND_PORT', 4000),
  corsOrigin: process.env.BACKEND_CORS_ORIGIN || process.env.CORS_ORIGIN || 'http://localhost:3000',

  database: {
    host: process.env.DATABASE_HOST || 'localhost',
    port: intEnv('DATABASE_PORT', 5432),
    username: process.env.DATABASE_USER || 'lawai',
    password: process.env.DATABASE_PASSWORD || 'lawai_password',
    name: process.env.DATABASE_NAME || 'law_ai',
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: intEnv('REDIS_PORT', 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    db: intEnv('REDIS_DB', 0),
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'change-me-in-prod',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'change-me-in-prod-refresh',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  // ─── LLM (DeepSeek, OpenAI-compatible) ──────────────────────────────
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
    timeoutMs: intEnv('DEEPSEEK_TIMEOUT_MS', 60000),
    maxTokens: intEnv('DEEPSEEK_MAX_TOKENS', 2048),
    temperature: floatEnv('DEEPSEEK_TEMPERATURE', 0.3),
  },

  // ─── Embeddings (OpenAI — DeepSeek has no embedding endpoint) ────────
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
    embeddingDim: intEnv('OPENAI_EMBEDDING_DIM', 1536),
  },

  // ─── Embedding backend (Phase 1) ────────────────────────────────────
  // LegalEmbeddingService picks this up. Default = local Xenova bge-m3.
  // Set backend=cloudflare to use Workers AI (no model download).
  embedding: {
    backend: process.env.EMBEDDING_BACKEND || 'local',     // 'local' | 'cloudflare'
    model: process.env.EMBEDDING_MODEL || 'Xenova/bge-m3',
    dim: intEnv('EMBEDDING_DIM', 1024),
    /** BGE-* (non-M3) recommends "Represent this sentence for searching
     *  relevant passages:" prefix on queries / "passage:" prefix on
     *  documents. bge-m3 doesn't need it; default off. */
    useBgePrefix: process.env.EMBEDDING_USE_PREFIX === 'true',
  },

  // ─── Reranker (Phase 2) ─────────────────────────────────────────────
  // Cross-encoder reranker. Bumps Recall@5 by 15-25 points on legal
  // benchmarks. Disabled by default to avoid the ~600 MB model download
  // on first boot; flip RERANKER_ENABLED=true to turn on.
  reranker: {
    enabled: process.env.RERANKER_ENABLED === 'true',
    backend: process.env.RERANKER_BACKEND || 'local',     // 'local' | 'cohere'
    model: process.env.RERANKER_MODEL || 'Xenova/bge-reranker-v2-m3',
    maxLength: intEnv('RERANKER_MAX_LENGTH', 512),
  },

  // ─── Cohere (rerank API) ────────────────────────────────────────────
  cohere: {
    apiKey: process.env.COHERE_API_KEY || '',
  },

  // ─── Knowledge Graph (Phase 4) ──────────────────────────────────────
  // Optional. When all three are set, KgService connects to Neo4j and
  // enables cross-document reference queries. When unset, KgService
  // runs in stub mode (all methods return empty results).
  neo4j: {
    uri: process.env.NEO4J_URI || '',
    user: process.env.NEO4J_USER || 'neo4j',
    password: process.env.NEO4J_PASSWORD || '',
  },

  // ─── Cloudflare R2 (S3-compatible) ──────────────────────────────────
  r2: {
    accountId: process.env.R2_ACCOUNT_ID || '',
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    bucket: process.env.R2_BUCKET_NAME || 'law-ai-rag',
    region: process.env.R2_REGION || 'auto',
    endpoint:
      process.env.R2_ENDPOINT ||
      (process.env.R2_ACCOUNT_ID
        ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
        : ''),
  },
  cloudflare: {
    accountId: process.env.R2_ACCOUNT_ID || '',
    apiToken: process.env.CLOUDFLARE_API_TOKEN || '',
  },

  // ─── OCR (Cloudflare Workers AI) ────────────────────────────────────
  // When a scanned PDF (no text layer) is uploaded we stash the raw bytes
  // in R2 and let the Cloudflare Worker run OCR, then POST the extracted
  // text back to /admin/rag/documents/:id/ocr-complete. The HMAC secret
  // is shared between the Worker and the backend so the endpoint can
  // verify the callback hasn't been spoofed.
  ocr: {
    callbackSecret: process.env.OCR_CALLBACK_SECRET || '',
    bucket: process.env.OCR_R2_BUCKET || 'law-ai-rag-ocr',
  },

  // ─── RAG index / retrieval tuning ──────────────────────────────────
  rag: {
    candidateK: intEnv('RAG_CANDIDATE_K', 50),
    topK: intEnv('RAG_TOP_K', 5),
    fusionK: intEnv('RAG_FUSION_K', 60),
    historyTurns: intEnv('RAG_HISTORY_TURNS', 10),
    chunkSize: intEnv('RAG_CHUNK_SIZE', 480),
    chunkOverlap: intEnv('RAG_CHUNK_OVERLAP', 50),
    /** Hard cap before the hierarchical chunker is forced to split a
     *  Khoản at the Điểm boundary. Default 720 tokens. */
    hardChunkSize: intEnv('RAG_HARD_CHUNK_SIZE', 720),
    /** Use DeepSeek to enrich legal metadata for docs the regex pass
     *  can't fully classify. Adds ~1-2s per document. */
    enricherUseLlm: process.env.RAG_ENRICHER_USE_LLM !== 'false',
    // Drop chunks whose cosine similarity with the query is below this
    // threshold. BGE-M3 multilingual vectors typically sit in [-0.2, 0.9];
    // 0.30 is a reasonable floor for "loosely related" content. Set to 0
    // to disable.
    minCosineScore: floatEnv('RAG_MIN_COSINE_SCORE', 0.30),
    // Optional whitelist of bucket names the retriever is allowed to
    // search. Empty array = no filter (backward compatible). Used to
    // prevent chat from pulling chunks from corpora that were ingested
    // for a different purpose (e.g. an admin's "playground" bucket).
    allowedBuckets: (process.env.RAG_ALLOWED_BUCKETS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  },

  // ─── Rate limit (chat) ────────────────────────────────────────────
  // Sliding-window limit applied to POST /chat/messages and
  // /chat/messages/stream. Tracked per-userId when authenticated,
  // falling back to client IP otherwise. `ttl` is in milliseconds
  // (NestJS @nestjs/throttler convention).
  rateLimit: {
    chat: {
      ttl: intEnv('CHAT_RATE_LIMIT_TTL_MS', 60_000),
      max: intEnv('CHAT_RATE_LIMIT_MAX', 20),
    },
  },
  payment: {
    cassoWebhookToken: process.env.CASSO_WEBHOOK_TOKEN || 'casso-secure-token',
    bankId: process.env.BANK_ID || 'TCB',
    accountNo: process.env.ACCOUNT_NO || '19039988776601',
    accountName: process.env.ACCOUNT_NAME || 'CONG TY CONG NGHE iLaw',
    template: process.env.VIETQR_TEMPLATE || 'qr_only',
  },

  // ─── Chat modes (deep agent tuning) ────────────────────────────────
  // Per-mode flags and limits. Currently only `deep` mode has tunables;
  // `fast` and `lookup` use the existing RAG config above.
  chat: {
    /** Master switch for the deep (agentic) mode. Set false to 503 on
     *  any deep-mode request without removing the FE picker. */
    deepEnabled: process.env.CHAT_DEEP_ENABLED !== 'false',
    /** Cap on tool-call iterations before the loop force-exits. Keeps
     *  DeepSeek token spend bounded per user message. */
    agentMaxIterations: intEnv('CHAT_AGENT_MAX_ITERATIONS', 5),
    /** How many top chunks each tool call returns. */
    agentTopK: intEnv('CHAT_AGENT_TOP_K', 5),
    /** Soft cap on tokens in the assembled system prompt (sources block).
     *  Prevents OOM on the LLM side for huge retrieval sets. */
    maxContextTokens: intEnv('CHAT_MAX_CONTEXT_TOKENS', 6000),
  },
}));
