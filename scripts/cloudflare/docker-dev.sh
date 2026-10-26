#!/bin/sh
set -eu

# Never inherit the production DATABASE_URL from the host .env.
export DATABASE_URL=postgresql://lycoboai:local_dev_only@postgres:5432/lycoboai
export CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE="$DATABASE_URL"
pnpm install --frozen-lockfile --store-dir /root/.local/share/pnpm/store
pnpm db:migrate
node scripts/cloudflare/dev-setup.mjs
exec pnpm --parallel --filter @lycoboai/web --filter @lycoboai/api dev:docker
