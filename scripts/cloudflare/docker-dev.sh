#!/bin/sh
set -eu

pnpm install --frozen-lockfile --store-dir /root/.local/share/pnpm/store
# Remote migrations are never part of development startup.
exec node scripts/cloudflare/dev.mjs --docker
