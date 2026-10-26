---
title: "ce-plan run as a claude -p child session writes the plan, then never exits: watch the plan file, not the process"
date: 2026-10-26
category: workflow-issues
module: ce-plan child session (claude -p)
problem_type: workflow_issue
component: development_workflow
severity: medium
applies_when:
  - The main session runs ce-plan as a child process with claude -p
  - Any task's Plan step (CLAUDE.md task workflow step 6) uses ce-plan
  - A background claude -p run has written its output file but has not exited
symptoms:
  - The plan file in document/plans/ is complete, but the claude -p process keeps running
  - "The -p output file stays empty (claude -p prints its result only when it exits)"
  - Task 10 sat for about 21 hours before anyone noticed
resolution_type: workflow_improvement
retire_when: "A compound-engineering release after v3.32.0 whose notes fix ce-plan or ce-doc-review never exiting under claude -p; check the plugin's release notes whenever the pin in .claude/settings.json is bumped"
tags: [ce-plan, claude-p, child-session, hang, background-process, watcher, ce-doc-review, compound-engineering]
---

# ce-plan run as a claude -p child session writes the plan, then never exits

## Context

For the Plan step, the main session starts `ce-plan` as a child process in the background. The shape is below. The exact `--allowedTools` list wasn't saved in the repo:

```bash
GOMECHANIC_SEO_HOOK=off fnm exec --using=24 -- \
  claude -p "/compound-engineering:ce-plan confirm:auto <task brief>" \
  --allowedTools ...      # run with the Bash tool's run_in_background: true
```

In both tasks that did this, the child wrote a complete plan and then never exited:

- **Task 10 (2026-10-25):** it hung **before** the plugin's automatic document review started, and sat for about 21 hours (the computer also slept) until it was killed. The plan file was complete but never reviewed. See `document/learning/10_i18n_foundation.md`, step 1.
- **Task 11 (2026-10-26):** `document/plans/2026-10-26-1312-feat-design-system-plan.md` appeared about 15 minutes in. The review then edited it for a few more minutes (598 to 601 lines: `--input` became `#808085`, a font switch, more contrast pairs). After that the file stopped changing, but the process kept running. See `document/learning/11_design_system.md`, step 1.

Waiting on the process doesn't help. `claude -p` prints only when it exits, so its output file stays empty and gives no sign of progress. **The root cause was not found** (see "Untested lead" below).

## Guidance

Expect the hang in every task. Watch the plan file, not the process.

1. **Before starting ce-plan,** mark the start time so the watcher can find the new plan (ce-plan picks the file name itself): `touch <scratchpad>/ce-plan-start`.
2. **Start ce-plan in the background** (command above). Never run it in the foreground, and never wait on it.
3. **Start the idle watcher right away,** also with `run_in_background: true`. It exits when ce-plan is gone, or when the new plan file hasn't changed for 10 minutes. Task 11's watcher used these same two exit conditions:

   ```bash
   start=<scratchpad>/ce-plan-start
   while pgrep -f "compound-engineering:ce-plan" >/dev/null; do
     plan=$(find document/plans -name '*.md' -newer "$start" | head -n 1)
     if [ -n "$plan" ] && [ $(( $(date +%s) - $(stat -f %m "$plan") )) -ge 600 ]; then
       echo "idle for 10 minutes: $plan"; exit 0
     fi
     sleep 30
   done
   echo "ce-plan exited on its own"
   ```

   Tested on 2026-10-26 in a scratch folder with a stand-in process named `compound-engineering:ce-plan` (`perl -e 'sleep 120' compound-engineering:ce-plan`; a `bash -c 'sleep …'` stand-in doesn't work, because bash replaces itself with `sleep` and drops the name). With no such process it prints "ce-plan exited on its own"; with a plan last changed 11 minutes ago it prints "idle for 10 minutes: …"; with a plan just changed it keeps waiting. macOS has no `timeout` command, so don't wrap it in one.

   `stat -f %m` (last change time, in seconds) is the macOS form; Linux uses `stat -c %Y`. The Bash tool blocks a foreground `sleep`, but a loop started with `run_in_background: true` may use it, and you are notified when it exits.
4. **When the watcher reports idle,** list what will be stopped, then stop it:

   ```bash
   pgrep -fl "compound-engineering:ce-plan"   # expect the claude -p process and its fnm exec wrapper
   pkill -f "compound-engineering:ce-plan"
   ```

   `-f` matches the whole command line, so this also stops any other ce-plan session on the machine (for example, one in another terminal). Check the `pgrep -fl` list first. Checked on 2026-10-26: `pgrep -f` started from the Bash tool doesn't match the Bash tool's own shell, in the foreground or the background.
5. **Use the plan as written.** If you read it before the review touched it, diff the two to see what the review changed (task 11: three changes, listed above).
6. **Say so in the learning doc.** Record whether the plugin's document review was skipped (task 10) or only partly ran (task 11). Never write that the plan was reviewed when it wasn't (see `document/solutions/conventions/run-commands-before-documenting-output.md`).

## Why This Matters

Without the watcher, the hang looks like a slow plan. Task 10 lost about 21 hours this way. With it, task 11 noticed the hang 10 minutes after the plan stopped changing. The plan is the useful output, and it's on disk long before the process would exit, if it ever does.

## When to Apply

- Every time the main session starts `ce-plan` with `claude -p`.
- Probably also for other Compound Engineering skills run as `claude -p` children that end with a document review or a "what next?" menu. That's untested: start the same watcher on their output file.

## Untested lead

`ce-plan`'s `SKILL.md` (line 60) and `references/plan-handoff.md` (lines 66–77) say an interactive run ends by asking "Plan ready at `<path>`. What would you like to do next?" and **waits** ("There is no 'done' / 'pause' option — the blocking question already waits"). `confirm:auto` only skips the earlier scoping question (both plans say "Scoping confirmation was skipped (`confirm:auto`)"). If ce-plan treats a `claude -p` run as interactive, it may sit at that last question forever. That would explain task 11 (it hung after the review edits) but not task 10 (it hung before the review). Not tested. Test it in its own small task before changing the command.

## Related

- `document/learning/10_i18n_foundation.md`, step 1, and `document/learning/11_design_system.md`, step 1: the two hangs.
- `CLAUDE.md`, "SEO review > Child sessions": why the command starts with `GOMECHANIC_SEO_HOOK=off`.
- `document/learning/04_agents.md` and `06_compound_engineering.md`: earlier `claude -p` child sessions and what `--allowedTools` does.
