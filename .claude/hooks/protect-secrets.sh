#!/bin/bash
# PreToolUse guard: the agent never reads or writes secret files.
# Exit 2 blocks the tool call; stderr is shown to Claude as the reason.
input=$(cat)
path=$(echo "$input" | jq -r '.tool_input.file_path // .tool_input.path // .tool_input.notebook_path // empty')
[ -z "$path" ] && exit 0

name=$(basename "$path")
case "$name" in
  .env.example|.env.sample|.env.template) exit 0 ;;
esac

case "$path" in
  *.env|*.env.*|*/secrets/*|*secrets.*|*credentials*|*.pem|*.key|*id_rsa*|*id_ed25519*)
    echo "Blocked by protect-secrets hook: agents don't touch secret files ($path). Ask the human to handle it." >&2
    exit 2
    ;;
esac
exit 0
