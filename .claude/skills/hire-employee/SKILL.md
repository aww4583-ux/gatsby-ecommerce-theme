---
name: hire-employee
description: Design and create an "AI employee", a Claude Code subagent with one job and four parts (trigger, instructions, tools, brake), optionally put on a schedule. Use when the user wants to "build an AI employee", "make an agent that does X", automate a recurring job, delegate a role (copywriter, reviewer, invoice chaser, SEO checker, support drafter), or "hire" an agent.
argument-hint: "<the job, in one sentence>"
---

# Hire an AI employee

An AI employee is an agent you gave a **job**, not a one-off task. Every one has four parts. Don't write the file until all four are clear.

| Part | Question | Becomes |
|---|---|---|
| **Trigger** | What wakes it up? | On demand (`@name` or the description), a routine/cron, a hook, or another employee handing off |
| **Instructions** | How do you want the job done, step by step, and what does "good" look like? | The agent's system prompt |
| **Tools** | Which apps can it touch, and which can it **not**? | The `tools:` allowlist. It gets the least it needs: it can read invoices but can't issue refunds. |
| **Brake** | What does it prepare but never do without a human "yes"? | An "Approval gate" section, plus a hook if the action must be blocked in code |

## Steps

1. **Interview briefly.** Get the job from `$ARGUMENTS`. Ask only for parts you can't infer, at most 3 questions in one message. Sensible defaults: the trigger is on demand, the tools are read-only, and the brake is "anything that publishes, sends, pays or deletes needs approval".
2. **Map the process first.** If the job is fuzzy, run the `process-map` skill's checklist on it so the instructions describe the real steps.
3. **Check the brain.** Read `brain/wiki/index.md`. Link the pages the employee must use, such as `company/voice.md` for writers or `processes/*` for operators, rather than copying their content.
4. **Write `.claude/agents/<kebab-name>.md`** using the template below. The `description` decides when Claude delegates to it, so make it concrete about *when*.
5. **Wire the trigger.**
   - On demand: nothing more to do.
   - Scheduled: offer a routine (`/schedule` or the remote trigger tool) whose prompt says "Use the <name> agent to …". Don't create it until the user agrees.
   - Hard brake: if an action must be impossible rather than discouraged, add a `PreToolUse` hook check in `.claude/hooks/` and register it in `.claude/settings.json`.
6. **Add it to the roster.** Append a line to `brain/wiki/people/ai-team.md` with the name, job, trigger, tools and brake.
7. **Test it once.** Give it a realistic sample task through the Agent tool and show the user the output. Then adjust the instructions from what went wrong. Don't just add more rules.

## Template

```markdown
---
name: <kebab-name>
description: <Job title>. Use when <concrete trigger situations>. <What it returns>.
tools: <minimal list, e.g. Read, Grep, Glob>   # omit only if it truly needs everything
model: <sonnet | haiku | opus — haiku for cheap, repetitive jobs>
---

You are the store's <job title>. Your one job: <outcome in one sentence>.

## Before you start
Read brain/wiki/index.md, then: <the specific brain pages this role depends on>.

## How to do the job
1. ...
2. ...

## What good looks like
- <checkable quality bar>

## Approval gate (the brake)
You prepare; a human approves. Never <publish / send / pay / delete / push> yourself.
End every run with a "Ready for approval" section that lists exactly what you would do next.

## Hand-off
Return: <format>. If you learned a durable fact about the business, include it under
"For the brain:" so the main session can file it.
```

## Guardrails for good employees

- One job per employee. If the description needs "and", split it into two.
- Ten clear steps beat forty rules. When it misbehaves, fix the step that caused it.
- Employees share knowledge through `brain/`, not through each other's context.
