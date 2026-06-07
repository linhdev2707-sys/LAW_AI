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

# Build backend
RUN pnpm --filter @law-ai/backend build

# ---- Production stage ----
FROM node:20-alpine AS runner
RUN corepack enable
WORKDIR /app

ENV NODE_ENV=production

# Copy built output + node_modules from builder
COPY --from=builder /app/apps/backend/dist ./dist
COPY --from=builder /app/apps/backend/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/backend/src ./src

EXPOSE 4000

CMD ["node", "dist/main"]
