# ---- Build stage ----
FROM node:22-slim AS builder
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
# Include dev dependencies so the migration runner has access to `dotenv`
# (needed for best-effort .env loading — production env vars are injected
# by Railway, but the import is still resolved at runtime).
RUN pnpm --filter @law-ai/backend deploy /deploy --prod=false

# ---- Production stage ----
FROM node:22-slim AS runner
RUN corepack enable
WORKDIR /app

ENV NODE_ENV=production

# Copy built dist + the flat node_modules produced by `pnpm deploy`
COPY --from=builder /app/apps/backend/dist ./dist
COPY --from=builder /deploy/node_modules ./node_modules
COPY --from=builder /deploy/package.json ./

EXPOSE 4000

# Run pending migrations first, then boot NestJS.
# Use shell form (not JSON array) so Docker wraps it in `sh -c` for us.
# This is the most portable form across container runtimes (incl. BuildKit
# on Railway) and avoids the JSON-array CMD parsing issues we hit earlier.
CMD node dist/database/migrations/run-migrations.js && node dist/main
