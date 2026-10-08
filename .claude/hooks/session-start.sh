#!/bin/bash
# SessionStart: load the company brain's index and recent memory into context,
# so no session starts from zero. Stdout becomes context for Claude.
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

if [ -f brain/wiki/index.md ]; then
  echo "## Company brain index (brain/wiki/index.md)"
  head -60 brain/wiki/index.md
  echo
fi

if [ -f brain/memory/journal.md ]; then
  echo "## Recent memory (last entries of brain/memory/journal.md)"
  tail -25 brain/memory/journal.md
  echo
fi

pending=$(find brain/raw -type f ! -name 'README.md' ! -name '.gitkeep' -newer brain/wiki/log.md 2>/dev/null | head -10)
if [ -n "$pending" ]; then
  echo "## Raw sources not yet ingested (run /brain ingest):"
  echo "$pending"
fi
exit 0
