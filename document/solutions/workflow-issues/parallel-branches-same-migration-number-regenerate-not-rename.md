---
title: "Two branches generated the same Drizzle migration number: the second to merge deletes its own migration and generates it again, never renames it"
date: 2026-10-29
category: workflow-issues
module: src/server/db/migrations
problem_type: workflow_issue
component: database
related_components: [development_workflow]
severity: high
applies_when:
  - Two task branches (or parallel sessions) each ran npm run db:generate from the same latest snapshot, so both have a migration with the same number
  - "git merge origin/main reports add/add conflicts in src/server/db/migrations/meta/<NNNN>_snapshot.json and a conflict in meta/_journal.json"
  - Any task that adds or changes a table while another task branch with a migration is open
symptoms:
  - Two migrations with the same number (0002_slot_engine on main, 0002_vehicle_catalogue on the branch), both pointing back to the 0001 snapshot
  - The pull request shows conflicts; on GitHub it can't be merged
root_cause: missing_workflow_step
resolution_type: migration
tags: [drizzle, migrations, journal, parallel-sessions, merge-conflicts, pglite, db-reset, worktrees]
---

# Two branches generated the same Drizzle migration number: the second to merge deletes its own migration and generates it again, never renames it

## Context

Tasks 17 (vehicle catalogue) and 22 (slot engine) were built at the same time by two Claude sessions, each in its own git worktree. Both ran `npm run db:generate` from the same `0001` snapshot, so both made a `0002` migration. Task 22 merged first (pull request #17). Task 17's next `git merge origin/main` (on branch `17_vehicle_catalogue`, whose pull request was still to come) stopped on seven conflicts, among them an add/add conflict on `src/server/db/migrations/meta/0002_snapshot.json` and a conflict in `src/server/db/migrations/meta/_journal.json`.

The tempting fix is to keep `main`'s files and rename the branch's migration to `0003`. That fails silently on every database that already exists.

## Guidance

On the branch that merges second:

1. Merge `main`: `git fetch origin && git merge origin/main`.
2. Drop your own migration and take `main`'s migration metadata:
   ```bash
   git rm src/server/db/migrations/0002_vehicle_catalogue.sql
   git show origin/main:src/server/db/migrations/meta/0002_snapshot.json > src/server/db/migrations/meta/0002_snapshot.json
   git show origin/main:src/server/db/migrations/meta/_journal.json > src/server/db/migrations/meta/_journal.json
   ```
   After this, `src/server/db/migrations/` matches `main` exactly.
3. Resolve `schema.ts`, `seed.ts`, `index.ts` and the docs by keeping both sides (both sets of tables, all the seeds).
4. Generate your migration again with the same name: `npm run db:generate -- --name=vehicle_catalogue`. It comes out as `0003_vehicle_catalogue.sql`, its snapshot's `prevId` is `0002`'s `id`, and its journal `when` is later than `0002`'s. Check that its SQL is what you expect: `diff <(git show HEAD:src/server/db/migrations/0002_vehicle_catalogue.sql) src/server/db/migrations/0003_vehicle_catalogue.sql` printed nothing, since only the number changed.
5. Commit the new migration files in the merge commit, so the branch never holds tables without their migration.
6. Stop `npm run dev`, then run `npm run db:reset`. Your local `.pglite/` recorded your old migration with its later time, so the migrator would skip `main`'s migration there (see below).
7. Run `npm run check` and `npm run test:e2e` again on the merged code. On `main`, `src/server/db/database.test.ts` checks that migrations are numbered by place, that each snapshot chains to the one before it, and that every journal entry has a `.sql` file.

## Why This Matters

Drizzle's migrator (drizzle-orm 0.45.4) decides what to run by time, not by number or name:

- `node_modules/drizzle-orm/migrator.js:22` takes each migration's time from its journal entry: `folderMillis: journalEntry.when`.
- `node_modules/drizzle-orm/pg-core/dialect.js:57-62` reads the newest `created_at` the database recorded, then runs only migrations with `Number(lastDbMigration.created_at) < migration.folderMillis`.

So a renamed migration keeps its old `when`. Suppose task 17 had merged first and task 22 renamed its file to `0003_slot_engine` by hand. Its `when` (1793191618091) is older than `0002_vehicle_catalogue`'s (1793192341117). Every database that had already applied the catalogue migration would skip the slot tables forever, with no error. A hand-made rename also leaves the snapshot chain wrong, so the next `db:generate` would write SQL against the wrong starting point.

The test suites don't catch this. Builds, `npm run test:e2e` and Vitest all start a fresh in-memory PGlite and apply every migration. Only long-lived databases are hurt: each developer's `.pglite/` now, and staging and production Postgres from task 20 on.

## When to Apply

- Before generating a migration: `git fetch origin && git merge origin/main` first (the parallel-session rule), so you start from the newest snapshot.
- After your pull request is open: if another migration reaches `main` before yours merges, follow the steps above. Never edit or renumber a migration that is already on `main`.
- Whenever the local database refuses to start after a merge with a migration error ("type ... already exists"), or tables you expect are missing: stop the dev server and run `npm run db:reset`.

## Examples

After the fix, `src/server/db/migrations/meta/_journal.json` on the task 17 branch reads, in order: `0000_garage_settings` (1793121623499), `0001_auth_login` (1793173188994), `0002_slot_engine` (1793191618091), `0003_vehicle_catalogue` (1793252628437). The times only go up, and `src/server/db/migrations/meta/0003_snapshot.json`'s `prevId` is `0002_snapshot.json`'s `id`.

## Related

- `CLAUDE.md`, "Database", the "Changing the schema" bullet (never edit a merged migration; write a new one).
- `document/learning/17_vehicle_catalogue.md`, step 4: the seven conflicts and how each was resolved.
- `document/learning/22_slot_engine.md`: the other side of this merge.
