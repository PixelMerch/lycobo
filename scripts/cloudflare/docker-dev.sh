#!/bin/sh
set -eu

pnpm install --frozen-lockfile --store-dir /root/.local/share/pnpm/store
# The launcher fixes the database target to the local Compose service.
exec node scripts/cloudflare/dev.mjs --docker
