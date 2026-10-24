# Go Mechanic

Go Mechanic is a web app project. Right now the repo holds the **project setup only**: docs, task tracking and the Claude Code tooling. App code starts in a later task (see the backlog in the [task tracker](document/task/task.md)).

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
| `document/skills/skills.md` | The Claude skills we use (GSAP, shadcn/ui, frontend-design, UI/UX Pro Max, 21st.dev) and when to use each. |
| `.claude/skills/` | The installed skill files. They come with the repo, so there's nothing extra to install. |
| `skills-lock.json` | Where each skill came from, so installs are repeatable. |
| `.claude/agents/` | Helper agents Claude can hand work to: `task-planner`, `ui-engineer`, `learning-doc-writer`, `code-reviewer`. |
| `.claude/settings.json` | Shared Claude Code settings. Installs the Compound Engineering plugin (pinned version) for everyone. |
| `.compound-engineering/` | Compound Engineering settings: `config.yaml` (ours) and `config.example.yaml` (every option explained). |
| `document/plans/` | Plans for individual tasks, written by Compound Engineering's `ce-plan`. Appears with the first plan. |
| `document/solutions/` | Reusable lessons, written by `ce-compound`. Claude reads them before similar work. |

## Prerequisites

- Git
- Node.js 20 or newer (check with `node -v`)
- Python 3 (check with `python3 --version`), for the UI/UX Pro Max search script
- [Claude Code](https://code.claude.com/docs/en/overview). The first time you open the repo, accept the "trust this folder" prompt. That's what lets the Compound Engineering plugin load from `.claude/settings.json`.
- Optional: a [21st.dev](https://21st.dev) account for the 21st skills. Run `npx @21st-dev/cli login` once.
