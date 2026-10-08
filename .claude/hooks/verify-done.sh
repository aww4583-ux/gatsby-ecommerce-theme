#!/bin/bash
# Stop hook: refuse a "done" while changed files are broken.
# Checks only files changed in the working tree, so it stays fast.
input=$(cat)

# Already sent back once this turn: let it stop rather than loop forever.
[ "$(echo "$input" | jq -r '.stop_hook_active // false')" = "true" ] && exit 0

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

changed=$( { git diff --name-only HEAD 2>/dev/null; git ls-files --others --exclude-standard; } | sort -u)
[ -z "$changed" ] && exit 0

problems=""

# 1. Every changed JSON file must parse (product.json, blog.json, config.json, settings...).
for f in $(echo "$changed" | grep -E '\.json$'); do
  [ -f "$f" ] || continue
  if ! err=$(jq empty "$f" 2>&1); then
    problems+="Invalid JSON in $f: $err"$'\n'
  fi
done

# 2. Changed JS must match the repo's Prettier config (only if deps are installed).
if [ -x node_modules/.bin/prettier ]; then
  js=$(echo "$changed" | grep -E '^(src/.*|gatsby-[^/]*)\.js$' | while read -r f; do [ -f "$f" ] && echo "$f"; done)
  if [ -n "$js" ]; then
    if ! out=$(echo "$js" | xargs node_modules/.bin/prettier --check 2>&1); then
      problems+="Prettier check failed (run: npx prettier --write <files>):"$'\n'"$(echo "$out" | tail -15)"$'\n'
    fi
  fi
fi

# 3. Shell hooks must at least parse.
for f in $(echo "$changed" | grep -E '\.sh$'); do
  [ -f "$f" ] || continue
  if ! err=$(bash -n "$f" 2>&1); then
    problems+="Shell syntax error in $f: $err"$'\n'
  fi
done

if [ -n "$problems" ]; then
  echo "Not done yet. The verify-done hook found problems in files you changed:" >&2
  echo "$problems" >&2
  exit 2
fi
exit 0
