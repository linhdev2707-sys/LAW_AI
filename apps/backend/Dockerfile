# ---- Build stage ----
FROM node:20-alpine AS builder
RUN corepack enable
WORKDIR /app

# Copy workspace root
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* .npmrc ./
COPY tsconfig.base.json* ./

# Copy backend app
COPY apps/backend ./apps/backend

# Copy shared packages
COPY packages ./packages

# Install deps (root + workspaces)
RUN pnpm install --frozen-lockfile

# Build shared first so @law-ai/shared's dist (types + js) exists for the
# backend's `tsc` to resolve.
RUN pnpm --filter @law-ai/shared build

# Build backend
RUN pnpm --filter @law-ai/backend build

# Use `pnpm deploy` to produce a flat, self-contained node_modules
# (with @law-ai/shared bundled in) that the runtime image can use
# without the pnpm loader.
RUN pnpm --filter @law-ai/backend --prod deploy /deploy

# ---- Production stage ----
FROM node:20-alpine AS runner
RUN corepack enable
WORKDIR /app

ENV NODE_ENV=production

# Copy built dist + the flat node_modules produced by `pnpm deploy`
COPY --from=builder /app/apps/backend/dist ./dist
COPY --from=builder /deploy/node_modules ./node_modules
COPY --from=builder /deploy/package.json ./

EXPOSE 4000

# Run pending migrations first, then boot NestJS. If migrations fail the
# container will exit non-zero and Railway will surface the error.
CMD ["sh", "-c", "node dist/database/migrations/run-migrations.js && node dist/main"]
