---
title: "Next.js 16: `next dev` is not one process. A slow 'use cache' read re-runs in a helper process, so per-process resources get opened twice"
date: 2026-10-28
category: conventions
module: src/server/db/index.ts
problem_type: convention
component: database
related_components: [development_workflow]
severity: high
applies_when:
  - Code under `next dev` opens something only one process may hold (a PGlite data folder, a lock file, a SQLite file, a port, a file watcher)
  - A singleton is kept on globalThis and you assume that makes it one per dev server
  - A 'use cache' function can take over 10 seconds (a cold first start, a busy machine, a slow first migration)
  - Deciding how a resource should fail when a second process asks for it
  - Upgrading Next.js (isNextHelperProcess depends on its internal helper entry script)
symptoms:
  - Two processes held .pglite/ at once under one `npm run dev` (task 14); two writers corrupt PGlite
  - With only a lock file, the helper hit the lock and threw, and the real page request failed with a 500 "deadlock" error
root_cause: concurrency
resolution_type: code_fix
retire_when: "Next.js stops re-running slow 'use cache' fills in a jest-worker child, or starts counting errors thrown inside the cached function as an inconclusive probe; check node_modules/next/dist/server/dev/use-cache-probe-pool.js and use-cache-probe-worker.js after every Next.js upgrade"
tags: [nextjs-16, use-cache, dev-server, use-cache-probe, jest-worker, pglite, file-lock, deadlock]
---

# Next.js 16: `next dev` is not one process

## Context

In task 14 the app got a local database: PGlite in the `.pglite/` folder under `npm run dev`. PGlite has one connection, and two processes opening the same folder corrupt it. `getDatabase()` in `src/server/db/index.ts` keeps one database per process on `globalThis`, so hot reloads reuse it. That looked like enough, because "the dev server is one process".

It isn't. Next.js 16.4.3 has a dev-only **use-cache probe**:

- When a `'use cache'` function sends nothing for `PROBE_THRESHOLD_MS = 10000` ms (`node_modules/next/dist/server/use-cache/use-cache-probe-scheduler.js:12`), the dev server re-runs the same function in a **helper process** to check whether it is deadlocked.
- The helper is a jest-worker child (`node_modules/next/dist/server/dev/use-cache-probe-pool.js:84`), so its entry script is `next/dist/compiled/jest-worker/processChild.js`. Its environment is a copy of the parent's (`env: { ...process.env, NODE_OPTIONS }`, line 104), so no environment variable marks it.
- The helper has its own memory. `globalThis.appDatabase` was empty there, so it opened `.pglite/` while `next-server` already had it open. A cold first start on a busy machine is enough to cross 10 seconds (migrating and seeding PGlite takes a few). The work session reproduced it.

## What didn't work: a lock file alone

`ce-code-review` suggested a lock file: the helper would fail on the lock, and the scheduler's comment says "Probe failures are inconclusive; fall back to the regular cache-fill timeout" (`use-cache-probe-scheduler.js:66`). The helper worker says the same thing (`node_modules/next/dist/server/dev/use-cache-probe-worker.js:133`: "Any error along the way ... collapses to 'the probe didn't complete in isolation'").

Both comments are wrong for an error thrown **inside** the cached function:

1. The error goes to React's `onError`, which is `handleError` in `node_modules/next/dist/server/use-cache/use-cache-wrapper.js:857`. It only pushes the error onto a list (line 866).
2. `collectResult` (line 704) reads the stream, catches its error into the same list (lines 719-725) and **resolves**.
3. The probe branch (lines 1574-1607) only waits for that result, so the wrapped function resolves, and the worker returns `true` (`use-cache-probe-worker.js:130-131`).
4. `true` means "completed in isolation", so the main process calls `onProbeCompleted` (`use-cache-probe-scheduler.js:62-63`), decides its own request is deadlocked and aborts it (`use-cache-wrapper.js:1063-1066`).

The work session tested this: the helper hit the lock, threw "already open", and the real page answered with a 500 "deadlock" error. Only errors that escape the run (the module can't be found, the arguments can't be decoded) reach the worker's `catch` and count as inconclusive.

## Guidance

**1. Helper processes never open the resource. Their read never finishes.** `src/server/db/index.ts`:

