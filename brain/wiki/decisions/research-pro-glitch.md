# Research: Professor Glitch (@pro.glitch), methods and content playbook
_Last updated: 2026-10-08_

**What it is:** a TikTok creator who teaches non-coders to build "AI employees" (Claude Code, n8n) and sells a $57/mo community (askglitch.com). At scrape time: 95.7K followers, 410.7K likes and 872 videos. 106 videos were scraped with `/scrapling`, totalling 1.38M plays (median 4K).

## Methods we adopted (and where they live now)

| Their method | In this repo |
|---|---|
| AI employee = trigger + instructions + tools + brake | `/hire-employee`, `.claude/agents/*` |
| A desk per employee, a company folder (owner, voice, roster), a shared notebook | `brain/wiki/company/*`, `people/ai-team.md`, `memory/journal.md` |
| Hooks are rules, prompts are suggestions | `.claude/hooks/*` |
| Process mapping: interview the doer, atomic steps, touch vs lead time, exceptions, blue/purple/orange colors, score = frequency × minutes × cost of mistake, track the share of cases nobody touched | `/process-map` |
| 4-write loop: inline writes, sweep, nightly sleep pass, corrections saved with why and how; how-to fixes go in the SKILL, not in memory | `/wrap-up`, `/wrap-up sleep` |
| Save your best result once and reuse it forever | `/save-as-skill` |
| Customer-email employee: read and draft only (no send), answers from files, 20 real replies for voice, routing (angry, refund, legal, unsure → owner), test on last month's emails, widen trust per category | `support-drafter` agent, `company/policies.md`, `company/support-examples.md` |
| Brand handbook: CLAUDE.md plus a brand folder of logo, colors, photos and 5 best emails | `company/voice.md` (extend with a brand assets folder when it exists) |

## Not adopted yet (candidates)

- **One board** (to do / doing / done) that employees update themselves, with work submitted for review.
- **A clock on every desk**: scheduled routines, e.g. support drafts at 9am and the weekly sleep pass.
- **A hiring employee** that creates new employees (partly covered by `/hire-employee`).
- **Event triggers**: a form fill or new order wakes Claude Code via n8n and a webhook.

## Content lessons (if the store markets on TikTok)

- **Saves ÷ plays** is the "useful" signal. Their best is ~6–7% on roadmaps and "exactly what I'd do, in order" posts. The single biggest hit (353K plays, 25K saves) was a dated, month-by-month plan: "You have exactly four months…".
- **The caption is the whole script** (~1,000 characters on average, numbered steps). Long-caption videos averaged 14.3K plays vs 11.1K for short ones.
- **Formats that repeat:** "X vs Y vs Z" explainers (API vs CLI vs MCP: 45–67K), "the first 5 …", and "how to build ___, every step".
- **One idea, many angles.** The same concept (AI employee, second brain) was re-cut dozens of times with different hooks.

Source: raw/2026-10-08-tiktok-pro-glitch-106-videos.json; askglitch.com (homepage, blog posts on hooks and the company brain)

## Related
- [Agent kit setup](2026-10-08-agent-kit.md) · [AI team roster](../people/ai-team.md)
