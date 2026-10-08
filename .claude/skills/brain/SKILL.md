---
name: brain
description: Run the company brain, an AI-maintained markdown wiki in brain/ (Karpathy "LLM Wiki" pattern). Use when the user says "ingest", "add this to the brain", "remember this for the business", "what do we know about X", "how do we do X", asks about store processes, voice, decisions or products, or says "lint the brain". Subcommands are ingest, query, file and lint.
argument-hint: "ingest | query <question> | file <fact> | lint"
---

# Company brain

`brain/` is the store's long-term memory. Its rules are in `brain/CLAUDE.md`; read that file first, every time. In short:

- `brain/raw/` holds immutable sources. You read them and **never edit them**.
- `brain/wiki/` is yours to write. People read it, and so does every future session.
- `brain/wiki/index.md` is the catalog. Read it before any query, and update it after any write.
- `brain/wiki/log.md` is append-only. Add one line per ingest or file operation.
- When two sources disagree, **flag the contradiction**. Don't overwrite one with the other.

Pick the subcommand from `$ARGUMENTS`. If there is none, infer it from the request.

## ingest

1. List files in `brain/raw/` that are newer than the last entry in `log.md` or are not mentioned in it.
2. Read each source in full. Pull out the processes (how we do X), decisions (we chose X over Y, and why), people (who owns what), products (facts, positioning, objections) and voice (how we sound).
3. For each item, update the existing page in the right `wiki/` folder, or create one. Use the page template in `brain/CLAUDE.md`. Link related pages with relative markdown links.
4. Every claim gets a `Source:` line that points to the raw file.
5. Update `index.md` with one line per new page: `- [Title](path) — what it answers`.
6. Append to `log.md`: `YYYY-MM-DD ingest <raw file> → <pages touched>`.
7. Report the pages you created or changed and any contradictions you found.

## query

1. Read `index.md`, then only the 1–3 pages that matter. Don't grep the whole tree unless the index has nothing.
2. Answer with links to the pages you used.
3. If the answer isn't in the brain, say so plainly. Offer to `file` it once the user gives you the answer.

## file

Use this for a single durable fact the user tells you, such as "we never discount below 20%". Put it on the right page, or make a new one, and give it the source `Told by owner, <date>`. Then update the index and the log.

## lint

Check the brain's health. Report what you find, and fix only the mechanical issues:
- Pages that are missing from `index.md`, and index entries that point to missing pages (fix both).
- Broken relative links (fix).
- Pages with no `Source:` line (list them).
- Contradictions between pages (list them, and ask the user which one is right).
- Pages whose content hasn't changed in 90+ days and that describe something likely to change, such as prices or stock (list them).
