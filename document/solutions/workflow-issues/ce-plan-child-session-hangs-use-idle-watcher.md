---
title: "ce-plan run as a claude -p child session writes the plan, then never exits: watch the plan file, not the process"
date: 2026-10-26
last_updated: 2026-10-29
category: workflow-issues
module: ce-plan child session (claude -p)
problem_type: workflow_issue
component: development_workflow
severity: medium
applies_when:
  - The main session runs ce-plan as a child process with claude -p
  - Any task's Plan step (CLAUDE.md task workflow step 6) uses ce-plan
  - A background claude -p run has written its output file but has not exited
  - A claude -p child run of ce-plan, ce-code-review or ce-compound ended without writing what it was asked for
  - Several Claude sessions work on one machine, and each may start its own ce-plan
symptoms:
  - The plan file in document/plans/ is complete, but the claude -p process keeps running
  - "The -p output file stays empty (claude -p prints its result only when it exits)"
  - Task 10 sat for about 21 hours before anyone noticed
  - 'claude -p exits (exit 0) with no plan file, printing "Background tasks still running 10m after the last turn ...; stopping them."'
  - "A child run's whole output is \"You've hit your session limit · resets <time>\""
resolution_type: workflow_improvement
retire_when: "A compound-engineering release after v3.32.0 whose notes fix ce-plan or ce-doc-review never exiting under claude -p; check the plugin's release notes whenever the pin in .claude/settings.json is bumped"
tags: [ce-plan, claude-p, child-session, hang, background-process, watcher, ce-doc-review, compound-engineering, bg-wait-ceiling, parallel-sessions, session-limit, ce-code-review]
---

# ce-plan run as a claude -p child session writes the plan, then never exits

## Context

For the Plan step, the main session starts `ce-plan` as a child process in the background. The shape is below. The exact `--allowedTools` list wasn't saved in the repo:

```bash
CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0 GOMECHANIC_SEO_HOOK=off fnm exec --using=24 -- \
  claude -p "/compound-engineering:ce-plan confirm:auto Task NN_short_name <task brief>" \
  --allowedTools ...      # run with the Bash tool's run_in_background: true
```

Task 16 added two things to the command. `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0` keeps `claude -p` from stopping ce-plan's helpers early (see "Second failure" below). `Task NN_short_name` at the start of the prompt gives the watcher a phrase that matches only this run (see "Several sessions on one machine").

In all three tasks that did this, the child wrote a complete plan and then never exited:

- **Task 10 (2026-10-25):** it hung **before** the plugin's automatic document review started, and sat for about 21 hours (the computer also slept) until it was killed. The plan file was complete but never reviewed. See `document/learning/10_i18n_foundation.md`, step 1.
- **Task 11 (2026-10-26):** `document/plans/2026-10-26-1312-feat-design-system-plan.md` appeared about 15 minutes in. The review then edited it for a few more minutes (598 to 601 lines: `--input` became `#808085`, a font switch, more contrast pairs). After that the file stopped changing, but the process kept running. See `document/learning/11_design_system.md`, step 1.
- **Task 16 (2026-10-28):** the first run exited without writing a plan (the second failure, below). The second run, with the ceiling off, wrote `document/plans/2026-10-28-1836-feat-roles-access-plan.md`, then hung like the others. The watcher caught it after 10 idle minutes. Whether its document review finished is unknown. See `document/learning/16_roles_access.md`, step 1.

Waiting on the process doesn't help. `claude -p` prints only when it exits, so its output file stays empty and gives no sign of progress. **The root cause was not found** (see "Untested lead" below).

## Guidance

Expect the hang in every task. Watch the plan file, not the process.

