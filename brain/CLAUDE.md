# Brain schema: how Claude runs this wiki

This folder is the store's company brain. You are its programmer and the owner is its editor.

## Layout
- `raw/`: immutable sources (Slack exports, call transcripts, supplier docs, SOPs, emails). **Read only. Never edit or delete.**
- `wiki/`: AI-maintained pages that people and agents read.
  - `index.md`: the catalog. **Read it first on every query** and update it on every write.
  - `log.md`: append-only history, one line per operation.
  - `company/`: voice, the owner's preferences, policies (shipping, returns, pricing rules).
  - `processes/`: how we do X, step by step.
  - `decisions/`: why we chose X over Y, so nobody re-litigates it.
  - `people/`: who owns what, including `ai-team.md` (the roster of AI employees).
  - `products/`: facts, positioning and objections per product or collection.
- `memory/journal.md`: dated session learnings, written by `/wrap-up`.

## Rules
1. Never edit `raw/`.
2. Every wiki claim has a `Source:` line (a raw file path, or "Told by owner, YYYY-MM-DD").
3. If two sources disagree, add a `> ⚠️ Contradiction:` block that cites both, and ask the owner. Never silently overwrite.
4. Keep pages short and specific. Split a page once it covers two topics.
5. Use relative markdown links between pages, and link generously.
6. After every write, update `index.md` and append to `log.md`.
7. Never store secrets (API keys, passwords, customer personal data) in the brain.

## Page template
```markdown
# <Title>
_Last updated: YYYY-MM-DD_

<The answer, in plain language, short.>

## Details
...

## Related
- [Other page](../folder/page.md)

Source: raw/<file> | Told by owner, YYYY-MM-DD
```
