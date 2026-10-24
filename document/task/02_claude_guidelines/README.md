# 02_claude_guidelines: Write the rules Claude follows

> **Branch:** `02_claude_guidelines` · **Date:** 2026-10-24 · **Status:** Done

## In one minute

We added `CLAUDE.md` at the root of the repo. Claude Code reads it automatically at the start of every session, so it works like an onboarding sheet for a new teammate: what the project is, how we split work into tasks, how we name branches, how we write learning docs, and when Claude must ask before acting.

## Why: the problem we solved

Claude doesn't remember past conversations. Each session starts fresh. Without written rules you'd have to repeat "make small tasks, one branch per task, write a learning doc" every time, and some sessions would forget a step.

A human team has the same problem, and solves it the same way: write the team's working agreement down once, in a place everyone reads.

## What: what changed

| File or folder | Change | Why it exists |
| --- | --- | --- |
| `CLAUDE.md` | Added | Rules Claude reads every session |
| `readme.md` | Changed | Repo map now lists `CLAUDE.md` |
| `document/task/task.md` | Changed | Task 02 marked done |
| `document/task/01_project_setup/README.md` | Fixed | The `git check-ignore` example was wrong (see "Common mistakes") |
| `document/task/02_claude_guidelines/README.md` | Added | This doc |

## How: step by step

1. **Branch from `main`.**
   ```bash
   git switch main
   git switch -c 02_claude_guidelines
   ```

2. **Fix a mistake from task 01 first, in its own commit.** The 01 doc said `git check-ignore -v .env.example` prints nothing. It actually prints the `!.env.example` line (see "Common mistakes" below). The fix got its own commit, so the history shows it as a separate change:
   ```bash
   git commit -m "docs(01): fix git check-ignore example in learning doc"
   ```
   `(01)` is a **scope**: an optional label saying which part of the project the commit touches.

3. **Write `CLAUDE.md`.** It has six sections:
   - **The project**: what Go Mechanic is, its stage, and the fact that the owner is learning.
   - **Repo map**: where things live, so Claude doesn't have to search.
   - **Task workflow**: the eight steps every task follows (split, name, branch, track, commit, document, merge, one at a time).
   - **Learning docs**: who the reader is and what every doc must answer.
   - **Git rules**: commit style, no secrets, and the actions that need the user's OK first (push, PR, force, global installs).
   - **Definition of done**: a checklist. A task isn't finished until every box is true.

4. **Update the readme and tracker, write this doc, commit, merge.**
   ```bash
   git add .
   git commit -m "docs: add CLAUDE.md with project rules for Claude"
   git switch main
   git merge --no-ff 02_claude_guidelines
   ```

## New ideas in this task

- **`CLAUDE.md`:** a Markdown file Claude Code loads into its context (the text it can "see") at the start of a session. The project one lives in the repo root and is shared with everyone through git.
- **Other places Claude reads instructions from:** `~/.claude/CLAUDE.md` (your personal rules for every project) and `CLAUDE.local.md` (your personal rules for this project, not shared; we added it to `.gitignore`).
- **Context:** everything Claude can see while it works: your messages, files it has read, and files like `CLAUDE.md`. Context is limited, which is why `CLAUDE.md` should stay short and link to details instead of containing them.
- **Definition of done:** an agreed checklist that decides when work is finished. It stops "done" from meaning different things to different people.

## Check that it works

1. Open a **new** Claude Code session in this folder.
2. Ask: *"What's the workflow for a new task in this repo?"*
3. Claude should describe the steps from `CLAUDE.md` (number, branch, tracker, learning doc, merge) without you explaining them.

You can also run `/memory` in Claude Code to see which `CLAUDE.md` files are loaded.

## Common mistakes

- **Writing a huge `CLAUDE.md`.** Every line costs context in every session. Keep rules short and specific; put long explanations in `document/` and link to them.
- **Vague rules** like "write good code". Claude can't act on that. Prefer rules you could check: "Branch name = task name".
- **Rules that go stale.** When a task changes how the repo works, update `CLAUDE.md` in that same task. It's in the definition of done for this reason.
- **Trusting a command's output without running it.** The mistake fixed in step 2 came from writing down what a command *should* print instead of running it. In this repo, run commands before documenting their output.

## Try it yourself

1. In a new Claude Code session, ask Claude to "add a task for a contact page". Check it follows the rules: a `NN_` number, a new row in `task.md`, a step list, and a branch with the same name.
2. Read the "Definition of done" in `CLAUDE.md` and look at this task. Can you tick every box?

## Learn more

- [Claude Code memory docs](https://code.claude.com/docs/en/memory): every place Claude reads `CLAUDE.md` from, and how they combine.
- [Claude Code best practices](https://www.anthropic.com/engineering/claude-code-best-practices): tips on writing a useful `CLAUDE.md`.