1. **Before starting ce-plan,** mark the start time so the watcher can find the new plan (ce-plan picks the file name itself): `touch <scratchpad>/ce-plan-start`.
2. **Start ce-plan in the background** (command above, with the ceiling off and `Task NN_short_name` in the prompt). Never run it in the foreground, and never wait on it.
3. **Start the idle watcher right away,** also with `run_in_background: true`. It exits when ce-plan is gone, or when the new plan file hasn't changed for 10 minutes. Task 11's watcher used these same two exit conditions. Match a phrase only your run's prompt has, never the generic skill name:

   ```bash
   start=<scratchpad>/ce-plan-start
   while pgrep -f "ce-plan confirm:auto Task NN_short_name" >/dev/null; do
     plan=$(find document/plans -name '*.md' -newer "$start" | head -n 1)
     if [ -n "$plan" ] && [ $(( $(date +%s) - $(stat -f %m "$plan") )) -ge 600 ]; then
       echo "idle for 10 minutes: $plan"; exit 0
     fi
     sleep 30
   done
   echo "ce-plan exited on its own"
   ```

   Tested on 2026-10-26 in a scratch folder with a stand-in process named `compound-engineering:ce-plan` (`perl -e 'sleep 120' compound-engineering:ce-plan`; a `bash -c 'sleep …'` stand-in doesn't work, because bash replaces itself with `sleep` and drops the name). With no such process it prints "ce-plan exited on its own"; with a plan last changed 11 minutes ago it prints "idle for 10 minutes: …"; with a plan just changed it keeps waiting. macOS has no `timeout` command, so don't wrap it in one. Tasks 10 and 11 matched `compound-engineering:ce-plan`; task 16 matched `ce-plan confirm:auto Task 16_roles_access` (why: "Several sessions on one machine").

   `stat -f %m` (last change time, in seconds) is the macOS form; Linux uses `stat -c %Y`. The Bash tool blocks a foreground `sleep`, but a loop started with `run_in_background: true` may use it, and you are notified when it exits.

   **When it prints "ce-plan exited on its own",** check that a plan was written:

   ```bash
   find document/plans -name '*.md' -newer <scratchpad>/ce-plan-start
   ```

   No file means the run failed. Read its output for the reason (see "Second failure" and "A child run that hit the session limit" below).

   The watcher only times idleness once a plan file exists. With the ceiling off, a run that stalls *before* writing the plan keeps the watcher waiting. Task 11's plan appeared about 15 minutes in, so look at a run that has written nothing long after that.
4. **When the watcher reports idle,** list what will be stopped, then stop exactly those processes by their PIDs:

   ```bash
   pgrep -fl "ce-plan confirm:auto Task NN_short_name"   # expect the claude -p process and its fnm exec wrapper
   kill <pid> <pid>                                     # the PIDs pgrep just listed
   ```

   Never `pkill -f "compound-engineering:ce-plan"` (what tasks 10 and 11 used). `-f` matches the whole command line, so the generic name also stops any other session's ce-plan on the machine. Checked on 2026-10-26: `pgrep -f` started from the Bash tool doesn't match the Bash tool's own shell, in the foreground or the background.
5. **Use the plan as written.** If you read it before the review touched it, diff the two to see what the review changed (task 11: three changes, listed above).
6. **Say so in the learning doc.** Record whether the plugin's document review was skipped (task 10), only partly ran (task 11) or is unknown (task 16). Never write that the plan was reviewed when it wasn't (see `document/solutions/conventions/run-commands-before-documenting-output.md`).

## Second failure: claude -p exits without writing the plan

Task 16's first ce-plan run ended with exit code 0 and no new file in `document/plans/`. Its whole output was a few progress notes and this line:

```text
Background tasks still running 10m after the last turn (subagent "Flow and edge-case analysis"); stopping them. Set CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0 to wait indefinitely.
```

`claude -p` stops background subagents that are still running 10 minutes after its last turn. ce-plan runs its research and review helpers as background subagents, so they were stopped before ce-plan wrote the plan, and the run just ended.

What to do:

1. **Start the child with `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0`** (the command under "Context"). It then waits for its helpers however long they take. Task 16's second run did, and wrote the plan.
2. **Pass on what the failed run found.** Read its output and put any findings into the next run's prompt. Task 16's first run had already flagged three risks (a redirect loop with a leftover cookie, keeping the proxy away from form posts, checking the role before a transaction), and they went into the second run's brief.
3. **Keep the idle watcher.** The setting removes this early stop, not the hang: task 16's second run still hung after writing the plan.

The same setting is worth using for `ce-code-review` and `ce-compound` child runs, which also start helpers.

## Several sessions on one machine

This repo can have several Claude sessions working at once. During task 16 there were three, each in its own folder, all sharing one git repository. Each of them may start its own ce-plan, so:

- The watcher matches a phrase unique to your prompt (`pgrep -f "ce-plan confirm:auto Task 16_roles_access"`), not `pgrep -f "compound-engineering:ce-plan"`. On the generic name, it keeps waiting as long as *any* session's ce-plan runs.
- The stop command is `kill` on the PIDs that phrase matched (step 4), never `pkill -f` on the generic name, which would also stop another session's ce-plan.

Task 16 stopped only its own run's processes this way.

## A child run that hit the session limit

Task 16's first `ce-code-review` child run never reviewed anything. Its output was only `You've hit your session limit · resets <time>`. Before you read a child's report into anything (a learning doc, a list of fixes), check that it really is a report:

```bash
wc -c <output file>                    # a few dozen bytes is a message, not a report
head -n 20 <output file>
grep -i "session limit" <output file>
```

If it's the limit message, run it again after the time it names. Until then the review hasn't happened, so don't record it as done.

## Why This Matters

Without the watcher, the hang looks like a slow plan. Task 10 lost about 21 hours this way. With it, task 11 noticed the hang 10 minutes after the plan stopped changing. The plan is the useful output, and it's on disk long before the process would exit, if it ever does.

Task 16 showed the run can also fail the other way: it exits cleanly with nothing written, or with only a limit message. Checking for the plan file (or the report's size) as soon as it exits catches that at once, instead of when a later step needs the plan.

## When to Apply

- Every time the main session starts `ce-plan` with `claude -p`.
- Every `claude -p` child that runs a Compound Engineering skill: start it with `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0`, give its prompt a phrase unique to the task, and check its output before using it.
- Probably also for other Compound Engineering skills run as `claude -p` children that end with a document review or a "what next?" menu. That's untested: start the same watcher on their output file.

## Untested lead

`ce-plan`'s `SKILL.md` (line 60) and `references/plan-handoff.md` (lines 66–77) say an interactive run ends by asking "Plan ready at `<path>`. What would you like to do next?" and **waits** ("There is no 'done' / 'pause' option — the blocking question already waits"). `confirm:auto` only skips the earlier scoping question (both plans say "Scoping confirmation was skipped (`confirm:auto`)"). If ce-plan treats a `claude -p` run as interactive, it may sit at that last question forever. That would explain task 11 (it hung after the review edits) but not task 10 (it hung before the review). Not tested. Test it in its own small task before changing the command.

## Related

- `document/learning/10_i18n_foundation.md`, step 1, and `document/learning/11_design_system.md`, step 1: the two hangs.
- `document/learning/16_roles_access.md`, step 1 (the run that wrote no plan, then the third hang) and "Checks and reviews" (the `ce-code-review` run stopped by the usage limit).
- `CLAUDE.md`, "SEO review > Child sessions": why the command starts with `GOMECHANIC_SEO_HOOK=off`.
- `document/learning/04_agents.md` and `06_compound_engineering.md`: earlier `claude -p` child sessions and what `--allowedTools` does.
