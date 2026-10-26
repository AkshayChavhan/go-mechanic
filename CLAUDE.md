# CLAUDE.md: how Claude works in this repo

Claude Code reads this file at the start of every session. Follow it for all work in this repo.

Next.js's own notes for coding agents (kept up to date by `next dev`): @AGENTS.md

## The project

- **GoMechanic**: a website and booking system for **one garage in India** that repairs cars and two-wheelers. Features: `document/website/features.md`. Full plan, architecture and tasks 07–46: `document/plans/2026-10-24-gomechanic-master-plan.md` (approved by the owner).
- **Stack, installed (task 09):** Node 24 LTS (`.nvmrc`), Next.js 16.4.3 (App Router, Cache Components), React 19.3, TypeScript 5, Tailwind CSS 4, shadcn/ui 4 (Radix base, nova preset), GSAP 3.15, Vitest 5, Playwright 1.64; next-intl 4.14 (task 10: English now, Hindi-ready); fonts and design tokens (task 11: San Francisco on Apple devices, Inter elsewhere, Noto Sans Devanagari for Hindi, through `next/font`).
- **Stack, planned for later tasks:** Drizzle + Postgres (PGlite in development, task 14), Better Auth phone OTP (15). SMS, WhatsApp and email use fake providers until the launch tasks (44–45).
- **Design:** Apple-like, calm and spacious, with smooth GSAP scroll animation (see "Design direction" in `features.md`). The design system is `design-system/go-mechanic/MASTER.md` (approved 2026-10-26); see it all at `/dev/design` under `npm run dev`. Version 1 has no online payments or GST invoices.
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
| `src/app/[locale]/` | Pages and the root layout (Next.js App Router: one folder per URL). `[locale]` is the language; English URLs have no prefix |
| `src/app/[locale]/dev/` | Development-only pages: `/dev/design` is the living catalogue of the design (404 in production) |
| `src/app/global-not-found.tsx` | The 404 page for unknown URLs (has its own `<html>`; uses `next/link` on purpose) |
| `src/app/globals.css`, `fonts.ts`, `icon.svg` | Design tokens and global styles, the fonts, the letter icon |
| `src/components/ui/` | shadcn/ui components, restyled ("Our changes to shadcn's ..." at the top of each edited file; `restyle.test.tsx` guards them) |
| `src/components/site/` | Our shared components: `Wordmark` (the brand name), `Section` (page sections) |
| `design-system/go-mechanic/MASTER.md` | The design system for people: tokens, rules, brand and rename checklist (`globals.css` wins if they disagree) |
| `src/proxy.ts` | Runs before each request: next-intl picks the language and redirects `/en/...` to `/...` |
| `src/i18n/` | Languages: `config.ts` (locales, IST time zone), `routing.ts`, `request.ts`, `navigation.ts` (links and redirects), `global.ts` (typed message keys), `format.ts` (₹, dates), `localized-text.ts`, `test-utils.tsx` (`renderWithIntl`), `lint-guards.test.ts` |
| `messages/en.json` | Every piece of UI text, by namespace (Hindi goes in `messages/hi.json` later) |
| `src/lib/` | Small shared helpers: `utils.ts` (`cn()`), `motion.ts` (motion tokens), `color-contrast.ts`, `dev-only.ts` (`devOnly()`) |
| `e2e/` | Playwright browser tests (`*.spec.ts`) on a production build |
| `e2e/dev/`, `playwright.dev.config.ts` | Browser checks of dev-only pages against `next dev` (`npm run test:design`) |
| `AGENTS.md` | Next.js's notes for AI agents; imported above. `next dev` may rewrite its block: commit what it writes |
| `package.json`, `package-lock.json` | Dependencies and npm scripts (always commit the lockfile) |
| `.nvmrc` | Node version (24): fnm switches to it on `cd` if set up with `fnm env --use-on-cd`, otherwise run `fnm use` |
| `next.config.ts`, `tsconfig.json`, `eslint.config.mjs` | Next.js, TypeScript and ESLint settings (TypeScript and ESLint skip `.claude/`) |
| `components.json` | shadcn/ui settings |
| `vitest.config.mts`, `vitest.setup.ts`, `playwright.config.ts` | Test settings |

## Commands

Run them with Node 24 (`.nvmrc`; `fnm use` if your shell is on another version).

