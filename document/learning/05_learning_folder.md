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
   `-r` searches folders recursively, `-n` shows line numbers, `--include='*.md'` limits the search to Markdown files. If anything shows up in third-party folders such as `.claude/skills/` or `node_modules/`, skip it: those aren't our files.

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

5. **Update every reference**, in two commits:
   - `docs: point links, rules and agents at document/learning/`: `readme.md`, `CLAUDE.md`, `skills.md`, the agents' paths and the template's instructions.
   - `docs: add tasks 05-06 to tracker, renumber backlog, update links`: `task.md`, its links together with the new rows.

   One honest slip: between those two commits, `task.md`'s links pointed at files that had already moved. Nobody used the repo in that moment, but it's better if every commit leaves the links working (see "Common mistakes").

   The links also had to change shape. From `document/task/task.md`, the 01 doc used to be `01_project_setup/README.md`. Now it's `../learning/01_project_setup.md`: `..` means "go up one folder" (to `document/`), then into `learning/`.

6. **Leave the old docs' history alone, but explain it.** Docs 01 to 04 mention old paths in their "What" tables, for example `document/task/TEMPLATE.md | Added`. That's what those tasks really did, so we didn't rewrite it. Each one got a note at the top instead:
   > **Moved:** this doc used to live at `document/task/01_project_setup/README.md`. Task `05_learning_folder` moved it here. ...

7. **Check every link** with a small script (see "Check that it works"), write this doc.

8. **Review.** The `code-reviewer` agent said **Needs changes**:
   - **must fix:** `document/skills/skills.md` still said "until task `05_app_setup` creates the app". Renumbering the backlog had made that name wrong. It now says "the app-setup task in the backlog", so it can't go stale again.
   - The `task-planner` agent still used `05_app_setup` as its naming example. Updated to match `CLAUDE.md`.
   - This doc said all references changed "in a second commit". It was really two commits, with broken links in between. Step 5 now says so.
   - The "Moved" note didn't cover `document/task/TEMPLATE.md` or old backlog numbers. Widened.
   - "Check that it works" described the `git log --follow` output instead of showing it. Now it shows the real output.

9. **Merge** with `git switch main && git merge --no-ff 05_learning_folder`.

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
```

Real output (newest first) when this doc was written:

```
82cf270 docs: point links, rules and agents at document/learning/
4c79ead docs: move learning docs to document/learning/NN_name.md
5ebfe5c chore: revert task 05 website plan
3b5f31e docs(05): fix review findings (ignore data/, offer banner task, mark defaults)
0b74212 docs(01): fix git check-ignore example in learning doc
07706a8 docs: add readme, gitignore, task tracker and learning-doc template
```

The history goes all the way back to task 01 (`07706a8`), through the move (`4c79ead`). Don't be confused by `3b5f31e` and `5ebfe5c`: they come from an **earlier task 05** (a website plan). The owner reverted it, which freed the number 05 for this task.

Without `--follow`, the same command shows only the commits since the move:

```
82cf270 docs: point links, rules and agents at document/learning/
4c79ead docs: move learning docs to document/learning/NN_name.md
```

We also ran a small script that opened every Markdown file (outside `.claude/skills/`) and checked that each relative link points at a file that exists. Result: all links work.

## Common mistakes

- **Moving files in Finder or with plain `mv`, then forgetting `git add` on the old path.** Git sees a new file but never records the old one as gone. `git mv` does both.
- **Moving and editing in one commit.** The rename can show up as "delete + add", and `git log --follow` may lose the trail.
- **Only fixing the links you remember.** Search first (step 2), then fix, then search again to confirm nothing is left.
- **Forgetting the tools.** Our agents had the old path written into their instructions. Without updating them, the next learning doc would have gone to the old place.
- **Leaving broken links between commits.** After a move, try to update every reference in the commit right after it, so no commit in the history has broken links. Here, `task.md` was fixed one commit later than the rest.
- **Renumbering without searching.** Changing task numbers (the backlog went from 05–08 to 07–10) breaks every mention of the old names. Search for the old names (`grep -rn "05_app_setup"`) after renumbering.

## Try it yourself

1. Run `git log --follow --stat document/learning/02_claude_guidelines.md` and find the commit where the file moved. What does `--stat` show for it?
2. In a practice branch, rename a file with plain `mv` and run `git status`. Then undo it and do the same with `git mv`. Compare the two outputs.

## Learn more

- [git mv documentation](https://git-scm.com/docs/git-mv)
- [git log --follow](https://git-scm.com/docs/git-log#Documentation/git-log.txt---follow)
- [Pro Git: Recording changes (moving files)](https://git-scm.com/book/en/v2/Git-Basics-Recording-Changes-to-the-Repository#_git_mv)
