# Task tracker

Every piece of work in this repo is a small, numbered task. This file is the one list of all of them.

- **Task name = branch name = learning-doc folder.** Task `01_project_setup` lives on branch `01_project_setup` and is explained in `document/task/01_project_setup/README.md`.
- **Status** is one of: `To do`, `In progress`, `Done`.
- **Small** means one focused change you could review in about 15 minutes. If a task grows past that, split it.

## Tasks

| # | Task (= branch) | Goal | Status | Learning doc |
| --- | --- | --- | --- | --- |
| 01 | `01_project_setup` | Repo foundation: readme, `.gitignore`, this tracker, learning-doc template | Done | [README](01_project_setup/README.md) |
| 02 | `02_claude_guidelines` | `CLAUDE.md`: the rules Claude follows in this repo | Done | [README](02_claude_guidelines/README.md) |
| 03 | `03_skills_installation` | Install Claude skills (GSAP, shadcn/ui, frontend-design, UI/UX Pro Max, 21st.dev) and write the skills doc | Done | [README](03_skills_installation/README.md) |
| 04 | `04_agents` | Subagents for planning, learning docs, UI work and review | Done | [README](04_agents/README.md) |

## Task steps

Each task is broken into small steps. Tick them off as you go.

### 01_project_setup

- [x] Make the first commit on `main` (a branch can't exist until there is a commit)
- [x] Create branch `01_project_setup`
- [x] Write `readme.md`
- [x] Add `.gitignore`
- [x] Create this tracker
- [x] Create `TEMPLATE.md` for learning docs
- [x] Write the learning doc
- [x] Merge into `main`

### 02_claude_guidelines

- [x] Create branch `02_claude_guidelines`
- [x] Fix the wrong `git check-ignore` example in the 01 learning doc (found after 01 was merged)
- [x] Write `CLAUDE.md` (project facts, task workflow, git rules, learning-doc rules, definition of done)
- [x] Link it from `readme.md`
- [x] Write the learning doc
- [x] Merge into `main`

### 03_skills_installation

- [x] Create branch `03_skills_installation`
- [x] Review each skill's files before installing
- [x] Install the skills into `.claude/skills/` (one commit per source)
- [x] Check the installed files match the reviewed ones
- [x] Check the UI/UX Pro Max search script runs
- [x] Write `document/skills/skills.md`
- [x] Add the skills section to `CLAUDE.md` and `readme.md`
- [x] Write the learning doc
- [x] Merge into `main`

### 04_agents

- [x] Create branch `04_agents`
- [x] Write the subagents in `.claude/agents/`
- [x] Check Claude Code loads all four agents
- [x] Add the agents section to `CLAUDE.md` and `readme.md`
- [x] Write the learning doc
- [x] Merge into `main`

## Backlog (proposed)

These are suggestions for building the app. They depend on the product brief, so confirm or change them before starting.

| # | Task (= branch) | Goal | Status |
| --- | --- | --- | --- |
| 05 | `05_app_setup` | Create the React app (Next.js + TypeScript + Tailwind suggested) and run `shadcn init` | To do |
| 06 | `06_design_system` | Choose colors, fonts and spacing with UI/UX Pro Max and frontend-design; save them in `design-system/` | To do |
| 07 | `07_layout_shell` | Shared header, footer and navigation | To do |
| 08 | `08_home_page` | First page, with one GSAP entrance animation | To do |

## How to add a task

1. **Pick the next free number.** Always two digits: `05`, `06`, ... `10`, `11`.
2. **Name it** `NN_short_name`: lowercase, words joined with `_`, two to four words that say the outcome.
   Good: `05_app_setup`, `12_booking_form`. Bad: `5-stuff`, `fix`, `Task_Twelve`.
3. **Add it here**: a row in the table (status `To do`) and a list of small steps under "Task steps".
4. **Create the branch** from an up-to-date `main`:
   ```bash
   git switch main
   git pull            # only if the repo has a remote you work with
   git switch -c 05_app_setup
   ```
5. **Set the status to `In progress`** and do the work in small commits.
6. **Write the learning doc**: copy [TEMPLATE.md](TEMPLATE.md) to `document/task/NN_short_name/README.md` and fill it in.
7. **Set the status to `Done`** and link the learning doc in the table.
8. **Merge into `main`** (or open a pull request):
   ```bash
   git switch main
   git merge --no-ff 05_app_setup
   ```
