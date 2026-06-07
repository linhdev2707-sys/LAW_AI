# ---- Build stage ----
FROM node:20-alpine AS builder
RUN corepack enable
WORKDIR /app

# Copy workspace configs
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* .npmrc ./
COPY apps/frontend ./apps/frontend
COPY packages ./packages

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @law-ai/frontend build

# ---- Production stage ----
FROM node:20-alpine AS runner
RUN corepack enable && apk add --no-cache libc6-compat
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Standalone Next.js output
COPY --from=builder /app/apps/frontend/.next/standalone ./
COPY --from=builder /app/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=builder /app/apps/frontend/public ./apps/frontend/public

EXPOSE 3000
CMD ["node", "apps/frontend/server.js"]
