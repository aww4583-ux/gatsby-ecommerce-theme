---
name: save-as-skill
description: Turn a result the user loved into a reusable skill, so the same job never needs explaining twice. Use when the user says "save this as a skill", "remember how we did this", "I want this every time", "perfect, keep this", or after a repeatable job (a report, product listing, email, presentation, launch checklist) finally comes out right.
argument-hint: "<skill-name> (optional)"
---

# Save as skill

When the output finally comes out right, keep both the result and the way you got there. Instructions written once mean an employee never needs training twice.

1. **Find the job.** Name the repeatable job in this conversation. Make the skill name a kebab-case verb-noun, such as `write-product-listing` or `weekly-sales-report`. Use `$ARGUMENTS` if given.
2. **Pull out the procedure, not the transcript.**
   - The inputs it needs, and where they live (files and brain pages; link them, don't copy them)
   - The steps, in order, with the corrections the user made along the way written in as steps
   - The quality bar: what made the final version right
   - What to do when information is missing: say so, and never invent it
3. **Save the golden example.** Write the approved output to `.claude/skills/<name>/example.md`. One real example teaches tone and structure better than any instruction.
4. **Write `.claude/skills/<name>/SKILL.md`** with:
   - Frontmatter: `name`, plus a `description` that says **when** to use it, in the words the user would actually type.
   - The sections: Inputs → Steps → Quality bar → "Read example.md before starting".
5. **Set the routing rule.** If a later correction is about *how* the job is done, it goes into this SKILL.md, not into memory. Add a line saying so at the bottom of the file.
6. **Test it.** In a fresh subagent, run the skill on a new input. Compare against `example.md` and fix the steps that caused any gap.
7. Add the skill to `brain/wiki/index.md` under a "Playbooks" heading, and log it in `brain/wiki/log.md`.
