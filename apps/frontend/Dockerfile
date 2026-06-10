# ---- Build stage ----
FROM node:22-alpine AS builder
RUN corepack enable
WORKDIR /app

# IMPORTANT: NEXT_PUBLIC_* variables must be declared as ARG before use,
# otherwise Next.js will see `undefined` at build time and the bundled
# code will fall back to the localhost default in src/lib/env.ts.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_URL
ARG NEXTAUTH_SECRET
ARG NEXTAUTH_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXTAUTH_SECRET=$NEXTAUTH_SECRET
ENV NEXTAUTH_URL=$NEXTAUTH_URL

# Copy workspace configs
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* .npmrc ./
COPY apps/frontend ./apps/frontend
COPY packages ./packages

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @law-ai/shared build

# Sanity log: confirm NEXT_PUBLIC_API_URL is set in build context. If this
# prints "undefined" the env var was not injected by Railway and the
# built bundle will fall back to http://localhost:4000.
RUN echo ">>> NEXT_PUBLIC_API_URL=[$NEXT_PUBLIC_API_URL] NEXT_PUBLIC_APP_URL=[$NEXT_PUBLIC_APP_URL]"
RUN pnpm --filter @law-ai/frontend build

# ---- Production stage ----
FROM node:22-alpine AS runner
RUN corepack enable && apk add --no-cache libc6-compat
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Standalone Next.js output (the server.js + minimal node_modules Next.js
# traced as required for the app routes).
COPY --from=builder /app/apps/frontend/.next/standalone ./
COPY --from=builder /app/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=builder /app/apps/frontend/public ./apps/frontend/public

# sharp is required by Next.js image optimization in standalone mode
# (see https://nextjs.org/docs/messages/sharp-missing-in-production).
# It's NOT auto-traced by Next.js into .next/standalone/node_modules, so we
# install it explicitly in the runner image.
RUN npm install --no-save --prefix /app sharp

EXPOSE 3000
CMD ["node", "apps/frontend/server.js"]
