---
title: "npm run check fails only by timeouts when several sessions share the laptop: tell load from breakage, then wait for the load to drop"
date: 2026-10-29
category: workflow-issues
module: npm run check (Vitest)
problem_type: workflow_issue
component: development_workflow
severity: medium
applies_when:
  - Several Claude sessions work on one laptop at once, each running npm run check, builds or Playwright
  - The full npm run check fails, but only with "Hook timed out" or "Test timed out" lines
  - A file fails as a whole and its tests show as skipped
  - You are about to re-run the check after merging main into a task branch
symptoms:
  - "Error: Hook timed out in 60000ms in the PGlite database test files (src/server/)"
  - "Test timed out in 5000ms in jsdom component tests (*.test.tsx)"
  - "src/i18n/lint-guards.test.ts \"rejects next/link\" takes 30-46 s, past its 30-second limit"
  - "Test Files  8 failed | 72 passed, Tests  1 failed | 1160 passed | 116 skipped"
  - "uptime shows load averages of 20 to 44"
related_components: [testing_framework]
tags: [vitest, timeouts, load-average, parallel-sessions, pglite, eslint, npm-run-check, background-watcher]
---

# npm run check fails only by timeouts when several sessions share the laptop

## Context

During task 16 (2026-10-28 and 29), three Claude sessions worked at once on one laptop. Each had its own folder, all sharing one git repository, and each ran `npm run check`, builds and Playwright. Other things were busy too: Docker Desktop at about 90% CPU, the editor's TypeScript server, and macOS's `ANECompilerService`. The load average reached 20 to 44.

Under that load, the full `npm run check` failed in ways that looked like broken code:

- **The database test files.** Each one opens and migrates an in-memory PGlite in `beforeAll`, with `vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 })` (10 files in `src/server/` today). When they all start at once on a busy machine, setup takes longer than 60 seconds: `Error: Hook timed out in 60000ms`. Task 22's merge added more of these files, so more of them start together.
- **jsdom component tests** (`*.test.tsx`) hit Vitest's default 5-second limit: `Test timed out in 5000ms`.
- **`src/i18n/lint-guards.test.ts`** runs ESLint for real (`new ESLint(...)`), inside a `describe` with `{ timeout: 30_000 }`. Its "rejects next/link" case took 30 to 46 seconds.

One run reported:

```text
 Test Files  8 failed | 72 passed (80)
      Tests  1 failed | 1160 passed | 116 skipped (1277)
```

The 116 skipped tests are not skipped on purpose. They belong to files whose `beforeAll` timed out, so Vitest never ran them.

## Guidance

### 1. Tell a load failure from a real one

Do all three checks before you change any code.

1. **Read what kind of failure it is.** A load failure shows only `Hook timed out` or `Test timed out` lines, and whole files failing (with their tests skipped). No `expected ... to be ...`, no `AssertionError`, no stack trace into our code.
2. **Run the failing part alone.** Fewer files run at once, so each gets more CPU:

   ```bash
   fnm exec --using=24 -- npx vitest run src/server                      # task 16: 19 files, 259 tests, passed at load 28
   fnm exec --using=24 -- npx vitest run src/i18n/lint-guards.test.ts    # task 16: 47 of 47 passed
   ```

3. **Check the load.**

   ```bash
   uptime    # "load averages: 8.86 13.23 17.60" = the last 1, 5 and 15 minutes
   ```

   The load average is roughly how many processes want the CPU at once. Well above the laptop's core count (`sysctl -n hw.ncpu`) means tests wait their turn and time out.

**A real failure** shows an assertion message, or fails again when run alone at low load. Fix that one like any other bug.

### 2. Wait for the load to drop, in the background

Don't re-run the full check straight away: it fails the same way. Start a watcher with the Bash tool's `run_in_background: true`. It checks the 1-minute load every 30 seconds and exits when it's below 10, or after 45 minutes. You are notified when it exits, so keep working on code meanwhile.

```bash
end=$(( $(date +%s) + 45 * 60 ))
until sysctl -n vm.loadavg | awk '{ exit !($2 < 10) }'; do
  if [ "$(date +%s)" -ge "$end" ]; then
    echo "still busy after 45 minutes: $(sysctl -n vm.loadavg)"; exit 0
  fi
  sleep 30
done
echo "load is down: $(sysctl -n vm.loadavg)"
```

On macOS, `sysctl -n vm.loadavg` prints `{ 8.86 13.23 17.60 }`, so the 1-minute load is the second field (`$2`); the `{` is the first. The Bash tool blocks a foreground `sleep`, but a background loop may use it. This loop was written for this doc from the task-16 description (poll every 30 s, below 10, give up after 45 minutes) and was not run while writing it; print `sysctl -n vm.loadavg` once first to check the field. Task 16's own watcher waited for a load below 15, and the next full run passed. The final passing run (80 files, 1277 tests) was at a load near 8.

If it gives up after 45 minutes, look at what is using the CPU (`top -o cpu`) before trying again. Never stop another session's processes.

### 3. Re-run the full check, and keep the gate

- **After a merge of `main`, run `npm install` first** (the owner's rule in task 16): the merge may have changed `package.json` or `package-lock.json`.
- Then run the full check: `fnm exec --using=24 -- npm run check`.
- **Commits stay gated on a full passing check.** A passing `npx vitest run src/server` is a diagnosis, not the gate.
- **Never raise a timeout or skip a test to get past load.** A longer timeout hides a real slowdown later, and a skip hides a real failure. The timeouts in the repo were set for a normal machine.

## Why This Matters

Without these checks, a load failure looks like the last change broke the database tests or the lint guards. Then you either debug code that is fine, or "fix" it with bigger timeouts and skips, which weakens the check for every later task. In task 16 the same code failed at a load of 15 to 40 and passed at 8, with no change in between.

## When to Apply

- Any time more than one session (or Docker, or a big build) is busy on the laptop and `npm run check` fails.
- Before every full re-run after a merge of `main`.
- The same reading applies to `npm run test:e2e` and `npm run test:design`: Playwright timeouts under load look like broken pages. Run the failing spec alone at low load before believing it.

## Related

- `document/learning/16_roles_access.md`, step 11 ("Working next to two other sessions") and "Check that it works": the two failed runs and the passing one.
- `document/solutions/workflow-issues/ce-plan-child-session-hangs-use-idle-watcher.md`: another background watcher, and "Several sessions on one machine".
- `CLAUDE.md`, "Database": why PGlite tests use `vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 })`.
