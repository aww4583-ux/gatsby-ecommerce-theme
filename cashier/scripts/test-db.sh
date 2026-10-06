#!/usr/bin/env bash
# Runs the database test suite against a throwaway local Postgres database.
# Usage: scripts/test-db.sh [psql connection args]   e.g. -h localhost -p 5432 -U postgres
# The database named in $TEST_DB (default pos_test) is DROPPED and recreated.
set -euo pipefail

cd "$(dirname "$0")/../supabase"
DB=${TEST_DB:-pos_test}
PSQL=(psql -X -q -v ON_ERROR_STOP=1 "$@")

"${PSQL[@]}" -d postgres -c "drop database if exists $DB" -c "create database $DB" >/dev/null

"${PSQL[@]}" -d "$DB" -f tests/supabase_shim.sql >/dev/null
for m in migrations/*.sql; do
  "${PSQL[@]}" -d "$DB" -f "$m" >/dev/null
done
"${PSQL[@]}" -d "$DB" -f tests/helpers.sql >/dev/null
"${PSQL[@]}" -d "$DB" -f tests/fixtures.sql >/dev/null

for t in tests/0*.sql; do
  echo "# $t"
  status=0
  out=$("${PSQL[@]}" -d "$DB" -f "$t" 2>&1) || status=$?
  sed -n 's/^.*NOTICE:  //p; /ERROR/p' <<<"$out"
  if [ "$status" -ne 0 ] || grep -q 'ERROR' <<<"$out"; then
    echo "TESTS FAILED in $t"
    exit 1
  fi
done

echo "# tests/03_concurrency.sh"
bash tests/03_concurrency.sh "$@" -d "$DB"

echo "ALL TESTS PASSED"
