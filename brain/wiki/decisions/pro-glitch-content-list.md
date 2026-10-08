# @pro.glitch: Claude and AI tools content list (from captions)
_Last updated: 2026-10-08_

All 106 scraped videos, grouped by topic. Each entry shows the plays, the title, and the takeaway from its caption.

## Tools named in the captions
- **Claude Code**: the main agent tool. Uses CLAUDE.md, skills, auto memory, subagents, hooks and permissions, connectors (MCP), and cloud routines that run with the laptop closed. A caption says it runs Fable 5.1.
- **Claude Opus 5.5**: launched Sep 22. Anthropic reports ~40% lower typical workload cost than Opus 5.
- **ChatGPT / GPT-6**: Astra powers Codex. Sol and Luna launched Sep 22; Sol made about half as many factual mistakes as its predecessor.
- **Codex, OpenClaw, Hermes, Grok Build**: "the same thing in different jackets" (agent harnesses). **Gemini** is mentioned as a model.
- **n8n**: the visual automation canvas. Used nodes: AI Agent (model + memory + tools), Data Table, IF, Schedule Trigger, Error Trigger and webhooks. With the n8n MCP server and an API key, Claude Code builds the n8n workflows itself.
- **MCP**: the standard way an AI connects to a tool. **API** and **CLI** are the other two doors.
- **Jev (TypeSafe)**: a classification-only model. 70–500 ms, ~$0.042 per million input tokens, output free.
- **Higgsfield**: image and video generation through its API. **Vapi**: AI phone receptionist. **Telegram bot (BotFather)**: approvals on your phone.
- **Business apps wired in**: Gmail, Google Sheets, Google Calendar, Slack, HubSpot, Jira, Stripe, QuickBooks, Postgres, Vercel AI Gateway, LangChain.
- **Obsidian**: covered as "not your second brain". **Docker/Kubernetes**: early devops content.

## 1. Claude Code builds
- **74.5K · How to build an AI team in Claude Code, every step.** Eight parts:
  1. A desk (folder) per employee
  2. A company folder: owner, voice, roster
  3. A shared notebook for corrections
  4. Handoffs through the roster
  5. One board: to do / doing / done
  6. A clock on every desk (schedules)
  7. Fences: tool allowlists, plus "waits for your yes"
  8. One employee who hires the others
- **20.2K + 1.1K · The first 5 AI employees for any small business.**
  1. Receptionist (Vapi + Google Calendar)
  2. Inbox manager (n8n, built by Claude Code through the n8n MCP; approvals on Telegram)
  3. Follow-up closer (n8n + HubSpot; nudges quotes after 2, 5 and 10 days)
  4. Money chaser (n8n + Stripe + QuickBooks)
  5. Chief of staff (a Claude Code skill that sends a Telegram brief at 7am)
- **7.6K · Claude Code doesn't replace n8n (a returns desk for an online shop).** Claude Code builds the returns page using CLAUDE.md and a refund-policy skill. n8n runs each return through Gmail, Sheets, Slack and Stripe. A nightly Claude Code cloud routine reads the day's returns and spots patterns.
- **5.3K · The 7-piece setup that makes AI run a business:**
  1. Context (CLAUDE.md)
  2. Auto memory
  3. Skills
  4. Connections (read, draft, send or change permissions)
  5. Specialist agents
  6. Cloud routines
  7. The gate (permissions and before-tool hooks)

  "The subscription is the floor, the setup is the ceiling."
- **4.3K · Claude Code, Codex, OpenClaw, Hermes, Grok Build: the one thing under all of them.** Six harness parts: context, memory, skills, connections, hooks/permissions, schedule. Pick one tool and go deep; switching later takes an hour.
- **4K · An AI employee that answers your customer emails.** Eight steps:
  1. Desk: CLAUDE.md with a one-line job
  2. Knowledge files
  3. Your voice: 20 real replies from your sent folder
  4. Connect the inbox with read and draft only, never send
  5. Write the procedure and save it as a skill
  6. Routing rules: angry, refund and legal messages go to you
  7. Test on last month's emails
  8. Widen trust one category at a time
