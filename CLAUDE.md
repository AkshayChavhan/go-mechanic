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

## Task workflow (always follow)

1. **Split the work into small tasks.** One task = one focused change that can be reviewed in about 15 minutes. If a request is bigger, split it, add every piece to `document/task/task.md` with a step list, and show the plan to the user before starting.
2. **Name the task `NN_short_name`**: next free two-digit number, lowercase, words joined with `_`, two to four words that describe the outcome (`05_app_setup`, `12_booking_form`).
3. **Branch name = task name.** Start from an up-to-date `main`: `git switch main`, then `git switch -c NN_short_name`.
4. **Track progress in `task.md`**: set the row to `In progress` when you start, tick the steps as they're done, set `Done` and link the learning doc at the end.
5. **Commit in small steps** with Conventional Commit messages (see Git rules).
6. **Write the learning doc** at `document/task/NN_short_name/README.md` from `TEMPLATE.md` (see Learning docs).
7. **Merge into `main`** with `git switch main && git merge --no-ff NN_short_name`, unless the user asked for a pull request.
8. **One task at a time.** Don't start the next task on the same branch. If you find unrelated work, add it to the backlog in `task.md` instead of doing it.

## Learning docs

Every task gets one. The reader is a junior software engineer.

- **Answer three questions:** Why (the problem), What (files changed and why each exists), How (step by step, with the real commands and what each flag does).
- **Also include:** new terms explained in plain words, how to check it works, common mistakes, a short exercise, links to learn more.
- **Write plainly:** short sentences, explain every new term the first time, use everyday comparisons when they help. Use the real file paths and commands from the task.
- **Be honest:** if something went wrong or was skipped, say so and explain why.
- **Keep it short:** aim for one to two screens. Link to official docs instead of copying them.

## Git rules

- **Commit messages** use Conventional Commits: `type: what changed`, with types `feat`, `fix`, `docs`, `chore`, `refactor`, `style`, `test`. Add a scope in brackets when it helps: `docs(01): fix example`.
- **Never commit secrets.** API keys and tokens go in `.env` (ignored by git) or the tool's own login. Commit a `.env.example` with fake values instead.
- **Ask the user first** before: `git push`, opening a pull request, deleting a branch, `--force` anything, rewriting history on `main`, or installing anything globally (`-g`, `npm install -g`, `brew install`).
- **Don't commit generated folders** such as `node_modules/` or `.next/`. `.gitignore` already covers them.

## Definition of done

A task is done when all of these are true:

- [ ] The work is on its own `NN_short_name` branch, in small commits
- [ ] It works, and you checked it (ran it, tested it, or opened it)
- [ ] `document/task/task.md` shows `Done`, all steps ticked, learning doc linked
- [ ] The learning doc exists and answers Why, What and How
- [ ] `readme.md` and `CLAUDE.md` are updated if the task changed how the repo works
- [ ] No secrets, no generated folders committed
- [ ] Merged into `main` with `--no-ff` (or a pull request is open, if the user asked for one)

## Talking to the user

- Lead with the result, then the details.
- When a choice belongs to the user (stack, product direction, anything paid or public), ask. For everything else, pick the sensible default and say what you picked.
