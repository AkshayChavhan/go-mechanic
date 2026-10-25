# CLAUDE.md: how Claude works in this repo

Claude Code reads this file at the start of every session. Follow it for all work in this repo.

Next.js's own notes for coding agents (kept up to date by `next dev`): @AGENTS.md

## The project

- **GoMechanic**: a website and booking system for **one garage in India** that repairs cars and two-wheelers. Features: `document/website/features.md`. Full plan, architecture and tasks 07–46: `document/plans/2026-10-24-gomechanic-master-plan.md` (approved by the owner).
- **Stack, installed (task 09):** Node 24 LTS (`.nvmrc`), Next.js 16.4.3 (App Router, Cache Components), React 19.3, TypeScript 5, Tailwind CSS 4, shadcn/ui 4 (Radix base, nova preset), GSAP 3.15, Vitest 5, Playwright 1.64.
- **Stack, planned for later tasks:** Drizzle + Postgres (PGlite in development, task 14), Better Auth phone OTP (15), next-intl (10; English now, Hindi-ready). SMS, WhatsApp and email use fake providers until the launch tasks (44–45).
- **Design:** Apple-like, calm and spacious, with smooth GSAP scroll animation (see "Design direction" in `features.md`). Version 1 has no online payments or GST invoices.
- **The owner is learning.** Every task must teach. Write explanations for a junior software engineer.

## Repo map