```ts
export function isNextHelperProcess(entryScript: string | undefined = process.argv[1]): boolean {
  return /[\\/]jest-worker[\\/]processChild\.js$/.test(entryScript ?? "");
}

function openForThisProcess(config: DatabaseConfig): Promise<Database> {
  if (config.driver === "pglite" && config.dataDir !== null && isNextHelperProcess()) {
    return new Promise<Database>(() => {});
  }
  return createDatabase(config);
}
```

A promise that never settles keeps the probe waiting until its own time limit (the `Promise.race` at `use-cache-wrapper.js:1596-1601`). That timeout error is thrown by Next.js's wrapper, outside the cached function, so it reaches the worker's `catch`: the probe counts as inconclusive, and the real request carries on in `next-server`, which holds the database. The hung helper goes away when the dev server tears its probe pool down, which it does whenever it clears its module caches (an edit, a route recompile; `use-cache-probe-worker.js:29-33`).

Only the local folder gets this treatment. A memory database or a real Postgres (`DATABASE_URL`) is safe to open in a helper.

**2. Keep a lock file for every other second process**, such as a second `npm run dev` in another terminal. `src/server/db/folder-lock.ts`:

- Create `.pglite.lock` with `fs.openSync(path, "wx")`: the operating system creates it only if it doesn't exist, so exactly one process wins.
- Write the process id and a random token into it.
- If the file exists: throw a clear "already open by process N" error while that process runs (`process.kill(pid, 0)`; `EPERM` counts as running). Take it over only when that process is gone. An unreadable lock counts as held.
- Release only a lock whose token is still yours, on `closeDatabase` and on process `exit`.

A known gap is in the backlog in `document/task/task.md`: two processes starting within milliseconds after a crash can both take over the same stale lock.

**3. Pick dev-only resources by build phase too, not `NODE_ENV` alone.** `next build --debug-prerender` builds with `NODE_ENV=development`, and the build renders pages in several worker processes at once. `next build` sets `NEXT_PHASE` to `phase-production-build` before it starts them (`node_modules/next/dist/build/index.js:1232`). So `chooseDatabase` in `src/server/db/index.ts` uses the folder only when `NODE_ENV === "development" && NEXT_PHASE !== PHASE_PRODUCTION_BUILD` (`PHASE_PRODUCTION_BUILD` from `next/constants`). Every other run gets a memory database.

## Why This Matters

The failure only shows up when a cached read is slow, so it hides on a fast, warm machine and appears on a cold start or a busy laptop. When it does, the result is either a corrupted local database (no guard) or a 500 on a page that would have loaded fine (a guard that throws). Trusting the comments in Next.js's own source would lead you straight to the second one.

## When to Apply

- Any new per-process resource used during `next dev` (later tasks: fake SMS or email providers that write to a file, anything with a lock or a single connection). Decide what it does in a helper process before it ships.
- Never make a guard *throw* inside a `'use cache'` function to stop a helper. Make the helper wait instead.
- After every Next.js upgrade, check that the probe still runs in `jest-worker/processChild.js` (`use-cache-probe-pool.js`) and that the `isNextHelperProcess` cases in `src/server/db/database.test.ts` still describe it. If Next.js starts the probe some other way, the lock still keeps the folder safe; only that one slow request would fail with a 500.

## Examples

Before (task 14's first version): `getDatabase()` opened the folder in whichever process called it first. A slow first request led to two processes in `.pglite/`.

After a lock alone: the helper threw on the lock, the probe reported "completed", and the page failed with a 500 "deadlock" error.

After both guards (task 14's final version, on branch `14_database_setup`, not yet merged when this was written): the helper's `getDatabase()` never settles, the probe times out as inconclusive, the page loads from `next-server`'s database, and a second `npm run dev` gets "The local database (...) is already open by process N".

## Related

- `document/learning/14_database_setup.md`: the task 14 learning doc (the review finding and the 500).
- `document/solutions/conventions/nextjs-16-read-bundled-docs-image-priority.md`: read Next.js 16's own docs and source before trusting memory. Here the source's comments were wrong too, so read the code path itself.
- `CLAUDE.md`, "Database": the two guards and the "never two processes on `.pglite/`" rule.
