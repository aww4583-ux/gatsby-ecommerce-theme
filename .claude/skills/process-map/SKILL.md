---
name: process-map
description: Audit a business process step by step to find where AI and automation actually belong, where a human must stay in the loop, and what to build first. Use when the user asks "where can AI help with X", "should I automate X", "map this workflow", wants an AI opportunity audit of their store or business, or before building an AI employee for a fuzzy job.
argument-hint: "<process name, e.g. 'new product launch' or 'customer returns'>"
---

# Process map: decide where AI fits before you build anything

Systems thinking comes before tools. Most failed AI projects automated the wrong step.

## 1. Capture the process as it really runs

Ask the user, or read the existing `brain/wiki/processes/<name>.md`, and write out each step as:

| # | Step | Who does it now | Input | Output | Time/week | Frequency | Rules or judgment? |
|---|------|-----------------|-------|--------|-----------|-----------|-------------------|

Push for the real version, including the workarounds, the waiting and the "then I email Sam".

## 2. Classify each step

| Class | Meaning | Build with |
|---|---|---|
| **Automate** | Same input, same rule, every time | Plain automation: script, n8n/Zapier, Netlify function, cron. No AI needed. |
| **AI-assist** | Needs language or judgment, and a mistake is cheap and reversible | An AI employee that drafts, classifies or summarizes |
| **AI + gate** | Needs judgment, and a mistake is costly or public (money, customers, publishing) | An AI employee that prepares while a human approves (the brake) |
| **Human** | Relationships, taste, accountability, or too rare to be worth building | Leave it. Maybe give the human a better brief. |

Rule of thumb: don't use AI where an `if` statement works, and don't remove the human where an error costs more than the step saves.

## 3. Score and pick

For every non-Human step: **hours saved per month × confidence it works ÷ build effort (1–5)**. Recommend the single top item as the first build. A 7-day win beats a 3-month platform.

## 4. Output

Write `brain/wiki/processes/<name>.md` with the step table, the classification, the scores and the recommendation. Add it to `index.md` and `log.md`. Then offer the next move, for example: "Want me to build #3 as an AI employee? (/hire-employee)".

## Store-specific starting points (this repo is a Gatsby e-commerce theme)

Good first candidates to map: product listing creation (`src/helpers/product.json`), blog/content publishing (`src/helpers/blog.json`), customer support replies, order and returns handling, SEO metadata, and launch QA.
