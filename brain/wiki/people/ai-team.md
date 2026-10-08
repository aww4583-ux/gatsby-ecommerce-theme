# AI team roster
_Last updated: 2026-10-08_

Each employee is a subagent in `.claude/agents/`. Add new ones with `/hire-employee`.

| Employee | Job | Trigger | Tools | Brake |
|---|---|---|---|---|
| product-copywriter | Product and blog copy in `src/helpers/*.json` | On demand ("write the description for…") | Read, Grep, Glob, Edit | Never commits or deploys; returns "Ready for approval" |
| code-reviewer | Reviews diffs before commit or PR | On demand, after code changes | Read, Grep, Glob, Bash (read-only) | Never edits |
| launch-qa | Go/no-go before deploy or launch | On demand, before deploy | Read, Grep, Glob, Bash | Never deploys or fixes |

## Guardrails every employee shares (hooks in `.claude/settings.json`)
- `protect-secrets`: can't read or write `.env`, keys or credentials.
- `guard-bash`: can't `rm -rf` broad paths, force-push, `reset --hard`, or run destructive SQL.
- `verify-done`: can't finish while changed JSON is invalid, changed JS fails Prettier, or a changed shell script won't parse.

## Related
- [Agent kit setup](../decisions/2026-10-08-agent-kit.md)

Source: Told by owner, 2026-10-08
