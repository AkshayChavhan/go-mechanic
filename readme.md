# Go Mechanic

GoMechanic is the website and booking system for one garage in India that repairs cars and two-wheelers. Customers see services and prices, book a slot, track their vehicle and approve estimates online; the garage runs everything from an admin dashboard. The look is clean and Apple-like, with smooth animation.

- What it does: [document/website/features.md](document/website/features.md)
- How it's built, and all tasks: [the master plan](document/plans/2026-10-24-gomechanic-master-plan.md) and the [task tracker](document/task/task.md)

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

## Prerequisites

- Git
- Node.js 20 or newer (check with `node -v`)
- Python 3.9 or newer (check with `python3 --version`), for the UI/UX Pro Max search script and the automatic SEO check
- [Claude Code](https://code.claude.com/docs/en/overview). The first time you open the repo, accept the "trust this folder" prompt. That's what lets the Compound Engineering plugin load from `.claude/settings.json`.
- Optional: a [21st.dev](https://21st.dev) account for the 21st skills. Run `npx @21st-dev/cli login` once.