```bash
npm run dev          # dev server on http://localhost:3000
npm run check        # lint + typecheck (next typegen + tsc) + unit tests; must pass before every commit you call done
npm run test:e2e     # Playwright on a production build (port 3210, your installed Chrome); must pass before every merge
npm run test:design  # Playwright on /dev/design under next dev (port 3000; reuses a running dev server), saves screenshots to test-results/design/
npm run build        # production build
npm run lint         # ESLint only
npm run typecheck    # next typegen, then tsc --noEmit
npm run test         # Vitest once (npm run test:watch to keep it running)
npx shadcn@latest add <component>   # add a shadcn/ui component
```

`test:e2e` isn't part of `check` because it needs a production build (slow). Never run `npx playwright install`: it downloads browsers; the tests use the Chrome already installed. If `typecheck` fails with an error inside `.next/dev/types/` after you moved a route, delete `.next/dev` (stale types from an earlier `npm run dev`) and run it again. If a CSS change doesn't show up in `npm run build` or `test:e2e`, delete `.next/cache/turbopack` (Turbopack's build cache) and run again: seen once in task 11, not reproduced in 3 later tries.

## Code conventions

- **Next.js 16 is newer than your training data.** Before using a Next.js API, read its guide in `node_modules/next/dist/docs/` (see `document/solutions/conventions/nextjs-16-read-bundled-docs-image-priority.md`). Cache Components is on (`cacheComponents: true`).
- **Server Components by default.** Add `"use client"` only to components that need state, effects, event handlers or browser APIs, and keep them small.
- **Imports** use the `@/` alias (`@/lib/utils`).
- **Code layout** (from the master plan): `src/app/` routes, `src/components/{ui,site,account,admin}`, `src/domain/` pure logic with no Next.js or database imports, `src/server/` database, data access, actions and providers, `src/lib/` small helpers.
- **Tests sit next to the code:** `*.test.ts` runs in Node (logic), `*.test.tsx` runs in jsdom (React components). Browser tests go in `e2e/`. Import `test`/`expect` from `vitest` (no globals).
- **Tailwind only scans `src/`, minus test files** (`source("../")` and `@source not` in `src/app/globals.css`). Put anything that uses Tailwind classes inside `src/`, and not in a `*.test.*` file.
- **Design system** (`design-system/go-mechanic/MASTER.md`; `globals.css` wins if they disagree):
  - Colours, radius, shadows and spacing only through token classes (`bg-card`, `text-link`, `rounded-xl`, `py-(--section-space)`). No raw values outside `globals.css` and `src/components/ui/`.
  - Text size only from `type-*` classes. Never put a `type-*` class and a stock `text-*`, `leading-*` or font-weight class on one element: those come later in the CSS and win. To change a component's text size, give it a variant or size, not an extra class. Lint rejects stock `text-*` sizes; it misses arbitrary sizes (`text-[17px]`) and stacked `leading-*`/`font-*`, so check those by hand.
  - Page sections use `Section` (`tone`: white, grey or dark; `width`). There is no site-wide dark mode.
  - Buttons and fields keep 44px touch targets. One blue (`default`) button per group.
  - The brand name lives only in `messages/en.json`; pages show it through `Wordmark` (`brand-name.test.ts` enforces it).
  - Motion timings come from `@/lib/motion`. GSAP animations go inside `gsap.matchMedia()` with `motionAllowed` and `motionReduced`, and content is visible before JavaScript runs.
  - `/dev/design` is the living catalogue of the design. A task that adds or changes a token, a `type-*` style or a `ui/`/`site/` component also adds or updates its sample there, and `npm run test:design` must pass.
- **Development-only pages** live in `src/app/[locale]/dev/`, call `devOnly()` (`@/lib/dev-only`) first so production answers 404 with `noindex`, and may type demo text (lint allows it there only).
- **Languages (next-intl).** The site is English-only for now but must stay Hindi-ready:
  - UI text goes in `messages/en.json` and is read with `useTranslations` (pages stay non-async). Async server code (`generateMetadata`, layouts) uses `getTranslations`. Lint rejects text typed into JSX in `src/app/` and `src/components/` (except `ui/` and dev pages): between tags, inside conditions (`{ok ? "Yes" : "No"}`, one level nested too) and in `alt`, `title`, `placeholder`, `aria-label`, `aria-description`, `aria-valuetext`, `aria-roledescription` and `aria-placeholder`. `src/i18n/lint-guards.test.ts` keeps these rules working; add a case there for any new guard (`document/solutions/conventions/lint-guards-test-real-jsx-shapes.md`). Lint doesn't check page metadata, so put its text in messages too.
  - `Link`, `redirect`, `useRouter` and `usePathname` come from `@/i18n/navigation`, not `next/link` or `next/navigation` (lint enforces it), so the `/hi` prefix is kept.
  - Money is stored and passed as integer paise and shown with `formatRupees` (`₹1,23,456`). Dates and times are shown with `formatDate` and `formatTime`, always in India time (`Asia/Kolkata`). Format first, then pass the string to `t()`: don't use ICU `{n, number}` or `{d, date}` in messages, because next-intl formats those with plain `en` (`₹123,456`, US date order).
  - Text stored in the database is a `LocalizedText` (`{ en, hi? }`), shown with `localize(text, locale)`.
  - Route Handlers and Server Actions pass the locale explicitly (`getTranslations({ locale, namespace })`): there's no `[locale]` page around them.
  - Page slugs never contain a dot or start with `api`: the proxy skips those paths (dotted ones are treated as files), so they never reach a page.
  - Component tests render with `renderWithIntl` from `@/i18n/test-utils`.
- **Secrets** come from environment variables, read on the server only. Never prefix a secret with `NEXT_PUBLIC_`: those values are built into the JavaScript every visitor downloads. Add every variable to `.env.example` with a fake value.
- **npm install scripts:** npm 11 *skips* packages' install scripts until you approve them (`npm install-scripts approve <pkg>`) and prints an `install-scripts` warning. Don't approve one unless something is actually broken without it. `unrs-resolver`, `fsevents`, and next-intl's `@swc/core` and `@parcel/watcher` are left unapproved; `check` and `test:e2e` pass without them.

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
11. **Hand over through a pull request, then mark it done.** The owner merges every task on GitHub (their choice from task 10 on; tasks 01–09 were merged locally with `git merge --no-ff`).
    - Ask, then push the task branch (`git push -u origin NN_short_name`) and check that a pull request into `main` exists (`gh pr list`). The owner usually opens it; open one with `gh pr create` only if they ask. Then stop: never merge it yourself.
    - After the owner merges it, sync: `git switch main && git pull --ff-only origin main`.
    - Mark it done in one bookkeeping commit, `docs(NN): mark task NN done`: tick "Merge into `main`" and set `Done` in `task.md` and in the learning doc's header. Make it the first commit on the next task's branch, so `main` only ever changes through pull requests. Never commit directly on `main`.
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
- **ui-ux-pro-max vs frontend-design:** treat ui-ux-pro-max results as input and a checklist; frontend-design and the product brief make the final visual call. Accessibility rules always win. Don't `--persist` its output when it contradicts the brief: `MASTER.md` is written by hand (task 11).
- **After `npx shadcn add`:** read the new `ui/` files for English typed into them (like Sheet's "Close") and turn it into a prop fed from messages. Never re-add an edited component with `--overwrite`; `restyle.test.tsx` fails if the restyle is lost.
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

- **Our shipping process wins.** In this repo, a Compound Engineering skill's shipping step means **commit on the task branch, then stop**. Merging into `main` happens only at Task workflow step 11, when the owner merges the pull request, after the learning doc, review and compound steps. No Compound Engineering skill may push, open or update a pull request, start PR babysitting, merge, or create branches other than the task branch, unless the user asks in this session. Don't use `lfg`, `ce-commit-push-pr`, `ce-babysit-pr` or `ce-resolve-pr-feedback` unless the user asks for them by name. These rules are the real protection: the config switches only cover some of these paths.
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
- [ ] If the task touched the design (tokens, `type-*`, `ui/` or `site/` components), its samples are on `/dev/design` and `npm run test:design` passes
- [ ] `document/task/task.md` has the learning doc linked and every step ticked except "Merge" (ticked by the bookkeeping commit in step 11)
- [ ] The learning doc exists and answers Why, What and How
- [ ] `readme.md` and `CLAUDE.md` are updated if the task changed how the repo works
- [ ] No secrets, no generated folders committed
- [ ] `code-reviewer` reports "Ready to merge" (or every "must fix" is fixed)
- [ ] The compound question was asked: a lesson is in `document/solutions/`, or the learning doc says why none was needed
- [ ] The task branch is pushed and the owner merged its pull request into `main`; the `docs(NN): mark task NN done` commit (first commit of the next task's branch) sets `Done`

## Talking to the user

- Lead with the result, then the details.
- When a choice belongs to the user (stack, product direction, anything paid or public), ask. For everything else, pick the sensible default and say what you picked.
