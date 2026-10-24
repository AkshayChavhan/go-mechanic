---
title: Only show command output you actually ran and copied
date: 2026-10-24
category: conventions
module: document/learning
problem_type: convention
component: documentation
severity: medium
applies_when:
  - Writing or editing a learning doc in document/learning/
  - A doc shows what a command prints, or says what its output means
  - A doc says a step (review, test, merge) has already happened
  - Drafting a doc with the learning-doc-writer agent
tags: [learning-docs, command-output, verification, code-review, honesty]
---

# Only show command output you actually ran and copied

## Context

The same mistake reached a learning doc three times. Each time, the doc said what a command or step *should* produce, not what it really produced:

1. **Task 01** (commit `07706a8`) said `git check-ignore -v .env.example` prints nothing. It doesn't. `-v` also prints the negation rule that matched, so it prints `.gitignore:19:!.env.example` (line 19 of `.gitignore` is `!.env.example`). This was found after task 01 was merged, before the `code-reviewer` agent existed, and fixed in task 02 (commit `0b74212`). See `document/learning/02_claude_guidelines.md`, step 2 and "Common mistakes".
2. **Task 04** (commit `f237f4c`) said "we ran the new `code-reviewer` on this branch, fixed what it found" before the review had run. The `code-reviewer` agent caught it. Fixed in `36f0b30`; see `document/learning/04_agents.md`, step 6.
3. **Task 05** (commit `5e6ccf7`) described the `git log --follow` output instead of pasting it. The real output held two surprising commits (`3b5f31e`, `5ebfe5c`, from an earlier, reverted task 05) that the description hid. The `code-reviewer` agent caught it. Fixed in `2af0076`; see `document/learning/05_learning_folder.md`, "Check that it works".

`.claude/agents/learning-doc-writer.md` already has the rule ("Run every command you plan to show whose output you describe, and copy what it really prints"). Case 2 shows that rule alone isn't enough: the problem there was a workflow step, not a command.

## Guidance

- **Run it, then paste it.** Before a doc shows or describes what a command prints, run that command and copy the real output into a code block. Don't paraphrase it, and don't write output from memory or from the tool's docs.
- **Label output that can change.** Commit hashes, `git log`, file listings and version numbers drift. Put "Real output when this doc was written:" above the block.
- **Explain surprises, don't trim them.** If the real output holds something odd (an extra commit, a warning, a negation rule), keep it and explain it. That surprise is often the most useful part for a junior reader.
- **Never write a step before it happens.** The CLAUDE.md workflow writes the learning doc (step 8) *before* the review (step 9). So the doc's review step can't be finished when the doc is first drafted. Leave it out or mark it pending, and fill it in from the reviewer's real verdict after the review runs. The same goes for "merged", "tests pass" and ticked boxes in `task.md`.
- **If you can't run it, say so.** When a command can't be run (it changes state, needs a login, or needs approval), don't invent its output. Quote it from a source you name, or say the output wasn't captured.

## Why This Matters

The reader is a junior engineer who will type the command and compare. Wrong output teaches the wrong thing: in case 1, `.gitignore:19:!.env.example` looks like "ignored" but means "not ignored". A doc that claims a review happened also hides whether the work was really checked. Each slip cost a review round and a follow-up fix commit.

## When to Apply

- Any time a doc in `document/learning/` (or `readme.md`, `CLAUDE.md`, a plan) shows command output or says what it means.
- Any time a doc reports that a workflow step is done.
- When reviewing a learning doc: for each output block, ask "was this pasted from a real run?"

## Examples

Before (task 01, described from memory, and wrong):

```bash
git check-ignore -v .env.example    # prints nothing: .env.example is NOT ignored
```

After (now in `document/learning/01_project_setup.md`):

```bash
git check-ignore .env.example       # prints nothing: .env.example is NOT ignored
git check-ignore -v .env            # -v (verbose) also shows which .gitignore line matched
```

plus a note that `git check-ignore -v .env.example` prints `.gitignore:19:!.env.example`, which means the opposite of "ignored".

Before (task 04, step written ahead of time):

> Before merging we ran the new `code-reviewer` on this branch, fixed what it found, and merged with `--no-ff`.

After: the step shows the real `claude -p ... --agent code-reviewer` command, the verdict (**Needs changes**), and each finding with what was done about it.

## Related

- `.claude/agents/learning-doc-writer.md`: rule 4 (run every command you show) and the "Honest" rule.
- `document/learning/TEMPLATE.md`: the "Check that it works" section is where real output usually goes.
- `CLAUDE.md`, "Task workflow": steps 8 (learning doc) and 9 (review) are why the review section is written last.
