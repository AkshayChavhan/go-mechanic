# 01_project_setup: Lay the foundation of the repo

> **Branch:** `01_project_setup` · **Date:** 2026-10-24 · **Status:** Done
>
> **Moved:** this doc used to live at `document/task/01_project_setup/README.md`. Task `05_learning_folder` moved it here. Paths under `document/task/` (other than `task.md`) and backlog task numbers below describe the repo as it was when this task was done.

## In one minute

The repo started empty: one blank `readme.md` and no commits. This task gave it a front page (`readme.md`), a list of files git must ignore (`.gitignore`), a task tracker (`document/task/task.md`) and a template for learning docs. Every later task builds on these four files.

## Why: the problem we solved

Without a foundation, a project drifts:

- **No readme**: a new person (or you, in three months) opens the repo and has no idea what it is or where to start.
- **No `.gitignore`**: sooner or later someone commits `node_modules/` (hundreds of MB) or a `.env` file with a password in it. A secret pushed to GitHub has to be treated as leaked, even if you delete it later, because it stays in the git history.
- **No task list**: work happens in big, mixed-up chunks that are hard to review and hard to undo.
- **No doc template**: every learning doc looks different, and key parts (like "how do I check it works?") get skipped.

## What: what changed

| File or folder | Change | Why it exists |
| --- | --- | --- |
| `readme.md` | Filled in (was empty) | Front page of the repo: what it is, how we work, where things live |
| `.gitignore` | Added | Tells git which files to never track |
| `document/task/task.md` | Added | The one list of every task, its branch, status and steps |
| `document/task/TEMPLATE.md` | Added | The shape every learning doc follows |
| `document/task/01_project_setup/README.md` | Added | This doc |

## How: step by step

1. **Make the first commit on `main`.**
   ```bash
   git add readme.md
   git commit -m "chore: initial commit"
   ```
   A brand-new repo has no commits. A branch is just a name that points at a commit, so with zero commits there is nothing for a branch to point at, and `git switch -c` fails. One small commit on `main` fixes that. We committed the blank `readme.md` exactly as it was, so `main` starts from the real starting point.

2. **Create the task branch.**
   ```bash
   git switch -c 01_project_setup
   ```
   `switch` moves you to a branch; `-c` means "create it first". The new branch starts from the commit you're on (the initial commit). From here on, commits land on `01_project_setup` and `main` stays untouched until we merge.

3. **Write `readme.md`.** It answers three questions: what is this, how do we work, where are things. It stays short on purpose; details live in `document/`.

4. **Add `.gitignore`.** Each line is a pattern. Some examples from our file:
   - `node_modules/`: the folder `npm install` creates. It can be rebuilt any time from `package.json`, so we never commit it.
   - `.env` and `.env.*`: files that hold secrets such as API keys.
   - `!.env.example`: the `!` means "but do track this one". An example file with fake values shows teammates which settings they need.
   - `.DS_Store`: clutter macOS drops into folders.

5. **Create the task tracker** (`document/task/task.md`). It lists all planned tasks, splits each one into small steps with checkboxes, and explains how to add a new task. We also added a **backlog** of proposed app tasks (05 to 08) so the next steps are visible.

6. **Create the learning-doc template** (`document/task/TEMPLATE.md`) with fixed sections: In one minute, Why, What, How, New ideas, Check that it works, Common mistakes, Try it yourself, Learn more.

7. **Commit and merge.**
   ```bash
   git add .
   git commit -m "docs: add readme, gitignore, task tracker and learning-doc template"
   git switch main
   git merge --no-ff 01_project_setup -m "Merge branch '01_project_setup'"
   ```
   `--no-ff` means "no fast-forward". Without it, git may just slide `main` forward to the branch's last commit, and the history no longer shows that these commits belonged to one task. With it, git always records a **merge commit**, so the history reads "task 01 happened here".

## New ideas in this task

- **Repository (repo):** the project folder plus its full history, stored in the hidden `.git/` folder.
- **Commit:** a saved snapshot of your files with a message saying what changed. Think of it as a save point in a game.
- **Branch:** a movable label that points at a commit. Working on a branch lets you change things without touching `main`.
- **`main`:** the default branch. We keep it clean: work happens on task branches and only finished work is merged in.
- **Merge:** bringing the commits of one branch into another.
- **Conventional Commits:** a message style where a short type comes first: `feat:` (new feature), `fix:` (bug fix), `docs:` (documentation), `chore:` (housekeeping). It makes the history easy to scan.

## Check that it works

```bash
git log --oneline --graph --all     # draw the history: you should see the merge of 01_project_setup into main
git branch                          # list branches: main and 01_project_setup
git check-ignore .env               # prints ".env": the file is ignored
git check-ignore .env.example       # prints nothing: .env.example is NOT ignored
git check-ignore -v .env            # -v (verbose) also shows which .gitignore line matched
```

Careful with `-v`: it prints *every* matching line, including the `!` lines that un-ignore a file. `git check-ignore -v .env.example` prints `.gitignore:19:!.env.example`, which looks like "ignored" but means the opposite. Without `-v`, an un-ignored file prints nothing.

## Common mistakes

- **Working directly on `main`.** Run `git branch` before you start; the current branch has a `*` next to it.
- **Adding `.gitignore` after the damage is done.** `.gitignore` only affects files git isn't tracking yet. If a file is already committed, remove it from tracking with `git rm --cached <file>` and commit.
- **Readme case on macOS.** macOS treats `readme.md` and `README.md` as the same file name, but git and Linux don't. Rename with `git mv`, never in Finder, or you can end up with two copies on other machines.
- **Vague commit messages** like `update` or `stuff`. Say what changed: `docs: add task tracker`.

## Try it yourself

1. Create a practice branch: `git switch -c practice_gitignore`.
2. Create a file `secret.env` and run `git status`. Is it listed?
3. Create a file `notes.tmp`, then add the line `*.tmp` to `.gitignore`. Run `git status` again. What changed?
4. Throw the practice away: `git restore .gitignore`, `rm notes.tmp secret.env`, `git switch main`, `git branch -D practice_gitignore`.

## Learn more

- [Pro Git, chapter 3: Git Branching](https://git-scm.com/book/en/v2/Git-Branching-Branches-in-a-Nutshell): the clearest explanation of what branches are.
- [gitignore documentation](https://git-scm.com/docs/gitignore): every pattern rule, with examples.
- [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/): the commit-message style we use.
- [Make a README](https://www.makeareadme.com/): what a good readme contains.
