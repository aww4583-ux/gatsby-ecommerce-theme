---
name: wrap-up
description: Memory sweep using the 4-write loop. Save durable learnings and the user's corrections from this session (with why and how), route how-to fixes into the right skill, and optionally run the nightly "sleep pass" that merges and cleans memory. Use when the user says "wrap up", "save what we learned", "remember this", "end of day", "clean up memory", or before finishing a long session.
argument-hint: "[sleep]"
---

# Wrap up: the 4-write loop

An AI is only as good as what's written in its files. The test is simple: **does it make the same mistake twice?**

| Write | When | Who |
|---|---|---|
| 1. While working | The moment a decision, preference or rule appears | You, inline. Don't wait. |
| 2. The sweep | End of session, or before a long chat is compacted | This skill |
| 3. The sleep pass | Once a night or week (`/wrap-up sleep`) | This skill, ideally on a schedule |
| 4. Corrections | Whenever the user corrects you like they'd correct a person | Caught by the sweep. These are the most valuable. |

## The sweep (default)

1. Scan the conversation for:
   - **Corrections** ("no, never…", "that's wrong", "next time…"). Save each one with **why it was wrong** and **how to do it right**.
   - Preferences, decisions (with the one-line reason), and approaches that worked or failed
   - Open threads, each with its next concrete step
2. **Route each item to where it will be read:**
   - A fix to *how a task is done* goes into **that task's SKILL.md** (or the agent's `.claude/agents/*.md`), not into memory. Skills are read every time the task runs.
   - A fact about the business goes into the **wiki** (follow the `brain` skill's `file` steps).
   - Everything else goes into `brain/memory/journal.md`.
3. **Update, don't pile on.** If a similar entry exists, edit it instead of appending a near-duplicate.
4. Every entry gets a **date and a source**. Mark anything inferred rather than stated as `(unconfirmed)`. Anything about money or identity waits for the user's approval before you save it.
5. If it won't change future behavior, don't save it. If nothing is durable, write nothing and say so.

Journal format:
```
## YYYY-MM-DD — <topic>
- Correction: <what> — why: <…> — do instead: <…>
- Pref / Decision: … (source: user, YYYY-MM-DD)
- Next: …
```

## The sleep pass (`/wrap-up sleep`)

Go through `brain/memory/journal.md` and the wiki the way a brain consolidates during sleep:
- Merge duplicates, and turn ten messy notes into one clean rule.
- Resolve contradictions: **newest wins**, unless it's unconfirmed. Note what was replaced.
- Promote stable rules out of the journal into the skill or wiki page where they belong, then remove them from the journal.
- Keep the journal under ~150 lines.
- Report what you merged, promoted and removed. Offer to schedule this weekly as a routine.

End by telling the user in 2–3 lines what you saved and where.
