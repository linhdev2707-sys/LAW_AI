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

# Install ALL deps (incl. devDependencies) so the build step has access
# to nest CLI, typescript, etc.
RUN pnpm install --frozen-lockfile

# Build shared first so @law-ai/shared's dist (types + js) exists for the
# backend's `tsc` to resolve.
RUN pnpm --filter @law-ai/shared build

# Build backend
RUN pnpm --filter @law-ai/backend build

# ---- Production stage ----
FROM node:22-slim AS runner
RUN corepack enable && apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app

ENV NODE_ENV=production

# Copy the whole workspace (with node_modules + dist) into the runner.
# pnpm's symlink layout is preserved — when we copy the source tree
# that `pnpm install` produced in the builder, all workspace links
# resolve correctly because the relative paths match.
COPY --from=builder /app ./

EXPOSE 4000

# Run pending migrations first, then boot NestJS.
# Use shell form (not JSON array) so Docker wraps it in `sh -c` for us.
# This is the most portable form across container runtimes (incl. BuildKit
# on Railway) and avoids the JSON-array CMD parsing issues we hit earlier.
CMD node dist/database/migrations/run-migrations.js && node dist/main
