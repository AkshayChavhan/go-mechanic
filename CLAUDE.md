# CLAUDE.md: how Claude works in this repo

Claude Code reads this file at the start of every session. Follow it for all work in this repo.

## The project

- **Go Mechanic**, a web app. Current stage: setup only, no app code yet.
- The stack is not chosen yet. The installed skills point to React + Tailwind + shadcn/ui + GSAP (Next.js suggested). **Confirm the stack with the user before scaffolding the app.**
- **The owner is learning.** Every task must teach. Write explanations for a junior software engineer.

## Repo map

| Path | Purpose |
| --- | --- |
| `CLAUDE.md` | This file: rules for Claude |
| `readme.md` | Front page for humans |
| `document/task/task.md` | Task tracker: every task, branch, status and step list |
| `document/task/TEMPLATE.md` | Template for learning docs |
| `document/task/NN_name/README.md` | Learning doc for task `NN_name` |
| `document/skills/skills.md` | What each installed skill does and when to use it |
| `.claude/skills/` | Installed project skills (third-party: don't edit by hand) |
| `skills-lock.json` | Source and content hash of each installed skill |
| `.claude/agents/` | Project subagents (see Agents) |

## Task workflow (always follow)

1. **Split the work into small tasks.** One task = one focused change that can be reviewed in about 15 minutes. If a request is bigger, split it (use the `task-planner` agent), add every piece to `document/task/task.md` with a step list, and show the plan to the user before starting.
2. **Name the task `NN_short_name`**: next free two-digit number, lowercase, words joined with `_`, two to four words that describe the outcome (`05_app_setup`, `12_booking_form`).
3. **Branch name = task name.** Start from an up-to-date `main`: `git switch main`, then `git switch -c NN_short_name`.
4. **Track progress in `task.md`**: set the row to `In progress` when you start, tick the steps as they're done, set `Done` and link the learning doc at the end.
5. **Commit in small steps** with Conventional Commit messages (see Git rules).
6. **Write the learning doc** at `document/task/NN_short_name/README.md` from `TEMPLATE.md` (see Learning docs; the `learning-doc-writer` agent can draft it).
7. **Review, then merge into `main`.** Run the `code-reviewer` agent on the branch and fix every "must fix". Then `git switch main && git merge --no-ff NN_short_name`, unless the user asked for a pull request.
8. **One task at a time.** Don't start the next task on the same branch. If you find unrelated work, add it to the backlog in `task.md` instead of doing it.

## Learning docs

Every task gets one. The reader is a junior software engineer.

- **Answer three questions:** Why (the problem), What (files changed and why each exists), How (step by step, with the real commands and what each flag does).
- **Also include:** new terms explained in plain words, how to check it works, common mistakes, a short exercise, links to learn more.
- **Write plainly:** short sentences, explain every new term the first time, use everyday comparisons when they help. Use the real file paths and commands from the task.
- **Be honest:** if something went wrong or was skipped, say so and explain why.
- **Keep it short:** aim for one to two screens. Link to official docs instead of copying them.

## Git rules

- **Commit messages** use Conventional Commits: `type: what changed`. Types: `feat` (new app feature), `fix` (bug fix), `docs` (documentation), `chore` (tooling, config, dependencies), `refactor`, `style`, `test`. Add a scope in brackets when it helps: `docs(01): fix example`.
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
- **ui-ux-pro-max vs frontend-design:** treat ui-ux-pro-max results as input and a checklist; frontend-design and the product brief make the final visual call. Accessibility rules always win.
- **21st.dev:** needs the user's login (`npx @21st-dev/cli login`) or a `TWENTYFIRST_TOKEN` env var. Never commit the key. Don't use hosted generation (`21st generate`, `21st iterate`) unless `21st usage` shows AI is enabled; it uses paid credits. Don't publish anything to 21st.dev.
- **Don't edit files in `.claude/skills/`.** They come from upstream and `npx skills update` overwrites them. Put project-specific rules in this file instead.
- **New or updated skills:** read the files before installing or committing them. Use project scope: `npx skills add <owner/repo> --agent claude-code --skill <name> --copy -y`, then update `document/skills/skills.md`.

## Agents

Subagents live in `.claude/agents/`. The main session runs the task workflow and owns git (branches, commits, merges); subagents do one focused job and report back.

| Agent | Use it when | Can change files? |
| --- | --- | --- |
| `task-planner` | New work might need more than one task | Only `document/task/task.md` |
| `ui-engineer` | A task changes how the app looks, feels or moves | Yes (app code); no git |
| `learning-doc-writer` | A task's changes are committed and need a learning doc | Only the learning doc |
| `code-reviewer` | A task branch is ready to merge | No (read-only) |

Run independent subagents in parallel. When an agent's job changes, update its file and this table in the same task.

## Definition of done

A task is done when all of these are true:

- [ ] The work is on its own `NN_short_name` branch, in small commits
- [ ] It works, and you checked it (ran it, tested it, or opened it)
- [ ] `document/task/task.md` shows `Done`, all steps ticked, learning doc linked
- [ ] The learning doc exists and answers Why, What and How
- [ ] `readme.md` and `CLAUDE.md` are updated if the task changed how the repo works
- [ ] No secrets, no generated folders committed
- [ ] `code-reviewer` reports "Ready to merge" (or every "must fix" is fixed)
- [ ] Merged into `main` with `--no-ff` (or a pull request is open, if the user asked for one)

## Talking to the user

- Lead with the result, then the details.
- When a choice belongs to the user (stack, product direction, anything paid or public), ask. For everything else, pick the sensible default and say what you picked.
