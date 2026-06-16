#!/usr/bin/env bash
# Deploy the OCR Worker to Cloudflare.
#
# Run this ONCE on your local machine (or VPS) after:
#   1. wrangler login  (opens browser for auth)
#   2. R2 bucket "law-ai-rag-ocr" created in Cloudflare dashboard
#   3. KV namespace IDs pasted into wrangler.toml
#
# Usage:
#   ./deploy.sh                                                # uses defaults
#   OCR_CALLBACK_SECRET=xxx ./deploy.sh                        # custom secret
#   BACKEND_CALLBACK_URL=https://staging.example.com/...  ./deploy.sh
#
# After this script finishes, the Worker is live with:
#   - R2 binding to law-ai-rag-ocr
#   - AI binding (Workers AI enabled on the account)
#   - KV binding to OCR_STATE
#   - Cron trigger "*/1 * * * *"
#   - Secrets: OCR_CALLBACK_SECRET, BACKEND_CALLBACK_URL
set -euo pipefail

cd "$(dirname "$0")/.."

: "${OCR_CALLBACK_SECRET:?Set OCR_CALLBACK_SECRET in env (generate with: openssl rand -hex 32)}"
: "${BACKEND_CALLBACK_URL:=https://ilaw.io.vn/api/v1/admin/rag/documents/ocr-complete}"

echo "==> Setting Worker secret: OCR_CALLBACK_SECRET"
printf '%s' "$OCR_CALLBACK_SECRET" | pnpm exec wrangler secret put OCR_CALLBACK_SECRET

echo "==> Setting Worker secret: BACKEND_CALLBACK_URL"
printf '%s' "$BACKEND_CALLBACK_URL" | pnpm exec wrangler secret put BACKEND_CALLBACK_URL

echo "==> Deploying Worker"
pnpm exec wrangler deploy

echo ""
echo "✅ Worker deployed. Verify in dashboard:"
echo "   https://dash.cloudflare.com → Workers & Pages → law-ai-ocr-worker"
echo ""
echo "Cron trigger: Settings → Triggers  (should show '*/1 * * * *')"
echo "Logs:         Logs → Live tail       (appears ~1 min after deploy)"
echo ""
echo "Local dev:"
echo "   pnpm exec wrangler dev"
