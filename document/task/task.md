# Task tracker

Every piece of work in this repo is a small, numbered task. This file is the one list of all of them.

- **Task name = branch name = learning-doc file name.** Task `01_project_setup` lives on branch `01_project_setup` and is explained in `document/learning/01_project_setup.md`.
- **Status** is one of: `To do`, `In progress`, `Done`.
- **Small** means one focused change you could review in about 15 minutes. If a task grows past that, split it.

## Tasks

| # | Task (= branch) | Goal | Status | Learning doc |
| --- | --- | --- | --- | --- |
| 01 | `01_project_setup` | Repo foundation: readme, `.gitignore`, this tracker, learning-doc template | Done | [01_project_setup.md](../learning/01_project_setup.md) |
| 02 | `02_claude_guidelines` | `CLAUDE.md`: the rules Claude follows in this repo | Done | [02_claude_guidelines.md](../learning/02_claude_guidelines.md) |
| 03 | `03_skills_installation` | Install Claude skills (GSAP, shadcn/ui, frontend-design, UI/UX Pro Max, 21st.dev) and write the skills doc | Done | [03_skills_installation.md](../learning/03_skills_installation.md) |
| 04 | `04_agents` | Subagents for planning, learning docs, UI work and review | Done | [04_agents.md](../learning/04_agents.md) |
| 05 | `05_learning_folder` | Move learning docs to `document/learning/NN_name.md` | Done | [05_learning_folder.md](../learning/05_learning_folder.md) |
| 06 | `06_compound_engineering` | Install the Compound Engineering plugin and fit its plan, work, review, compound loop into our workflow | Done | [06_compound_engineering.md](../learning/06_compound_engineering.md) |

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
- [x] Review with `code-reviewer` and fix what it found
- [x] Merge into `main`

### 05_learning_folder

- [x] Create branch `05_learning_folder`
- [x] Move each learning doc to `document/learning/NN_name.md` with `git mv` (history kept)
- [x] Move `TEMPLATE.md` to `document/learning/`
- [x] Update every link and path (readme, `CLAUDE.md`, this tracker, agents, skills doc)
- [x] Add a "moved" note to the older learning docs
- [x] Write the learning doc
- [x] Review with `code-reviewer` and fix what it finds
- [x] Merge into `main`

### 06_compound_engineering

- [x] Create branch `06_compound_engineering`
- [x] Review the plugin's files before installing (hooks, scripts, MCP servers, instructions)
- [x] Install it for this project so it's shared through git (pinned to v3.32.0)
- [x] Check the installed copy matches the reviewed code
- [x] Configure it: artifacts in `document/`, no other AI vendors, no automatic PR watching
- [x] Decide which steps use the plugin's commands and which use our agents; update `CLAUDE.md` and the agents
- [x] Run `ce-compound` once for real: first lesson in `document/solutions/`
- [x] Update `document/skills/skills.md` and `readme.md`
- [x] Write the learning doc
- [x] Review with `code-reviewer` and fix what it finds
- [x] Compound: decide whether the review taught a lesson worth saving (no new doc: the lesson went straight into `CLAUDE.md`)
- [x] Merge into `main`

No `ce-plan` plan for this task: the vetting and install (what a plan would cover) happened before the plugin was available here. From task 07 on, bigger tasks need a plan in `document/plans/`.

## Backlog (proposed)

These are suggestions for building the app. They depend on the product brief, so confirm or change them before starting.

| # | Task (= branch) | Goal | Status |
| --- | --- | --- | --- |
| 07 | `07_app_setup` | Create the React app (Next.js + TypeScript + Tailwind suggested) and run `shadcn init` | To do |
| 08 | `08_design_system` | Choose colors, fonts and spacing with UI/UX Pro Max and frontend-design; save them in `design-system/` | To do |
| 09 | `09_layout_shell` | Shared header, footer and navigation | To do |
| 10 | `10_home_page` | First page, with one GSAP entrance animation | To do |

## How to add a task

1. **Pick the next free number**: the highest number in the tables plus one, always two digits (`07`, not `7`).
2. **Name it** `NN_short_name`: lowercase, words joined with `_`, two to four words that say the outcome.
   Good: `03_skills_installation`, `12_booking_form`. Bad: `5-stuff`, `fix`, `Task_Twelve`.
3. **Add it here**: a row in the table (status `To do`) and a list of small steps under "Task steps".
4. **Create the branch** from an up-to-date `main` (replace `NN_short_name` with your task's name):
   ```bash
   git switch main
   git pull            # only if the repo has a remote you work with
   git switch -c NN_short_name
   ```
5. **Set the status to `In progress`** and do the work in small commits.
6. **Write the learning doc**: copy [TEMPLATE.md](../learning/TEMPLATE.md) to `document/learning/NN_short_name.md` and fill it in.
7. **Link the learning doc** in the table. Tick "Review" only after the review really happened.
8. **Merge into `main`** (or open a pull request):
   ```bash
   git switch main
   git merge --no-ff NN_short_name
   ```
9. **Mark it done** in one bookkeeping commit on `main`: tick "Merge into `main`", set the status to `Done` here and in the learning doc's header, then `git commit -m "docs(NN): mark task NN done"`. A step can't honestly be ticked before it happens, which is why this comes after the merge.
