#!/bin/sh
# Container entrypoint for the LAW_AI backend.
# Runs pending DB migrations first, then boots NestJS. If migrations fail
# the script exits non-zero and Railway surfaces the error.
set -e

echo "[entrypoint] running pending migrations..."
node dist/database/migrations/run-migrations.js

echo "[entrypoint] starting NestJS..."
exec node dist/main
