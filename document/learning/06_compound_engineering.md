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

   | Default behaviour | Why it's a problem here | What we did |
   | --- | --- | --- |
   | Some skills commit, push and open pull requests without asking | Our rule: ask before any push or PR | `auto_babysit: false`, plus a "shipping process" rule in `CLAUDE.md` |
   | Reviews can send your diff to other AI companies (Codex, Grok, ...) | Our code would leave the machine without anyone asking | `cross_model_review_mode: off` |
   | `ce-compound`'s full mode reads recent session logs from your home folder, including other projects' | Privacy | Always run it with `depth:lightweight` |
   | `ce-work` can hand coding to other AI tools | Same as above | `work_engine_mode: off` |

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

3. **Check that what got installed is what was reviewed.** Claude Code keeps its copy in `~/.claude/plugins/`. The catalog copy was at commit `786ac01`, the same commit we reviewed. For the plugin files we compared a fingerprint (a hash of every file) of both copies. Both printed the same value, `4162611920063d83`, over 448 files.

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
   - `--allowedTools`: the one-shot session may read and write files and run Python (the plugin's checkers), and nothing else.

   It wrote `document/solutions/conventions/run-commands-before-documenting-output.md` and finished with `Documentation complete`. Two things stood out:
   - **It corrected us.** Our summary said the reviewer agent caught the task 01 mistake, but that agent didn't exist until task 04. The plugin checked the history and wrote the correct version.
   - **It found a gap in our workflow.** We write the learning doc *before* the review, so the doc's review step can't be finished when it's first written. We added that to `CLAUDE.md` straight away (step 9) and to the `code-reviewer` agent. That's the loop working: one lesson, applied to the next task.

   We read the whole file before committing it, because we hadn't written it ourselves.

7. **Review.** *(Filled in after the review, per the new lesson.)*

## Decisions worth knowing

- **No `ce-plan` plan for this task.** The new rule (a plan in `document/plans/` for anything bigger than one file) starts with the next task. This task started before the plugin was installed, so it couldn't use it.
- **Lightweight `ce-compound` only.** Full mode is better at spotting duplicate lessons, but it reads recent session logs from your home folder. We chose privacy over that. You can always run a full pass yourself, knowing what it reads.
- **No "deny" permission rules.** Claude Code can hard-block commands like `git push` in `.claude/settings.json`. We didn't add them, because permissions are the owner's decision. Right now the protection is `config.yaml` plus the rules in `CLAUDE.md`. Adding `"permissions": { "deny": ["Bash(git push:*)", "Bash(gh pr create:*)"] }` would make it a hard block, but then you'd have to push by hand even when you want Claude to.
- **We didn't run `/ce-setup`** (the interactive setup). We did its steps by hand (config, example file, gitignore, health check) so each one could be explained here.

## New ideas in this task

- **Plugin:** a package that can bundle skills, agents, commands and hooks, installed with `claude plugin`. Our earlier skills were single folders installed with `npx skills`.
- **Marketplace:** a catalog that lists plugins and where to download them.
- **Project scope:** a setting saved in the repo (`.claude/settings.json`), shared with everyone, as opposed to your personal user settings.
- **Pinning:** naming an exact version (here, a git tag) instead of "latest", so an update can't arrive without anyone reviewing it.
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
