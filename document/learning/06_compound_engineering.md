# 06_compound_engineering: Add the Compound Engineering plugin

> **Branch:** `06_compound_engineering` · **Date:** 2026-10-24 · **Status:** Done

## In one minute

We installed Every's open-source **Compound Engineering** plugin for this project and built its loop into our workflow: **plan → work → review → compound**. "Compound" means: when a task teaches us something, we save it as a short lesson in `document/solutions/`, and future sessions read it before similar work. We vetted the plugin first, switched off the defaults that break our rules (pushing code, sending code to other AI companies, reading other projects' session logs), and saved the first real lesson to prove it works.

## Why: the problem we solved

Look at the review findings so far. Task 01, task 04 and task 05 each made **the same mistake**: a doc said what a command "should" print, or claimed a step had happened, instead of showing what really happened. Each time we fixed it and moved on, and each time it came back. Lessons that only live in an old learning doc or in one conversation get lost.

Compound Engineering's answer is a habit plus tools:

- at the end of every task, ask "is there a lesson here that a future session would otherwise relearn the hard way?",
- if yes, save it in a fixed place, in a fixed format, where Claude looks before starting work.

Each task then makes the next one a bit easier, like interest that compounds.

## What: what changed

| File or folder | Change | Why it exists |
| --- | --- | --- |
| `.claude/settings.json` | Added | Installs the plugin for everyone who opens the repo, pinned to v3.32.0 |
| `.compound-engineering/config.yaml` | Added | Our plugin settings (what's switched off, where files go) |
| `.compound-engineering/config.example.yaml` | Added | The plugin's own list of every setting, with explanations |
| `.gitignore` | Changed | Ignores the plugin's personal settings and scratch folders |
| `CLAUDE.md` | Changed | Workflow is now plan → work → review → compound; who-does-what table; rules that override the plugin |
| `.claude/agents/*.md` | Changed | Each agent knows where it fits next to the plugin |
| `document/solutions/conventions/run-commands-before-documenting-output.md` | Added | The first lesson, written by the plugin |
| `document/skills/skills.md`, `readme.md` | Changed | Explain the plugin, its commands and its folders |
| `document/task/task.md` | Changed | Task 06 steps |

## How: step by step

1. **Vet before installing.** A plugin gives Claude new instructions and scripts, which run with Claude's permissions. A helper agent cloned the plugin at tag `compound-engineering-v3.32.0` into a scratch folder and read it without running anything: manifests, all 36 skills, every script. It looked for automatic hooks, background servers, network calls, secret reading and risky instructions. The verdict was **safe, with caveats**: no hidden code, but some default behaviours clash with our rules:

   | Default behaviour | Why it's a problem here | What protects us |
   | --- | --- | --- |
   | Some skills commit, push, open pull requests and watch them without asking | Our rule: ask before any push or PR | Mainly the "Our shipping process wins" rule in `CLAUDE.md`. `auto_babysit: false` only stops the PR watch that `ce-commit-push-pr` starts; it doesn't stop commits, pushes or PRs |
   | Reviews can send your diff to other AI companies (Codex, Grok, ...) | Our code would leave the machine without anyone asking | `cross_model_review_mode: off`. Without it, just running `ce-code-review` counts as permission to send |
   | `ce-compound`'s full mode reads recent session logs from your home folder, including other projects' | Privacy | Only ever run `ce-compound` as `mode:non-interactive depth:lightweight`. Plain `/ce-compound`, and other skills' calls to it, run full mode |
   | `ce-work` can hand coding to other AI tools | Same as above | Off by default already. `work_engine_mode: off` keeps that on record; `CLAUDE.md` forbids a request to do it unless you ask |

2. **Install it for the project, pinned to the reviewed version.**
   ```bash
   claude plugin marketplace add "EveryInc/compound-engineering-plugin#compound-engineering-v3.32.0" --scope project
   claude plugin install compound-engineering@compound-engineering-plugin --scope project
   ```
   - A **marketplace** is a catalog of plugins. This repo is both the catalog and the plugin.
   - `#compound-engineering-v3.32.0` pins the catalog to one release tag, so nobody silently gets a newer, unreviewed version.
   - `--scope project` writes the setting to `.claude/settings.json`, which is committed, so teammates get the same plugin. (The default, `user`, would install it only for you.)

   The result, in `.claude/settings.json`:
   ```json
   {
     "extraKnownMarketplaces": {
       "compound-engineering-plugin": {
         "source": { "source": "github", "repo": "EveryInc/compound-engineering-plugin", "ref": "compound-engineering-v3.32.0" }
       }
     },
     "enabledPlugins": { "compound-engineering@compound-engineering-plugin": true }
   }
   ```

3. **Check that what got installed is what was reviewed.** Claude Code keeps its copy in `~/.claude/plugins/`. The catalog copy was at commit `786ac01`, the same commit we reviewed (`~/.claude/plugins/installed_plugins.json` records it as `gitCommitSha`). Then we fingerprinted the files Claude Code actually loads, `skills/` (448 files) and `.claude-plugin/`, in both copies:
   ```bash
   cd <copy> && find skills .claude-plugin -type f -print0 | sort -z | xargs -0 shasum -a 256 | shasum -a 256 | cut -c1-16
   ```
   - `find ... -print0 | sort -z`: list every file in a fixed order (`-print0`/`-z` cope with odd file names).
   - `xargs -0 shasum -a 256`: one SHA-256 hash per file.
   - `| shasum -a 256`: hash that whole list, one fingerprint for the folder. Change one byte anywhere and it changes.

   Both copies printed `4162611920063d83`, so they're identical. Checking `skills/` is enough because this plugin has no hooks, background servers, agents or commands.

4. **Configure it** in `.compound-engineering/config.yaml`:
   ```yaml
   docs_root: document              # plans and lessons go in document/, next to our other docs
   cross_model_review_mode: off     # never send code to other AI vendors
   work_engine_mode: off            # never hand coding to other AI tools
   auto_babysit: false              # never start watching/pushing to pull requests
   ```
   We also copied the plugin's settings template to `config.example.yaml` (it explains every option), and added the plugin's personal and scratch paths to `.gitignore`. Then we ran the plugin's own health check, which reads settings and prints a report:
   ```bash
   bash ~/.claude/plugins/cache/compound-engineering-plugin/compound-engineering/3.32.0/skills/ce-setup/scripts/check-health --version 3.32.0
   ```
   The part about our project (real output):
   ```
    Project config
     🟢  No obsolete compound-engineering.local.md
     🟢  .compound-engineering/config.yaml exists
     ➖  No local override yet (.compound-engineering/config.local.yaml)
     🟢  CE scratch space is gitignored
     🟢  Artifact root: document/ (from config.yaml)
     🟢  CE Work implementation engine: native (standing preference is off)
     🟢  Example config is current
   ```
   It also listed optional tools we don't have (`agent-browser`, `ast-grep`, `ffmpeg`, and Node 22.13+ for cross-model features). We didn't install them: they're global installs, and we don't need them yet.

5. **Fit the loop into our workflow** (`CLAUDE.md`). Our task rules stay: one task, one branch, a learning doc for every task. The plugin adds steps inside each task:

   | Step | Tool |
   | --- | --- |
   | Split a request into numbered tasks | `task-planner` agent (unchanged) |
   | Read past lessons | `grep` in `document/solutions/` |
   | Plan one task | `ce-plan` → `document/plans/` |
   | Build | you, or `ce-work` |
   | Review | `ce-code-review` for code, then `code-reviewer` for repo rules |
   | Compound | `ce-compound mode:non-interactive depth:lightweight` → `document/solutions/` |
   | Teach the human | `learning-doc-writer` → `document/learning/` |

   We kept our four agents. Where the plugin overlaps (planning, review, lessons), `CLAUDE.md` names one owner for each job, so two tools never do the same thing.

6. **Run it once for real.** We asked the plugin to record the repeated mistake from "Why":
   ```bash
   claude -p '/compound-engineering:ce-compound mode:non-interactive depth:lightweight Lesson from this repo: ... (the three cases, with commit IDs) ...' \
     --allowedTools "Read" "Glob" "Grep" "Write" "Edit" "Bash(python3 *)" "Bash(ls *)" "Bash(git log *)" "Bash(git show *)" "Bash(mkdir *)" "Bash(cat *)"
   ```
   - `mode:non-interactive`: don't stop to ask questions.
   - `depth:lightweight`: one pass, no helper agents, no reading of old session logs.
   - `--allowedTools`: what the one-shot session may do without asking: read, search and write files, `git log`, `git show`, `ls`, `mkdir`, `cat`, and `python3` (for the plugin's checker scripts). **Careful:** `Bash(python3 *)` lets it run *any* Python code, which can do almost anything. It's the widest permission in the list. We accepted it because we'd read the plugin's scripts first.

   It wrote `document/solutions/conventions/run-commands-before-documenting-output.md` and finished with `Documentation complete`. Two things stood out:
   - **It corrected us.** Our summary said the reviewer agent caught the task 01 mistake, but that agent didn't exist until task 04. The plugin checked the history and wrote the correct version.
   - **It found a gap in our workflow.** We write the learning doc *before* the review, so the doc's review step can't be finished when it's first written. We added that to `CLAUDE.md` straight away (step 9) and to the `code-reviewer` agent. That's the loop working: one lesson, applied to the next task.

   We read the whole file before committing it, because we hadn't written it ourselves.

7. **Review.** *(Written after the review ran, following the new lesson.)* The `code-reviewer` agent said **Needs changes**. Most claims checked out: the config keys are real, the example config is byte-identical to the plugin's template, the installed commit matches, and every output in this doc matched a real run. What it caught:
   - **must fix: `ce-work` could have merged before the review.** `ce-work` hands off to "the project's documented shipping steps", and `CLAUDE.md` defined shipping as "commit, then merge into `main`". Read together, a `ce-work` run could skip the learning doc, review and compound steps. Now, for a Compound Engineering skill, shipping means "commit on the task branch and stop", and merging happens only at workflow step 11. It also noticed `ce-work` already runs `ce-code-review`, so step 9 no longer runs it twice.
   - **must fix: the privacy rule had a hole.** `depth:lightweight` only works together with `mode:non-interactive`. Plain `/ce-compound`, and the calls `lfg` or `ce-debug` make to it, still run full mode and scan old session logs. The rule now says "only ever run it as `mode:non-interactive depth:lightweight`, and decline when another skill offers to run it".
   - **must fix: two settings sounded stronger than they are.** `auto_babysit: false` only stops one PR watch; it doesn't stop pushes or PRs. `work_engine_mode: off` was already the default. The comments in `config.yaml` and the table in step 1 now say what each one really does, and that `CLAUDE.md`'s rules are the main protection.
   - **must fix: no rule for when to tick "Merge" and set `Done`.** Ticking them on the branch would claim the merge before it happens. New rule (workflow step 11, and `task.md` "How to add a task" step 9): merge, then one bookkeeping commit on `main` marks the task done.
   - **must fix: this doc's header said `Done`** before review and merge. Same mistake the new lesson warns about. Changed to "In progress" until the bookkeeping commit.
   - **Suggestions we took:** an honest reason for the missing plan (below); the real fingerprint command in step 3; the full list of allowed tools in step 6, with a warning about `python3`; recording the reviewed commit, because tags can move; adding the review and compound steps to `task-planner`'s default step list; and pasting the *whole* `git check-ignore -v` output line (it ends with a tab and the path) in the lesson and the 01 doc.

8. **Compound.** We asked the counterfactual question about the review findings. The main lesson, "a plugin's config switch isn't a hard block, so check what it really covers and put the real rule in `CLAUDE.md`", is now *in* `CLAUDE.md`, which every session reads. A separate solution doc would only repeat it, so we didn't write one.

9. **Merge**, then a `docs(06): mark task 06 done` commit on `main` (the new step 11).

## Decisions worth knowing

- **No `ce-plan` plan for this task.** The new rule (a plan in `document/plans/` for anything bigger than one file) starts with task 07. The parts a plan would have covered, vetting and installing, happened before the plugin was available here. A plan written afterwards would have been backdated, and dishonest. The exception is noted under task 06's steps in `task.md`.
- **Lightweight `ce-compound` only.** Full mode is better at spotting duplicate lessons, but it reads recent session logs from your home folder. We chose privacy over that. You can always run a full pass yourself, knowing what it reads.
- **No "deny" permission rules.** Claude Code can hard-block commands like `git push` in `.claude/settings.json`. We didn't add them, because permissions are the owner's decision. Right now the protection is `config.yaml` plus the rules in `CLAUDE.md`. Adding `"permissions": { "deny": ["Bash(git push:*)", "Bash(gh pr create:*)"] }` would make it a hard block, but then you'd have to push by hand even when you want Claude to.
- **We didn't run `/ce-setup`** (the interactive setup). We did its steps by hand (config, example file, gitignore, health check) so each one could be explained here.

## New ideas in this task

- **Plugin:** a package that can bundle skills, agents, commands and hooks, installed with `claude plugin`. Our earlier skills were single folders installed with `npx skills`.
- **Marketplace:** a catalog that lists plugins and where to download them.
- **Project scope:** a setting saved in the repo (`.claude/settings.json`), shared with everyone, as opposed to your personal user settings.
- **Pinning:** naming an exact version (here, a git tag) instead of "latest", so updates don't arrive by surprise. A tag is still only a name: its owner can move it to a different commit. That's why `CLAUDE.md` also records the reviewed commit (`786ac01...`) and says to check it.
- **Supply-chain risk:** the danger that something you install (a package, a plugin) is, or later becomes, harmful. Vetting and pinning are the defences.
- **Compounding:** saving what each piece of work teaches, so later work builds on it.
- **Solution doc:** a short, structured lesson (`document/solutions/`), written for future Claude sessions. A **learning doc** (`document/learning/`) teaches a person a whole task.
- **The counterfactual question:** "If this lesson weren't written down, would someone repeat the mistake?" If not, don't write it. This keeps the lessons folder small and useful.

## Check that it works

```bash
claude plugin list
```
Real output for this plugin when this doc was written:
```
  ❯ compound-engineering@compound-engineering-plugin
    Version: 3.32.0
    Scope: project
    Status: ✔ enabled
    Note: The packages it lists were not installed, because it needs bun, which is not installed on this computer
```
The note is about tools for *developing* the plugin itself (it uses Bun). The skills don't need them.

Then open a **new** Claude Code session in the repo and type `/compound-engineering:` to see the plugin's commands. Running `/compound-engineering:ce-setup` shows the same health report as step 4.

## Common mistakes

- **Installing a plugin without reading it.** Its skills tell Claude what to do, with your permissions. Read it, or have a helper read it, first.
- **Installing at user scope** in a shared project. Teammates won't get it, and their Claude behaves differently from yours.
- **Leaving the version unpinned.** The next update arrives without anyone reviewing it.
- **Keeping the defaults blindly.** Defaults suit the authors' team. Check them against your own rules (ours: no push or PR without asking).
- **Treating a setting as a lock.** `auto_babysit: false` sounds like "no PR automation", but it only stops one watcher. Read what a setting really covers (here, in the plugin's own files) before you rely on it, and write the real rule where the agent reads it (`CLAUDE.md`).
- **Writing a lesson for everything.** Only save what passes the counterfactual question. Otherwise nobody reads the folder.
- **Trusting generated docs unread.** The plugin wrote the first lesson; we read every line before committing.

## Try it yourself

1. Open `.compound-engineering/config.example.yaml` and find `plan_skip_scoping_confirm`. What does it change, and would you turn it on?
2. Start a session and run `/compound-engineering:ce-explain how does our task workflow use document/solutions/?` Compare its answer with `CLAUDE.md`.
3. Look at the frontmatter at the top of the first lesson (`title`, `category`, `applies_when`, `tags`). How would Claude use `applies_when` to decide whether to read it?

## Learn more

- [Compound Engineering on GitHub](https://github.com/EveryInc/compound-engineering-plugin): the plugin, its README and its guides.
- [Claude Code plugins](https://code.claude.com/docs/en/plugins): how plugins and marketplaces work.
- [Claude Code settings](https://code.claude.com/docs/en/settings): what `.claude/settings.json` can contain, including permissions.