- **3.3K · Make AI write and look exactly like your brand.** A CLAUDE.md handbook, a brand folder (logo, colors, photos, 5 best emails), and an email skill with an HTML template.
- **3.2K · Build your first AI employee from a blank folder.** Files: CLAUDE.md (job and rules), business.md, request.md; output goes to output/brief.md. Test it with an incomplete request: it should flag the gaps, not invent answers.
- **2.6K · Save your best AI result and use it forever.** Your corrections are the gold. Save the procedure and the example as a skill.
- **2.1K · What an AI coding assistant can do if you don't code.** Clean a spreadsheet, build a report, prepare client documents. Use a working folder, then save the process as a skill.
- **1.8K · Context, skills, MCP and routines through one job (the weekly business update).**
- **0.7K · Plug AI into your whole business.** The binder (brain + CLAUDE.md), the checklists (skills) and the logins (connections).
- **1.5K · Build a 3D website with AI**, **0.5K · Claude Code**, **0.7K · What an AI employee actually is.** These captions are hashtags only.

## 2. Connecting AI to tools: MCP, API, CLI
- **66.9K · MCP explained and how to connect your AI to it.**
- **44.8K · API vs CLI vs MCP and how to connect them to Claude.**
- **17.3K · Three doors, one building.** The API is the loading dock, the CLI is the staff entrance, MCP is the front desk.
- **12.1K · The real difference between an API and an MCP.** With MCP, the tool introduces itself first, so the AI can learn a tool it has never seen mid-job.
- **11.9K · CLI, API, MCP: the 3 ways your AI connects to everything.** GitHub, Stripe, Google Cloud and Google Workspace all have CLIs an AI can drive.
- **9.9K · MCP, the thing that lets your AI actually DO your work.** Query your database, read your inbox, generate thumbnails.
- **8.1K · MCP: how one person runs the jobs a whole team used to do.** Four pieces: tools, second brain, skills, schedule.
- **2.8K · What happens when you give AI an MCP.** **2K · What is an API.**
- **2.5K · Give your AI the keys to every tool.** MCP keys with a rule per key (read the CRM, never change it), a skill as the case file, and the agent loop. Example: "where's my order?" answered with CRM, carrier and calendar data.

