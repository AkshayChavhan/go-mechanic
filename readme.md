# Go Mechanic

GoMechanic is the website and booking system for one garage in India that repairs cars and two-wheelers. Customers see services and prices, book a slot, track their vehicle and approve estimates online; the garage runs everything from an admin dashboard. The look is clean and Apple-like, with smooth animation.

- What it does: [document/website/features.md](document/website/features.md)
- How it's built, and all tasks: [the master plan](document/plans/2026-10-24-gomechanic-master-plan.md) and the [task tracker](document/task/task.md)
- Languages: English now, Hindi later. All the text people read lives in [messages/en.json](messages/en.json), so Hindi only needs a `messages/hi.json`.
- Design: colours, type, components and motion are in [design-system/go-mechanic/MASTER.md](design-system/go-mechanic/MASTER.md). Run `npm run dev` and open http://localhost:3000/dev/design to see all of it on one page.

## How we work

Every change is a small, numbered **task**:

1. The task is listed in [document/task/task.md](document/task/task.md).
2. It gets its own git branch with the same name, for example `01_project_setup`.
3. It ships with a learning doc, `document/learning/<task>.md`, that explains **why** we made the change, **what** changed and **how** we did it.
4. It follows the **Compound Engineering** loop: plan, work, review, compound. "Compound" means saving any lesson worth reusing in `document/solutions/`, so the next task starts smarter.

New here? Read the learning docs in order, starting with [01_project_setup](document/learning/01_project_setup.md).

## Repo map

