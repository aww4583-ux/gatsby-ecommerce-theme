#!/usr/bin/env bash
# Browser end-to-end tests against a local Supabase + running app.
# Each suite starts from an empty database, so this RESETS the local DB.
#   npx supabase start && npm run build && npm run start   (in another terminal)
#   SUPABASE_SERVICE_ROLE_KEY=... e2e/run-all.sh
set -euo pipefail
cd "$(dirname "$0")/.."
for t in pos management reports; do
  npx supabase db reset >/dev/null
  echo "# e2e/$t.mjs"
  node "e2e/$t.mjs"
done