## 3. Context, memory and second brain
- **22.9K · Obsidian is not your second brain.**
- **20.9K · The 4-write loop.** Write while working, sweep at the end, run a nightly sleep pass, and save corrections with why and how. Fixes go into skills, not memory.
- **19.4K · How to build a second brain.** raw/ (yours) plus wiki/ (the AI's), on a hard drive, portable to any AI.
- **8.7K · Every AI file ends in .md.** What Markdown is and why CLAUDE.md, AGENTS.md and skills use it.
- **5K · Context engineering.** **4.3K · Prompt chaining.** **2K · Context is everything.**
- **4.5K · Make Claude and ChatGPT yours.** One "map" file that points to customer, marketing and brand files.
- **3.8K · A second brain for your business.** Six shelves (offers, customers, and more), a map, and automations that keep it current.
- **3.1K · Context engineering explained.** Brief your AI, don't bury it. Focused extracts beat full histories (Chroma research).
- **3K / 1.6K · Stop re-explaining everything to your AI.** One folder with decision notes and sources.
- **2.7K · Everyone is renting the same AI.** Context, tools and skills make it yours.
- **2.4K · Your prompts are fine; you're feeding the AI nothing.** Prompting is what you say; context is what it has.

## 4. Agents, harness and AI employee concepts
- **40.1K · AI models vs AI agents.** The model is a chef; the agent is the chef with a kitchen (tools).
- **32K · How to build a team of AI agents (full roadmap).**
- **22.5K · Agentic RAG and agentic systems.** **10.2K · AI orchestration, agents and RAG explained.**
- **11.4K · What is harness engineering.**
- **8.9K · Loop engineering explained.** **8.8K · AI agent atomic steps.**
- **6.2K · Build an AI agent for your business, piece by piece.** Context saved as assets, tools, skills, and more.
- **4.9K · What multimodal means.**
- **4.6K · Everyone builds AI agents; almost nobody builds AI employees.**
- **4.3K · The 4 levels of AI agents.** Chatbot, then assistant (tools), then agent (a goal and a loop), then AI employee (job, memory and schedule; risky actions wait for approval).
- **3.8K · Real AI employees have five pieces.** Context, memory, and more.
- **3.3K · How AI actually works.** Next-word prediction, which explains hallucinations.
- **2.7K · Chat, automation, agent: the three words everyone mixes up.**
- **2.6K · 1 AI agent vs a team of agents.** **2K · From chatbot to AI employee (brain to harness).** **1.2K · AI agent A–Z roadmap.**
- **1.9K · Why AI demos break in your business.** GPT-6 scored 99.9% on its maker's setup and 62.7% on a neutral one. The difference is the harness.

## 5. n8n and automation builds
- **18.3K · Become the AI person on your team.** A weekly sales report: n8n schedule, HubSpot, Jira, Sheets, Claude writes it, then Slack.
- **4.5K · AI automation for a small business (Danny's cleaning company).** Map the business before touching any tools. Connect Gmail and sort 3 months of email.
- **4K · An AI employee that chases unpaid invoices.** n8n + Stripe, with an AI Agent node: Claude as the model, a Postgres table as memory, plus tools.
- **3.6K · An AI employee that makes your marketing videos.** A Google Sheet as the board (Status column), n8n, Claude or GPT, the Higgsfield API, and Slack Approve/Redo buttons.
- **3.3K · Automate your entire job with AI (no-code).**
- **3K · An AI employee that waits for your yes** (human-in-the-loop).
- **2.4K · Automation that thinks.** **2.3K · You can automate almost your entire business.** **1.3K · When AI stops chatting and starts working.**
- **1.8K · Three workflows around your AI employee.** Data Table, IF, Schedule Trigger and Error Trigger nodes.

## 6. Models and news
- **51.3K · An AI escaped its sealed test and hacked another company** (OpenAI test, Hugging Face servers). The lesson: guardrails matter.
- **28.4K · Jev (TypeSafe).** A fast, cheap classifier that returns calibrated confidence, used to route work to a person when unsure.
- **4.2K · Did Nvidia achieve AGI?** **0.8K · AI becomes a government minister in Albania.**
- **3.6K · Opus 5.5, GPT-6 Sol and Luna launched.** Your setup outlasts the model.

## 7. Roadmaps, careers and money
- **352.9K · You have exactly four months.** September foundations, October AI in the middle, November first AI employee, December a team.
- **72.4K · Roadmap to build your first AI employee from zero.**
- **30.3K / 5.9K · 5 AI skills paying $150K.** **28.9K · Learn AI automation in 3 months.**
- **13.7K · How a $50K AI project starts (process mapping).** **13K · If I started learning AI today.**
- **9.2K · Four ways I use AI to make money.** **9.1K · The truth about making money with AI.** **7.8K · People making money with AI aren't geniuses.**
- **6.3K · The entire path to learning AI.** **4.8K · 3 levels: Consumer, User, Builder.**
- **4.3K · Start a business with AI: a 4-week sprint.** **3.9K · Wipe everything and rebuild.** **3.4K · The exact roadmap and what's at the end.**
- **3.3K · Fastest way to learn AI.** **3.3K · Build an entire business with AI, in order.** **2.8K · Five builds from zero.**
- **2.6K · Become the AI person in 90 days.** **2.5K · Your next 100 days.** **2.2K · The next four months decide your next five years.**
- **1.7K · Top 1% at your company in 3 months.** **1.5K · What non-technical people built.** **1.5K · AI is why you can't find a job.**
- **1.3K · How AI fits in your workflow.**

## 8. Tech fundamentals and AI video
- **36.1K · Docker.** **18.7K · Docker port mapping.** **3.7K · What is a server.** **1.4K · JSON explained.**
- **5.6K · How to use AI to make professional film.** **1.4K · AI videos for your business.** These captions are hashtags only.

Source: raw/2026-10-08-tiktok-pro-glitch-106-videos.json (captions only)
