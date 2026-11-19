---
title: "Drizzle migrations: a new enum value can't be used in the same migration run, so CHECKs on it compare the column as text"
date: 2026-11-19
category: conventions
module: "src/server/db/schema.ts"
problem_type: convention
component: database
related_components: [testing_framework]
severity: high
applies_when:
  - "A schema change adds a value to an existing pgEnum (drizzle-kit writes ALTER TYPE ... ADD VALUE)"
  - "The same change, or any other migration that may run in the same batch, adds a CHECK, a default, a partial index or a backfill that names the new value"
  - "Tasks 25, 27 and 33 add booking statuses and event kinds (cancelled, confirmed, awaiting-approval moves)"
tags: [drizzle, migrations, postgres, enum, alter-type, check-constraint, pglite, transaction]
---

# A new enum value can't be used in the migration run that adds it

## Context

Task 31 added `job-update` to the `booking_event_kind` enum, plus CHECK constraints such as "a `job-update` row has a step, a note or photos". The plan's first draft wrote those CHECKs as `kind <> 'job-update' or ...`. The plan review (feasibility and adversarial reviewers) caught that this migration could never run, before any code was written:

- Postgres refuses to use an enum value added by `ALTER TYPE ... ADD VALUE` until the transaction that added it has committed ("unsafe use of new value"). Comparing the enum column with the literal `'job-update'` casts that literal to the enum, which counts as a use.
- drizzle's migrator runs **every pending migration in one transaction**: `migrate()` in `node_modules/drizzle-orm/pg-core/dialect.js` wraps the whole loop in `session.transaction(...)`. So putting the CHECK in a separate, later migration file doesn't help: a fresh database (every `npm run dev` first start, every test database, every build) runs both in one transaction.

The failure would have shown up only when `createDatabase` migrated, breaking every test and build at once. It was not reproduced here: the fix went in before the first run.

## Guidance

Compare the column as text in anything the migration creates, so no cast to the new value happens:

```ts
// src/server/db/schema.ts (booking_events)
check(
  "booking_events_job_update_has_content",
  sql`${table.kind}::text <> 'job-update' or ${table.jobStatus} is not null or ${table.note} is not null or ${table.hadPhotos}`,
),
```

Prove it with a table test that starts from an empty database, so it migrates every file in one run, and writes a row with the new value. In `src/server/db/job-timeline-tables.test.ts` that test is "a fresh database takes a job update after migrating (the new enum value is usable)".

Runtime queries, which run long after the migration committed, can use the value normally: `eq(bookingEvents.kind, "job-update")`.

A brand-new enum type created in the same migration (`CREATE TYPE job_status AS ENUM (...)`) is safe to use at once. The rule only applies to `ADD VALUE` on an existing type.

## When to apply

Every time `npm run db:generate` writes an `ALTER TYPE ... ADD VALUE`. Search the new SQL, and any migration still unmerged on other branches, for the value as a literal outside `::text`. That covers CHECKs, `DEFAULT`, `WHERE` clauses of partial indexes, and `UPDATE ... SET` backfills. Use `::text` in the constraint, or move a backfill into application code that runs after the migration.
