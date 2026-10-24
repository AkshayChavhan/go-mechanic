# 05_learning_folder: Move the learning docs to document/learning/

> **Branch:** `05_learning_folder` · **Date:** 2026-10-24 · **Status:** Done

## In one minute

The owner asked for learning docs in `document/learning/`, one file per task named after the task, like `document/learning/01_installation.md`. Claude had put them somewhere else instead (`document/task/<task>/README.md`). This task moved all of them, plus the template, to the requested place, and updated every link, rule and agent that pointed at the old place.

## Why: the problem we solved

- **It's what was asked.** The original instruction named a learning folder. Claude invented its own layout without saying so, which is a mistake: when someone gives you an exact path, use it, or ask before changing it.
- **One flat folder is easier to browse.** All lessons sit side by side, in order: `01_project_setup.md`, `02_claude_guidelines.md`, ... You don't have to open a folder per task to find a single `README.md`.
- **Tracking and learning are separate jobs.** `document/task/task.md` says *what* is being done and its status. `document/learning/` explains *why and how*. Different files for different jobs.

## What: what changed

| File or folder | Change | Why it exists |
| --- | --- | --- |
| `document/learning/01_project_setup.md` ... `04_agents.md` | Moved (from `document/task/<task>/README.md`) | One learning doc per task, named after the task |
| `document/learning/TEMPLATE.md` | Moved (from `document/task/TEMPLATE.md`) | The template sits next to the docs made from it |
| `document/learning/05_learning_folder.md` | Added | This doc |
| `document/task/task.md` | Changed | New links; tasks 05 and 06 added; backlog renumbered to 07 to 10 |
| `CLAUDE.md`, `readme.md` | Changed | Repo map and workflow point at `document/learning/` |
| `.claude/agents/learning-doc-writer.md`, `code-reviewer.md` | Changed | They now write to and check `document/learning/NN_name.md` |
| `document/skills/skills.md` | Changed | Its link to the 03 learning doc |
| Learning docs 01 to 04 | Changed | A "Moved" note at the top, and one fixed link in 03 |

## How: step by step

1. **Branch from `main`.**
   ```bash
   git switch main
   git switch -c 05_learning_folder
   ```

2. **Find everything that mentions the old place** before moving anything, so nothing gets missed:
   ```bash
   grep -rn "document/task/\|README.md\|TEMPLATE" --include='*.md' .
   ```
   `-r` searches folders recursively, `-n` shows line numbers, `--include='*.md'` limits the search to Markdown files. We ignored the hits inside `.claude/skills/` (third-party files) and `node_modules/`.

3. **Move the files with `git mv`.**
   ```bash
   mkdir -p document/learning
   for t in 01_project_setup 02_claude_guidelines 03_skills_installation 04_agents; do
     git mv document/task/$t/README.md document/learning/$t.md
   done
   git mv document/task/TEMPLATE.md document/learning/TEMPLATE.md
   ```
   - `mkdir -p` creates the folder, with no error if it already exists.
   - The `for` loop runs the same command once for each task name, with `$t` replaced each time.
   - `git mv` moves the file **and** tells git about the move in one step. `git status` then shows `R` (renamed) instead of "deleted" plus "new file".

   Then `rmdir` removed the now-empty task folders. (Git doesn't track empty folders, but they'd still sit on your disk.)

4. **Commit the move on its own, with no content changes.**
   ```bash
   git commit -m "docs: move learning docs to document/learning/NN_name.md"
   ```
   Git doesn't store "renames". It spots them by comparing content: a deleted file and a new file with (nearly) the same text count as a move. A commit that only moves files gives git a 100% match, so the history connects cleanly.

5. **Update every reference**, in a second commit: links in `readme.md`, `CLAUDE.md`, `task.md` and `skills.md`, the paths the agents use, and the template's instructions. The links also had to change shape. From `document/task/task.md`, the 01 doc used to be `01_project_setup/README.md`. Now it's `../learning/01_project_setup.md`: `..` means "go up one folder" (to `document/`), then into `learning/`.

6. **Leave the old docs' history alone, but explain it.** Docs 01 to 04 mention old paths in their "What" tables, for example `document/task/TEMPLATE.md | Added`. That's what those tasks really did, so we didn't rewrite it. Each one got a note at the top instead:
   > **Moved:** this doc used to live at `document/task/01_project_setup/README.md`. Task `05_learning_folder` moved it here. ...

7. **Check every link**, write this doc, review, merge (see below).

## Decisions worth knowing

- **Task names stayed the same.** The owner's example was `01_installation.md`. We read that as the *pattern* (`NN_name.md`) and kept the existing name `01_project_setup`, because renaming would also mean renaming a branch that's already pushed to GitHub. If the exact name `01_installation` is wanted, that's a small follow-up task.
- **Old paths inside old docs stay** (with a note), instead of rewriting history to look like it was always this way.

## New ideas in this task

- **`git mv`:** moves or renames a file and stages the change. Same result as moving it yourself and running `git add` on both paths.
- **Rename detection:** git notices that a "deleted" file and a "new" file have the same content, and shows it as a rename (`R`). Changing content in the same commit makes the match weaker. That's why the move got its own commit.
- **`git log --follow`:** shows a file's history *through* renames. Without `--follow`, history stops at the move.
- **Relative link:** a link written from where the current file sits. `../` goes up one folder. If the file moves, its relative links can break, so check them.

## Check that it works

```bash
ls document/learning
# 01_project_setup.md  02_claude_guidelines.md  03_skills_installation.md  04_agents.md  05_learning_folder.md  TEMPLATE.md

git log --follow --oneline document/learning/01_project_setup.md
# lists commits from task 01 onward, including the move

git log --oneline document/learning/01_project_setup.md
# without --follow: only the two commits since the move
```

We also ran a small script that opened every Markdown file (outside `.claude/skills/`) and checked that each relative link points at a file that exists. Result: all links work.

## Common mistakes

- **Moving files in Finder or with plain `mv`, then forgetting `git add` on the old path.** Git sees a new file but never records the old one as gone. `git mv` does both.
- **Moving and editing in one commit.** The rename can show up as "delete + add", and `git log --follow` may lose the trail.
- **Only fixing the links you remember.** Search first (step 2), then fix, then search again to confirm nothing is left.
- **Forgetting the tools.** Our agents had the old path written into their instructions. Without updating them, the next learning doc would have gone to the old place.

## Try it yourself

1. Run `git log --follow --stat document/learning/02_claude_guidelines.md` and find the commit where the file moved. What does `--stat` show for it?
2. In a practice branch, rename a file with plain `mv` and run `git status`. Then undo it and do the same with `git mv`. Compare the two outputs.

## Learn more

- [git mv documentation](https://git-scm.com/docs/git-mv)
- [git log --follow](https://git-scm.com/docs/git-log#Documentation/git-log.txt---follow)
- [Pro Git: Recording changes (moving files)](https://git-scm.com/book/en/v2/Git-Basics-Recording-Changes-to-the-Repository#_git_mv)
