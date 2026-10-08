---
name: process-map
description: Audit a business process step by step to find where AI and automation actually belong, where a human must stay in the loop, and what to build first. Use when the user asks "where can AI help with X", "should I automate X", "map this workflow", wants an AI opportunity audit of their store or business, or before building an AI employee for a fuzzy job.
argument-hint: "<process name, e.g. 'new product launch' or 'customer returns'>"
---

# Process map: decide where AI fits before you build anything

A real AI project starts with a stopwatch and a wall of sticky notes, not a tool. Most failed AI projects automated the wrong step, or automated a broken one.

## 1. Interview the person who does the work, not the owner

The owner says taking an order is 5 steps. The person who has done it for years walks you through 41, including the sticky note on their monitor. Ask the user who actually does this, then get the real version, workarounds included. If `brain/wiki/processes/<name>.md` exists, start from it.

## 2. Break it into atomic steps

Each step is **one person, one system, one action**. "Enter the order" is 11 steps. AI can't do "enter the order", but it's great at "match their part number to ours", and it can say how sure it is.

| # | Atomic step | Who | System | Touch time | Frequency/week | Color |
|---|-------------|-----|--------|-----------|----------------|-------|

## 3. Measure two clocks

- **Touch time** is the minutes of actual work. These cost wages.
- **Lead time** is the time from request to done, waiting included. This costs customers.

## 4. Hunt the exceptions

List what goes wrong: missing info, price mismatches, out of stock, duplicates, angry customers, refunds. If possible, log them for two weeks. **That's where the time goes.**

## 5. Color every step

| Color | Meaning | Build with |
|---|---|---|
| 🔵 **Blue** | A rule: same input, same output | Plain automation (script, n8n/Zapier, Netlify function, cron). No AI. |
| 🟣 **Purple** | Judgment on messy input | An AI employee does it. A person approves **when it's unsure** (it must report its confidence). |
| 🟠 **Orange** | Money or a relationship | Stays human. Give the human a better brief. |

**Fix broken steps before you automate them.** Automating a bad process just makes it fail faster.

## 6. Score and sequence

Score each non-orange step as **frequency × minutes × cost of a mistake**. That ordering is the roadmap. Recommend **one** first build, a 7-day win, where each phase pays for the next.

Pick the one number to track from day one: **the share of cases nobody had to touch**.

## 7. Output

Write `brain/wiki/processes/<name>.md` with the step table, the exceptions list, the colors, the scores, the first build and the tracking number. Update `index.md` and `log.md`. Then offer to build the first item with `/hire-employee`.

## Good first candidates in this store

Product listing creation (`src/helpers/product.json`), blog publishing (`src/helpers/blog.json`), customer email replies (see the `support-drafter` employee), returns, and launch QA.
