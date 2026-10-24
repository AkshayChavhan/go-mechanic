# 04_agents: Add helper agents for planning, UI, docs and review

> **Branch:** `04_agents` · **Date:** 2026-10-24 · **Status:** Done
>
> **Moved:** this doc used to live at `document/task/04_agents/README.md`. Task `05_learning_folder` moved it here. Paths under `document/task/` (other than `task.md`) and backlog task numbers below describe the repo as it was when this task was done.

## In one minute

We added four **subagents** in `.claude/agents/`: `task-planner`, `ui-engineer`, `learning-doc-writer` and `code-reviewer`. Each one is a specialist the main Claude session can hand a job to. Together they cover the whole task workflow: plan, build, explain, review.

## Why: the problem we solved

One Claude session doing everything has two problems:

1. **Its context fills up.** Reading a long diff for a review, or many files for a learning doc, uses space the main session needs for the actual task. A subagent does that reading in **its own context** and returns only a short summary.
2. **Its focus drifts.** A reviewer that can also edit files tends to "just fix it" instead of reporting the issue, so the author never learns why it was wrong. Giving each agent one job and only the tools that job needs keeps it on track.

A team works the same way: a planner, a builder, a technical writer and a reviewer, each with a clear role.

## What: what changed

| File or folder | Change | Why it exists |
| --- | --- | --- |
| `.claude/agents/task-planner.md` | Added | Splits big work into small numbered tasks in `task.md` |
| `.claude/agents/ui-engineer.md` | Added | Builds UI using the design, component and animation skills |
| `.claude/agents/learning-doc-writer.md` | Added | Drafts the Why / What / How doc for a finished task |
| `.claude/agents/code-reviewer.md` | Added | Read-only review of a branch before merge |
| `CLAUDE.md` | Changed | New "Agents" section; workflow and definition of done now use the agents |
| `readme.md` | Changed | Repo map lists `.claude/agents/` |
| `document/task/task.md` | Changed | Task 04 marked done |

## How: step by step

1. **Branch from `main`.**
   ```bash
   git switch main
   git switch -c 04_agents
   ```
   `-c` creates the new branch from whatever branch you're on, so switch to `main` first.

2. **Write one Markdown file per agent.** Each file has a **frontmatter** block (settings between `---` lines) followed by the agent's instructions:
   ```markdown
   ---
   name: code-reviewer
   description: Reviews a task branch before it is merged. ... Use when a task is ready to merge. Read-only; never changes files.
   tools: Read, Glob, Grep, Bash
   model: inherit
   color: orange
   ---

   You review task branches in the Go Mechanic repo before they're merged. ...
   ```
   What each field does:
   - `name`: how you and Claude refer to the agent.
   - `description`: **the most important line.** The main session reads it to decide when to hand off work, so it says *when* to use the agent, not only what it is.
   - `tools`: an allowlist. `code-reviewer` gets no `Edit` or `Write` tool. It still needs `Bash` to run `git diff` and tests, and **Bash can change files too** (`rm`, `sed -i`, `git commit`). So fewer tools means fewer ways to go wrong, not zero, and the "read-only" rule in its instructions still matters.
   - `model: inherit`: use the same model as the main session.
   - `color`: its label color in the Claude Code interface.
   - `skills` (in `ui-engineer` only): skills loaded into the agent from the start. `ui-engineer` always needs `frontend-design`, `ui-ux-pro-max`, `shadcn` and `gsap-react`, so it gets them up front instead of discovering them one at a time.

3. **Split responsibilities on purpose.**

   | Agent | Tools | Writes to |
   | --- | --- | --- |
   | `task-planner` | Read, Glob, Grep, Edit, Write, Bash | `document/task/task.md` only |
   | `ui-engineer` | all (no `tools` line) | app code |
   | `learning-doc-writer` | Read, Glob, Grep, Write, Edit, Bash | the learning doc only |
   | `code-reviewer` | Read, Glob, Grep, Bash | nothing |

   Claude Code enforces the **Tools** column. The **Writes to** column is enforced only by each agent's instructions. Any agent with `Write`, `Edit` or `Bash` *could* touch other files; its instructions tell it not to.

   None of them create branches, commit or merge. **Git stays with the main session**, so there's one place where the task workflow is enforced and history doesn't get tangled.

4. **Check that Claude Code loads them.** We asked a fresh one-shot session which agents it could see:
   ```bash
   claude -p "Without using any tools, list the names of the custom subagent types defined in this project's .claude/agents folder that appear in your Agent tool's list of available agent types. Reply with just the names, one per line." --model haiku --max-turns 1
   ```
   - `-p` ("print"): run one prompt without the interactive screen, print the answer, and exit.
   - `--model haiku`: use the small, fast model; this check doesn't need a big one.
   - `--max-turns 1`: stop after one reply, so it can't wander off and do other work.

   It answered `code-reviewer`, `learning-doc-writer`, `task-planner`, `ui-engineer`. All four loaded. (The simpler check is `/agents` in a new session; see "Check that it works".)

5. **Wire them into the rules.** `CLAUDE.md` now says: plan with `task-planner`, draft docs with `learning-doc-writer`, and run `code-reviewer` before every merge. The definition of done includes a "Ready to merge" review.

