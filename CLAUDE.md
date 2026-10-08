# CLAUDE.md

Gatsby 5 e-commerce theme (React 18, CSS Modules, Prettier). Product and blog data are mock JSON in `src/helpers/product.json` and `src/helpers/blog.json`. Site-wide config is in `src/config.json`. Deploys to Netlify.

## Commands
- `npm run develop`: dev server
- `npm run build`: production build (the real "does it work" check)
- `npm run format`: Prettier on `gatsby-*.js` and `src/**/*.js`

## Conventions
- One folder per component in `src/components/<Name>/` with `<Name>.js` and `<Name>.module.css`. Scaffold new ones with `npm run plop`.
- Match the existing Prettier config (`.prettierrc`).

## How we work: the AI team kit
- **Company brain:** business knowledge (voice, processes, decisions, products) lives in `brain/`. Read `brain/wiki/index.md` before answering questions about the business. Follow the rules in `brain/CLAUDE.md`. Use `/brain` to ingest, query, file or lint.
- **AI employees:** single-job subagents in `.claude/agents/`, listed in `brain/wiki/people/ai-team.md`: `product-copywriter`, `code-reviewer`, `launch-qa`. Hire new ones with `/hire-employee`.
- **Before building any automation**, run `/process-map` to decide where AI actually belongs.
- **Brake rule:** anything that publishes, sends to customers, spends money or deploys waits for the owner's explicit "yes".
- **End of a long session:** `/wrap-up` saves durable learnings to `brain/memory/journal.md`.
- **Hooks** (`.claude/settings.json`) block secret-file access and destructive shell commands, and refuse "done" while changed JSON, JS formatting or shell scripts are broken. Don't work around them. Ask the owner.