| Path | Purpose |
| --- | --- |
| `CLAUDE.md` | This file: rules for Claude |
| `readme.md` | Front page for humans |
| `document/task/task.md` | Task tracker: every task, branch, status and step list |
| `document/learning/TEMPLATE.md` | Template for learning docs |
| `document/learning/NN_name.md` | Learning doc for task `NN_name` (one flat file per task) |
| `document/skills/skills.md` | What each installed skill does and when to use it |
| `document/website/features.md` | Product plan: features, roles, pages, design direction |
| `.claude/skills/` | Installed project skills (third-party: don't edit by hand) |
| `skills-lock.json` | Source and content hash of each installed skill |
| `.claude/agents/` | Project subagents (see Agents) |
| `.claude/settings.json` | Shared Claude Code settings: installs the Compound Engineering plugin (pinned version) and registers the SEO Stop hook |
| `.claude/hooks/` | Hook scripts: `seo_check.py` asks for an SEO review after page changes (see SEO review) |
| `.compound-engineering/config.yaml` | Compound Engineering team settings (`config.example.yaml` lists every option) |
| `document/plans/` | The master plan (`2026-10-24-gomechanic-master-plan.md`) plus per-task plans written by `ce-plan` / `ce-brainstorm` |
| `document/solutions/` | Lessons written by `ce-compound`: read the relevant ones before starting a task |
| `src/app/` | Pages and layouts (Next.js App Router: one folder per URL) |
| `src/lib/` | Small shared helpers (`utils.ts` has `cn()`) |
| `e2e/` | Playwright browser tests (`*.spec.ts`) |
| `AGENTS.md` | Next.js's notes for AI agents; imported above. `next dev` may rewrite its block: commit what it writes |
| `package.json`, `package-lock.json` | Dependencies and npm scripts (always commit the lockfile) |
| `.nvmrc` | Node version (24); fnm switches to it automatically |
| `next.config.ts`, `tsconfig.json`, `eslint.config.mjs` | Next.js, TypeScript and ESLint settings (TypeScript and ESLint skip `.claude/`) |
| `components.json` | shadcn/ui settings |
| `vitest.config.mts`, `vitest.setup.ts`, `playwright.config.ts` | Test settings |

## Commands

Run them with Node 24 (`.nvmrc`; `fnm use` if your shell is on another version).

```bash
npm run dev          # dev server on http://localhost:3000
npm run check        # lint + typecheck (next typegen + tsc) + unit tests; must pass before every commit you call done
npm run test:e2e     # Playwright on a production build (port 3210, your installed Chrome); must pass before every merge
npm run build        # production build
npm run lint         # ESLint only
npm run typecheck    # next typegen, then tsc --noEmit
npm run test         # Vitest once (npm run test:watch to keep it running)
npx shadcn@latest add <component>   # add a shadcn/ui component
```

`test:e2e` isn't part of `check` because it needs a production build (slow). Never run `npx playwright install`: it downloads browsers; the tests use the Chrome already installed.

## Code conventions

- **Next.js 16 is newer than your training data.** Before using a Next.js API, read its guide in `node_modules/next/dist/docs/` (see `document/solutions/conventions/nextjs-16-read-bundled-docs-image-priority.md`). Cache Components is on (`cacheComponents: true`).
- **Server Components by default.** Add `"use client"` only to components that need state, effects, event handlers or browser APIs, and keep them small.
- **Imports** use the `@/` alias (`@/lib/utils`).
- **Code layout** (from the master plan): `src/app/` routes, `src/components/{ui,site,account,admin}`, `src/domain/` pure logic with no Next.js or database imports, `src/server/` database, data access, actions and providers, `src/lib/` small helpers.
- **Tests sit next to the code:** `*.test.ts` runs in Node (logic), `*.test.tsx` runs in jsdom (React components). Browser tests go in `e2e/`. Import `test`/`expect` from `vitest` (no globals).
- **Tailwind only scans `src/`, minus test files** (`source("../")` and `@source not` in `src/app/globals.css`). Put anything that uses Tailwind classes inside `src/`, and not in a `*.test.*` file.
- **Secrets** come from environment variables, read on the server only. Never prefix a secret with `NEXT_PUBLIC_`: those values are built into the JavaScript every visitor downloads. Add every variable to `.env.example` with a fake value.
- **npm install scripts:** npm 11 asks before running a package's install script. Don't approve one unless something is actually broken without it (`unrs-resolver` is left unapproved; ESLint works without it).

## Task workflow: the Compound Engineering loop (always follow)

Every task goes **plan → work → review → compound**, inside our task and branch rules. Compound Engineering commands are namespaced: `/compound-engineering:ce-plan`, shortened to `ce-plan` below.

1. **Split the work into small tasks.** One task = one focused change that can be reviewed in about 15 minutes. If a request is bigger, split it (use the `task-planner` agent), add every piece to `document/task/task.md` with a step list, and show the plan to the user before starting.
2. **Name the task `NN_short_name`**: next free two-digit number, lowercase, words joined with `_`, two to four words that describe the outcome (`03_skills_installation`, `12_booking_form`).
3. **Branch name = task name.** Start from an up-to-date `main`: `git switch main`, then `git switch -c NN_short_name`.
4. **Track progress in `task.md`**: set the row to `In progress` when you start, tick each step only after it's really done, and link the learning doc. `Done` and the "Merge" tick come last, after the merge (step 11).
5. **Read past lessons.** Search `document/solutions/` for lessons that touch this task (`grep -ril "<topic>" document/solutions/`) and follow them.
6. **Plan.** For anything bigger than a one-file change, run `ce-plan` (run `ce-brainstorm` first if the request is still fuzzy). The plan is saved in `document/plans/`; link it from the task's steps in `task.md`.
7. **Work.** Build it, by hand or with `ce-work <plan file>`. Commit in small steps with Conventional Commit messages (see Git rules). When `ce-work` reaches its shipping step, it only commits on the task branch and stops (see "Compound Engineering" rules).
8. **Write the learning doc** at `document/learning/NN_short_name.md` from `document/learning/TEMPLATE.md` (see Learning docs; the `learning-doc-writer` agent can draft it).
9. **Review.** If the task changed code, run `ce-code-review` (it only reports), unless `ce-work` already ran it for this change. Then run the `code-reviewer` agent: it checks the repo rules and is the final gate. Fix every "must fix", **then** add the real verdict and what you fixed to the learning doc. Never write that a review (or test, or merge) happened before it did. See `document/solutions/conventions/run-commands-before-documenting-output.md`.
10. **Compound.** Ask: *"If this lesson weren't written down, would a future session repeat the mistake or redo the investigation?"* Mistakes the review caught are the usual source. If yes, run exactly `/compound-engineering:ce-compound mode:non-interactive depth:lightweight <one-line summary>` (never plain `/ce-compound`; see the privacy rule). It writes one lesson to `document/solutions/`. If no, skip it and say why in the learning doc.
11. **Merge, then mark it done.** `git switch main && git merge --no-ff NN_short_name` (unless the user asked for a pull request). Then make one bookkeeping commit on `main`, `docs(NN): mark task NN done`: tick "Merge into `main`" and set `Done` in `task.md` and in the learning doc's header. This is the only kind of commit made directly on `main`.
12. **One task at a time.** Don't start the next task on the same branch. If you find unrelated work, add it to the backlog in `task.md` instead of doing it.

## Learning docs

Every task gets one. The reader is a junior software engineer.

- **Answer three questions:** Why (the problem), What (files changed and why each exists), How (step by step, with the real commands and what each flag does).
- **Also include:** new terms explained in plain words, how to check it works, common mistakes, a short exercise, links to learn more.
- **Write plainly:** short sentences, explain every new term the first time, use everyday comparisons when they help. Use the real file paths and commands from the task.
- **Be honest:** if something went wrong or was skipped, say so and explain why.
- **Keep it short:** aim for one to two screens. Link to official docs instead of copying them.

## Git rules

- **Commit messages** use Conventional Commits: `type: what changed`. Types: `feat` (new app feature), `fix` (bug fix), `docs` (documentation), `chore` (tooling, config, dependencies), `refactor`, `style`, `test`. Add a scope in brackets when it helps: `docs(01): fix example`.
- **`feat` vs `chore`:** `feat` only for something a website visitor or garage user gets. Agents, hooks, skills, settings, config and dependencies are `chore` (this slipped in tasks 04 and 08).
- **Small commits:** code, docs and tracker updates usually go in separate commits, so each can be reviewed or reverted alone.
- **Never commit secrets.** API keys and tokens go in `.env` (ignored by git) or the tool's own login. Commit a `.env.example` with fake values instead.
- **Ask the user first** before: `git push`, opening a pull request, deleting a branch, `--force` anything, rewriting history on `main`, or installing anything globally (`-g`, `npm install -g`, `brew install`).
- **Don't commit generated folders** such as `node_modules/` or `.next/`. `.gitignore` already covers them.

## Skills

Installed in `.claude/skills/`. Full guide: `document/skills/skills.md`. For UI work, use them in this order:

1. **Direction:** `frontend-design` decides the look. `ui-ux-pro-max` supplies data and checklists. `21st-ui-explore` compares options when the direction is open.
2. **Build:** `shadcn` for components (always through the shadcn CLI). Search 21st (`21st-cli-use`) before hand-writing a section. `21st-ui-build` for whole pages or sections.
3. **Motion:** `gsap-react` (with `useGSAP`), plus `gsap-timeline` or `gsap-scrolltrigger`. Always handle `prefers-reduced-motion`.
4. **Review:** `21st-ui-review` and the ui-ux-pro-max pre-delivery checklist.

Rules:

- **ui-ux-pro-max script path:** run `python3 .claude/skills/ui-ux-pro-max/scripts/search.py ...` from the repo root. Ignore the `${CLAUDE_PLUGIN_ROOT}` prefix in its `SKILL.md`; that only applies to plugin installs. Persist with `--persist --output-dir .`; never pass `--force` without the user's OK.
- **ui-ux-pro-max is not always up to date for Next.js 16:** its Next.js data still says to use `priority` for hero images, which Next.js 16 deprecated. Check any Next.js advice from a skill against `node_modules/next/dist/docs/` (see `document/solutions/conventions/nextjs-16-read-bundled-docs-image-priority.md`).
- **ui-ux-pro-max vs frontend-design:** treat ui-ux-pro-max results as input and a checklist; frontend-design and the product brief make the final visual call. Accessibility rules always win.
- **21st.dev:** needs the user's login (`npx @21st-dev/cli login`) or a `TWENTYFIRST_TOKEN` env var. Never commit the key. Don't use hosted generation (`21st generate`, `21st iterate`) unless `21st usage` shows AI is enabled; it uses paid credits. Don't publish anything to 21st.dev.
- **Don't edit files in `.claude/skills/`.** They come from upstream and `npx skills update` overwrites them. Put project-specific rules in this file instead.
- **New or updated skills:** read the files before installing or committing them. Use project scope: `npx skills add <owner/repo> --agent claude-code --skill <name> --copy -y`, then update `document/skills/skills.md`.

## Compound Engineering (plugin)

Installed for this project through `.claude/settings.json`, pinned to v3.32.0. Settings in `.compound-engineering/config.yaml`. Full guide: `document/skills/skills.md`.

**Who does what** (pick this owner; don't run two tools for the same job):

| Job | Owner | Writes to |
| --- | --- | --- |
| Split a request into numbered tasks | `task-planner` agent | `document/task/task.md` |
| Plan one task in detail | `ce-plan` (`ce-brainstorm` for fuzzy ideas) | `document/plans/` |
| Build | you, or `ce-work` | the code |
| Code review | `ce-code-review` (report only) | nothing |
| Repo-rules review, final gate | `code-reviewer` agent | nothing |
| Teach the human what happened | `learning-doc-writer` agent | `document/learning/` |
| Save a lesson for future sessions | `ce-compound` | `document/solutions/` |

A **learning doc** teaches the owner (a junior engineer) what one task did. A **solution doc** is a short, reusable lesson that future Claude sessions read before similar work. A task always gets a learning doc; it gets a solution doc only when it taught something worth reusing.

**Rules (these override the plugin's defaults):**

- **Our shipping process wins.** In this repo, a Compound Engineering skill's shipping step means **commit on the task branch, then stop**. Merging into `main` happens only at Task workflow step 11, after the learning doc, review and compound steps. No Compound Engineering skill may push, open or update a pull request, start PR babysitting, merge, or create branches other than the task branch, unless the user asks in this session. Don't use `lfg`, `ce-commit-push-pr`, `ce-babysit-pr` or `ce-resolve-pr-feedback` unless the user asks for them by name. These rules are the real protection: the config switches only cover some of these paths.
- **No other AI vendors.** `cross_model_review_mode: off` stops `ce-code-review` and `ce-doc-review` from sending diffs to another model on their own. Never send code or docs to another model provider (Codex, Grok, Antigravity, Cursor, OpenCode), and never hand implementation to one, unless the user asks.
- **Privacy:** only ever run `ce-compound` as `mode:non-interactive depth:lightweight`. Plain `/ce-compound`, and the calls that `lfg`, `ce-debug`, `ce-optimize`, `ce-polish` and `ce-pov` make to it, run Full mode, which scans recent session transcripts in your home folder. If a skill offers to run `ce-compound`, decline and run the lightweight command yourself. Never read other projects' session files (`~/.claude/projects/`, `~/.codex/`, `~/.cursor/`).
- **Don't publish** to Proof (`ce-proof`) or anywhere else outside this machine without asking.
- **Pinned version:** tag `compound-engineering-v3.32.0`, reviewed at commit `786ac0194183fadc3d0e2525b2ba6d40353926d3`. A tag can be moved upstream, so check that `gitCommitSha` for this plugin in `~/.claude/plugins/installed_plugins.json` still matches. If it doesn't, stop and tell the user.
- **Updating the plugin:** read the release notes and the changed files first, then change the `ref` tag in `.claude/settings.json` and the commit above, in its own task. Never switch it to an unpinned branch.
- **Optional tools** it suggests (`agent-browser`, `ast-grep`, `ffmpeg`, a newer Node) are global installs: ask first.

## Agents

Subagents live in `.claude/agents/`. The main session runs the task workflow and owns git (branches, commits, merges); subagents do one focused job and report back.

| Agent | Use it when | Can change files? |
| --- | --- | --- |
| `task-planner` | New work might need more than one task | Only `document/task/task.md` |
| `ui-engineer` | A task changes how the app looks, feels or moves | Yes (app code); no git |
| `learning-doc-writer` | A task's changes are committed and need a learning doc | Only the learning doc |
| `code-reviewer` | A task branch is ready to merge | No (read-only) |
| `seo-reviewer` | Page files changed (the SEO hook asks automatically), or the owner asks to check SEO | No (read-only) |

Run independent subagents in parallel. When an agent's job changes, update its file and this table in the same task.

## SEO review

- **Automatic:** a Stop hook (`.claude/hooks/seo_check.py`, registered in `.claude/settings.json`) runs every time you finish a reply. If any file under `src/app/`, `src/components/`, `src/content/`, `src/i18n/`, `messages/` or `public/` changed since the last review (`src/app/api/`, `route.ts` files, tests and `.DS_Store` excluded), it sends you feedback once (shown as "Stop hook feedback") with a list of the changed files. It waits while a background subagent is still running, so half-built pages aren't reviewed.
- **When it asks:** run the `seo-reviewer` agent on the affected pages, **in the foreground** (not in the background, so it doesn't review half-finished pages while another agent is still building them). Then reply with a short **"SEO check"** section: what changed, each page's verdict (Pass / Needs work) and the suggested fixes. **Don't apply the fixes unless the owner asks.**
- **On demand:** when the owner asks to "check SEO" (for a page or the whole site), run `seo-reviewer` the same way.
- **Child sessions:** start every `claude -p` helper session with `GOMECHANIC_SEO_HOOK=off` in front (e.g. `GOMECHANIC_SEO_HOOK=off claude -p ...`). Otherwise the child takes the review, and the owner never sees it.
- **Re-review everything:** delete `.claude/.seo-reviewed.json` (git-ignored); the next reply reviews all page files. A fresh clone or worktree has no state file, so its first reply reviews every page once.
- **Two sessions in one folder** share the state file: the first one to finish a reply gets the review, even if the other made the change. Keep one session per checkout while building pages.
- **Before task 42:** missing metadata, sitemap, robots file and JSON-LD are planned for task 42, so the agent lists them on one "Waiting for task 42" line instead of failing the page.

## Definition of done

A task is done when all of these are true:

- [ ] The work is on its own `NN_short_name` branch, in small commits
- [ ] Bigger tasks have a plan in `document/plans/`, linked from `task.md`
- [ ] It works, and you checked it (ran it, tested it, or opened it)
- [ ] `npm run check` and `npm run test:e2e` pass (once the app exists, from task 09 on)
- [ ] `document/task/task.md` has the learning doc linked and every step ticked except "Merge" (ticked by the bookkeeping commit in step 11)
- [ ] The learning doc exists and answers Why, What and How
- [ ] `readme.md` and `CLAUDE.md` are updated if the task changed how the repo works
- [ ] No secrets, no generated folders committed
- [ ] `code-reviewer` reports "Ready to merge" (or every "must fix" is fixed)
- [ ] The compound question was asked: a lesson is in `document/solutions/`, or the learning doc says why none was needed
- [ ] Merged into `main` with `--no-ff` (or a pull request is open, if the user asked for one), then the `docs(NN): mark task NN done` commit sets `Done`

## Talking to the user

- Lead with the result, then the details.
- When a choice belongs to the user (stack, product direction, anything paid or public), ask. For everything else, pick the sensible default and say what you picked.