6. **Review this task with its own reviewer.** We ran the new agent on this branch:
   ```bash
   claude -p "Review the current branch (04_agents) against main, following your instructions. Also check that every relative Markdown link ... points at a file that exists." --agent code-reviewer --allowedTools "Read" "Glob" "Grep" "Bash(git *)" "Bash(ls *)" "Bash(grep *)" "Bash(cat *)" "Bash(head *)" "Bash(wc *)" "Bash(find *)" "Bash(test *)"
   ```
   `--agent code-reviewer` runs the whole session as that agent. `--allowedTools` pre-approves only read-only commands, because `-p` mode can't stop to ask permission.

   The verdict was **Needs changes**. What it caught, and what we did:
   - **This doc said the reviewer "can't" change files.** Wrong: it has Bash. Fixed in step 2 and the table note above.
   - **The `claude -p` command in step 4 was a placeholder** with unexplained flags. Replaced with the real command and a note on each flag.
   - **Step 1 left out `git switch main`.** Added.
   - **"Try it yourself" used `git restore .`**, which throws away *all* uncommitted changes. Narrowed to the two files the exercise touches.
   - **This step claimed the review had already happened** before it ran. Rewritten (this list) after the real review.
   - **The work went into one big `feat:` commit.** Fair point: small commits are a repo rule, and `chore`/`docs` fit tooling work better than `feat`. We left that commit alone (rewriting history to split it isn't worth it) and put the fixes in a separate `docs(04):` commit.
   - **It doubted that subagents can start their own subagents.** We checked the [subagents docs](https://code.claude.com/docs/en/sub-agents), which say: *"By default, a subagent can spawn subagents of its own, up to three layers below the main conversation."* The reviewer's knowledge was out of date, so that line stays, now with the source. **A reviewer can be wrong too. Check its claims the same way it checks yours.**

7. **Merge** with `git switch main && git merge --no-ff 04_agents`.

## Decisions worth knowing

- **Four agents, not more.** Each matches one step of the workflow. More agents means more descriptions for Claude to choose between, and more files to keep up to date. Add one when a job comes up again and again and doesn't fit an existing agent.
- **The `learning-doc-writer` must run commands before documenting their output.** That rule comes straight from the mistake fixed in task 02.
- **`ui-engineer` stops if there's no app yet.** Right now the repo has no `package.json`, so it would report that `05_app_setup` is needed instead of inventing an app.

## New ideas in this task

- **Agent vs subagent:** the Claude session you talk to is the main agent. A **subagent** is another Claude instance the main agent starts for one job. It gets its own instructions, its own tools and a fresh context, and it hands back a summary when it's done. In Claude Code, "custom agents" and "subagents" mean the same files in `.claude/agents/`.
- **Context isolation:** the subagent's reading and thinking stay in its own context. Only its final report comes back, which keeps the main session focused.
- **Least privilege:** give each part of a system only the permissions its job needs. Every tool you leave out is one less way for an agent to cause damage by accident.
- **Frontmatter:** a settings block at the top of a Markdown file, between two `---` lines, written in YAML (`key: value`).
- **Nested subagents:** a subagent can start subagents of its own, up to three levels below the main conversation ([docs](https://code.claude.com/docs/en/sub-agents)). We don't need that yet.

## Check that it works

1. Open a **new** Claude Code session in this repo. Agent files are read at startup, so a session that was already open won't see new or edited agents.
2. Type `/agents` to see the list. You should see the four project agents.
3. Ask: *"Use the code-reviewer agent to review the current branch."* You should get a verdict, then findings with file and line references.

## Common mistakes

- **A vague `description`** like "helps with code". Claude can't tell when to use it. Say *when*: "Use when a task branch is ready to merge."
- **Giving every agent every tool.** Leaving out `tools` gives the agent everything. Do that only when the job really needs it (like `ui-engineer`).
- **Thinking "no Write tool" means read-only.** `Bash` can write, delete and commit. If an agent must never change anything, leave out `Bash` too, or accept that its instructions are what keep it read-only.
- **Letting several agents commit.** Two agents committing on the same branch at the same time makes a mess. One owner for git.
- **Editing an agent file and testing in the old session.** Start a new session, or the old definition is still in use.

## Try it yourself

1. Start a new session and ask: *"Use task-planner to plan a contact page."* Check the result follows the rules: `NN_` number, row in `task.md`, a step list including the branch, learning doc and merge.
2. Open `.claude/agents/code-reviewer.md` and add one check you care about (for example, "every image has an `alt` attribute"). Start a new session and run the reviewer again.
3. To throw the experiments away, run `git status` first to see what changed, then restore only the exercise files: `git restore document/task/task.md .claude/agents/code-reviewer.md`. (`git restore .` would also wipe any other unsaved work.)

## Learn more

- [Claude Code subagents docs](https://code.claude.com/docs/en/sub-agents): every frontmatter field, and how delegation works.
- [Principle of least privilege](https://en.wikipedia.org/wiki/Principle_of_least_privilege): why fewer permissions mean fewer accidents.
