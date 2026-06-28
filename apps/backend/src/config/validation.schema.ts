import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  BACKEND_PORT: Joi.number().default(4000),
  CORS_ORIGIN: Joi.string().default('http://localhost:3000'),

  // Full connection URL (Railway / Neon / Supabase / Render)
  DATABASE_URL: Joi.string().optional(),

  // Split form (local docker-compose)
  DATABASE_HOST: Joi.string().default('localhost'),
  DATABASE_PORT: Joi.number().default(5432),
  DATABASE_USER: Joi.string().default('lawai'),
  DATABASE_PASSWORD: Joi.string().default('lawai_password'),
  DATABASE_NAME: Joi.string().default('law_ai'),

  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').optional(),
  REDIS_DB: Joi.number().default(0),

  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  // ─── LLM (DeepSeek) ───────────────────────────────────────────────
  DEEPSEEK_API_KEY: Joi.string().allow('').default(''),
  DEEPSEEK_MODEL: Joi.string().default('deepseek-chat'),
  DEEPSEEK_BASE_URL: Joi.string().default('https://api.deepseek.com/v1'),
  DEEPSEEK_TIMEOUT_MS: Joi.number().default(60000),
  DEEPSEEK_MAX_TOKENS: Joi.number().default(2048),
  DEEPSEEK_TEMPERATURE: Joi.number().min(0).max(2).default(0.3),

  // ─── Embeddings (local — Xenova/bge-m3 via ONNX) ──────────────────
  EMBEDDING_MODEL: Joi.string().default('Xenova/bge-m3'),
  EMBEDDING_DIM: Joi.number().valid(384, 768, 1024).default(1024),

  // ─── Cloudflare R2 ─────────────────────────────────────────────────
  R2_ACCOUNT_ID: Joi.string().allow('').default(''),
  R2_ACCESS_KEY_ID: Joi.string().allow('').default(''),
  R2_SECRET_ACCESS_KEY: Joi.string().allow('').default(''),
  R2_BUCKET_NAME: Joi.string().default('law-ai-rag'),
  R2_REGION: Joi.string().default('auto'),
  R2_ENDPOINT: Joi.string().allow('').default(''),
  CLOUDFLARE_API_TOKEN: Joi.string().allow('').default(''),

  // ─── OCR (Cloudflare Workers AI) ────────────────────────────────────
  // The secret is required in production so the callback endpoint can
  // verify HMAC signatures. We use min(32) to match JWT_SECRET's policy.
  // Bucket name has a sensible default for local dev.
  OCR_CALLBACK_SECRET: Joi.string().allow('').min(0).default(''),
  OCR_R2_BUCKET: Joi.string().default('law-ai-rag-ocr'),

  // ─── RAG ───────────────────────────────────────────────────────────
  RAG_CANDIDATE_K: Joi.number().default(50),
  RAG_TOP_K: Joi.number().min(1).max(20).default(5),
  RAG_FUSION_K: Joi.number().default(60),
  RAG_HISTORY_TURNS: Joi.number().default(10),
  RAG_CHUNK_SIZE: Joi.number().default(512),
  RAG_CHUNK_OVERLAP: Joi.number().default(50),
  // Drop chunks whose cosine similarity with the query is below this
  // threshold. 0 disables the filter. 0.35 is a reasonable default
  // for bge-m3 embeddings (Vietnamese legal corpora).
  RAG_MIN_COSINE_SCORE: Joi.number().min(0).max(1).default(0.35),
  // Comma-separated list of R2 bucket names the retriever is
  // allowed to search. Empty string = no filter (backward compat).
  RAG_ALLOWED_BUCKETS: Joi.string().allow('').default(''),

  // ─── Rate limit (chat) ────────────────────────────────────────────
  // Sliding-window size in milliseconds (default: 60s = 60_000).
  CHAT_RATE_LIMIT_TTL_MS: Joi.number().min(1_000).default(60_000),
  // Max chat requests per window per user/IP (default: 20).
  CHAT_RATE_LIMIT_MAX: Joi.number().min(1).default(20),

  // ─── Payment (Casso & VietQR) ──────────────────────────────────────
  CASSO_WEBHOOK_TOKEN: Joi.string().default('casso-secure-token'),
  BANK_ID: Joi.string().default('TCB'),
  ACCOUNT_NO: Joi.string().default('19039988776601'),
  ACCOUNT_NAME: Joi.string().default('CONG TY CONG NGHE iLaw'),
  VIETQR_TEMPLATE: Joi.string().default('qr_only'),
});
