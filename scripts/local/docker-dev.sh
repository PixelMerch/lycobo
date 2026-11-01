#!/bin/sh
set -eu
pnpm install --frozen-lockfile --store-dir /root/.local/share/pnpm/store
exec node scripts/local/dev.mjs --docker
