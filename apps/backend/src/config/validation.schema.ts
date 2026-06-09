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

  // ─── Embeddings (OpenAI) ───────────────────────────────────────────
  OPENAI_API_KEY: Joi.string().allow('').default(''),
  OPENAI_EMBEDDING_MODEL: Joi.string().default('text-embedding-3-small'),
  OPENAI_EMBEDDING_DIM: Joi.number().valid(1536, 3072).default(1536),

  // ─── Cloudflare R2 ─────────────────────────────────────────────────
  R2_ACCOUNT_ID: Joi.string().allow('').default(''),
  R2_ACCESS_KEY_ID: Joi.string().allow('').default(''),
  R2_SECRET_ACCESS_KEY: Joi.string().allow('').default(''),
  R2_BUCKET_NAME: Joi.string().default('law-ai-rag'),
  R2_REGION: Joi.string().default('auto'),
  R2_ENDPOINT: Joi.string().allow('').default(''),

  // ─── RAG ───────────────────────────────────────────────────────────
  RAG_CANDIDATE_K: Joi.number().default(50),
  RAG_TOP_K: Joi.number().min(1).max(20).default(5),
  RAG_FUSION_K: Joi.number().default(60),
  RAG_HISTORY_TURNS: Joi.number().default(10),
  RAG_CHUNK_SIZE: Joi.number().default(512),
  RAG_CHUNK_OVERLAP: Joi.number().default(50),
});
