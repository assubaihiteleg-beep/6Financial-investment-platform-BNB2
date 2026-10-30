#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

# The repository declares pnpm workspaces but may not yet have a pnpm lockfile
# (older revisions carry npm/Bun lockfiles only). Create the pnpm lock on the
# first setup; use frozen installs once it exists.
if [[ -f pnpm-lock.yaml ]]; then
  pnpm install --frozen-lockfile
else
  pnpm install --no-frozen-lockfile
fi

# Do not run `drizzle-kit push` automatically here: this project currently uses
# its Firestore adapter, while drizzle.config.ts falls back to a mock Postgres
# URL. Database schema changes must be applied deliberately to the configured
# production data store, not during an unattended merge.
