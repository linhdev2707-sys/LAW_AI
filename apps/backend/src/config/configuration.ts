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

  // ─── RAG index / retrieval tuning ──────────────────────────────────
  rag: {
    candidateK: intEnv('RAG_CANDIDATE_K', 50),
    topK: intEnv('RAG_TOP_K', 5),
    fusionK: intEnv('RAG_FUSION_K', 60),
    historyTurns: intEnv('RAG_HISTORY_TURNS', 10),
    chunkSize: intEnv('RAG_CHUNK_SIZE', 512),
    chunkOverlap: intEnv('RAG_CHUNK_OVERLAP', 50),
    // Drop chunks whose cosine similarity with the query is below this
    // threshold. BGE-M3 multilingual vectors typically sit in [-0.2, 0.9];
    // 0.35 is a reasonable floor for "loosely related" content. Set to 0
    // to disable.
    minCosineScore: floatEnv('RAG_MIN_COSINE_SCORE', 0.35),
    // Optional whitelist of bucket names the retriever is allowed to
    // search. Empty array = no filter (backward compatible). Used to
    // prevent chat from pulling chunks from corpora that were ingested
    // for a different purpose (e.g. an admin's "playground" bucket).
    allowedBuckets: (process.env.RAG_ALLOWED_BUCKETS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  },
}));
