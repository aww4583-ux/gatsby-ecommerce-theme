#!/bin/bash
# PreToolUse guard for Bash: deny destructive commands in code, not in the prompt.
input=$(cat)
cmd=$(echo "$input" | jq -r '.tool_input.command // empty')
[ -z "$cmd" ] && exit 0

block() {
  echo "Blocked by guard-bash hook: $1. If this is really needed, ask the human to run it." >&2
  exit 2
}

# rm -rf aimed at root, home, the repo itself, or a parent directory
echo "$cmd" | grep -Eq 'rm[[:space:]]+(-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r|-r[[:space:]]+-f|-f[[:space:]]+-r)[[:space:]]+(/|~|\$HOME|\.|\.\.|\*)([[:space:]]|/?$)' \
  && block "recursive force-delete of a root, home, current or parent directory"

# History rewrites and force pushes (--force-with-lease is allowed)
echo "$cmd" | grep -Eq 'git[[:space:]]+push.*(--force([[:space:]]|$)|[[:space:]]-f([[:space:]]|$))' \
  && block "git force push (use --force-with-lease on your own branch instead)"
echo "$cmd" | grep -Eq 'git[[:space:]]+reset[[:space:]]+--hard' && block "git reset --hard discards work"
echo "$cmd" | grep -Eq 'git[[:space:]]+clean[[:space:]]+-[a-zA-Z]*f' && block "git clean -f deletes untracked files"

# Databases
echo "$cmd" | grep -Eiq '(drop[[:space:]]+(table|database|schema)|truncate[[:space:]]+table)' && block "destructive SQL"

# Reading secrets through the shell instead of the Read tool
echo "$cmd" | grep -Eq '(cat|less|more|head|tail|cp|scp|curl.*-d[[:space:]]*@)[^|;&]*\.env([[:space:]]|$|\.[a-z]+)' \
  && ! echo "$cmd" | grep -Eq '\.env\.(example|sample|template)' \
  && block "reading a .env file through the shell"

exit 0