| Path | What it is |
| --- | --- |
| `readme.md` | This file. The front page of the repo. |
| `CLAUDE.md` | The rules Claude Code follows in this repo. Claude reads it at the start of every session. |
| `.gitignore` | Files git must never track: dependencies, build output, secrets. |
| `document/task/task.md` | The task tracker: every task, its branch, its status and its learning doc. |
| `document/learning/TEMPLATE.md` | The starting point for each task's learning doc. |
| `document/learning/NN_name.md` | One learning doc per task: why, what and how. |
| `document/website/features.md` | The product plan: features, users, pages, design direction. |
| `document/skills/skills.md` | The Claude skills we use (GSAP, shadcn/ui, frontend-design, UI/UX Pro Max, 21st.dev) and when to use each. |
| `.claude/skills/` | The installed skill files. They come with the repo, so there's nothing extra to install. |
| `skills-lock.json` | Where each skill came from, so installs are repeatable. |
| `.claude/agents/` | Helper agents Claude can hand work to: `task-planner`, `ui-engineer`, `learning-doc-writer`, `code-reviewer`, `seo-reviewer`. |
| `.claude/settings.json` | Shared Claude Code settings. Installs the Compound Engineering plugin (pinned version) for everyone, and turns on the automatic SEO check. |
| `.claude/hooks/` | `seo_check.py`: after Claude changes pages, it asks Claude to run the SEO reviewer and show you its suggestions. |
| `.compound-engineering/` | Compound Engineering settings: `config.yaml` (ours) and `config.example.yaml` (every option explained). |
| `document/plans/` | Plans: the project's master plan, plus one plan per task written by Compound Engineering's `ce-plan`. |
| `document/solutions/` | Reusable lessons, written by `ce-compound`. Claude reads them before similar work. |
| `src/` | The website's code. `src/app/[locale]/` holds the pages (one folder per URL; `[locale]` is the language), `src/components/` the shared components (`ui/` from shadcn/ui, `site/` our own), `src/i18n/` the language setup and the ₹ and date helpers, `src/server/` code that only runs on the server (the database in `db/`, the code that reads and saves its data in `dal/`, the checked settings in `env.ts`, login in `auth/` and `actions/`, the fake SMS sender in `providers/`), `src/content/` typed content the database hasn't taken over yet (services, the offer, home page stats), `src/domain/` pure business logic such as opening hours and the garage's rules, `src/lib/` small helpers. |
| `design-system/` | The design system written out for people: tokens, rules and the brand. |
| `messages/` | The website's text, one file per language (`en.json` for now). |
| `e2e/` | Browser tests: Playwright opens the real site in Chrome and checks it. `e2e/login.spec.ts` logs in with a fresh number on a production build. `e2e/dev/` checks the development-only pages (`/dev/design`, `/dev/outbox`) and the home page under `npm run dev`. |
| `package.json`, `package-lock.json` | The app's dependencies and commands. |
| `.nvmrc` | The Node.js version the project uses (24). |
| `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `components.json` | Settings for Next.js, TypeScript, ESLint and shadcn/ui. |
| `drizzle.config.ts` | Settings for drizzle-kit, the tool that turns the database schema (`src/server/db/schema.ts`) into SQL migrations (`src/server/db/migrations/`). |
| `.env.example` | The server settings you *could* set (`APP_ENV`, `DATABASE_URL`, `BETTER_AUTH_SECRET`, `SMS_PROVIDER`, `E2E_OUTBOX_FILE`, `OWNER_PHONE_NUMBER`), with fake values. Local development needs none of them. |
| `.pglite/`, `.pglite.lock` | Your local database, made by the first `npm run dev`, and the lock file that stops a second program opening it at the same time. Git ignores both. |
| `vitest.config.mts`, `vitest.setup.ts`, `playwright.config.ts`, `playwright.dev.config.ts` | Test settings. |
| `AGENTS.md` | Notes from Next.js for AI coding agents. |

## Run the website

```bash
fnm use                # switch to the Node version in .nvmrc (24)
npm install            # install dependencies (first time, or after package.json changes)
npm run dev            # start the dev server
```

Open http://localhost:3000. There's no database to install: the first `npm run dev` creates one in `.pglite/` (PGlite, a Postgres that runs inside Node) and fills it with the garage's real details. Your changes to it stay there between restarts.

To log in locally: open http://localhost:3000/login, type any Indian mobile number and tick both boxes. No SMS is sent until the launch: the code shows on http://localhost:3000/dev/outbox instead (newest first). Type it on `/login` and you land on `/account`. Log in with the garage's own number (97647 50567) to be the owner; any other number is a customer. Test runs leave users with `60000...` numbers in your local database; `npm run db:reset` clears them.

Other commands:

| Command | What it does |
| --- | --- |
| `npm run check` | Lint, type check and unit tests in one go. Run it before you call any work done. |
| `npm run test:e2e` | Builds the site and opens it in your Chrome to check it really works. Run it before merging. |
| `npm run test:design` | Checks the `/dev/design` and `/dev/outbox` pages and the home page in Chrome (sizes, contrast, focus, motion) and saves screenshots. Run it after any design change. Note: `npm run dev` shows "Sample" stats and reviews on the home page that the live site never shows. |
| `npm run build` / `npm start` | Build the production version / run it |
| `npm run lint`, `npm run typecheck`, `npm run test` | The three parts of `check`, one at a time |
| `npm run db:reset` | Deletes your local database (`.pglite/` and its lock); the next `npm run dev` starts a fresh one with the garage's details. Use it when the local data is in a mess or a migration you were writing went wrong. Stop `npm run dev` first. |
| `npm run db:generate -- --name=<what_changed>` | After changing `src/server/db/schema.ts`: writes the SQL migration for it. Commit it with the schema change, then restart `npm run dev` to apply it. |

## Prerequisites

- Git
- Node.js 24, the version in `.nvmrc` (check with `node -v`). With [fnm](https://github.com/Schniz/fnm), run `fnm use` in the project folder.
- Google Chrome, for the browser tests (`npm run test:e2e`)
- Python 3.9 or newer (check with `python3 --version`), for the UI/UX Pro Max search script and the automatic SEO check
- [Claude Code](https://code.claude.com/docs/en/overview). The first time you open the repo, accept the "trust this folder" prompt. That's what lets the Compound Engineering plugin load from `.claude/settings.json`.
- Optional: a [21st.dev](https://21st.dev) account for the 21st skills. Run `npx @21st-dev/cli login` once.
