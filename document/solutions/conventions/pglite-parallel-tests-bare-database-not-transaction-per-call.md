---
title: "PGlite parallel-write tests: give each call the bare database, because a transaction per call runs them one after another and hides a read-then-write race"
date: 2026-10-28
category: conventions
module: src/server/dal/slots.test.ts
problem_type: convention
component: testing_framework
related_components: [database]
severity: high
applies_when:
  - A Vitest test fires several writes at once (Promise.all) against in-memory PGlite to prove a limit is never passed (slot capacity, send limits, stock, one-per-user rules)
  - The code under test reads a value and writes based on it, or might in a later refactor
  - Tasks 23, 25, 26 and 27 add booking, cancel and reschedule tests on top of the slot engine
symptoms:
  - "A parallel test stays green even when the code it guards reads the count in one query and writes in another"
  - Wrapping each parallel call in db.transaction (the shape a booking transaction suggests) makes a racy implementation look correct
root_cause: test_isolation
resolution_type: test_fix
retire_when: "A @electric-sql/pglite release after 0.5.9 that runs more than one query or transaction at once. Check node_modules/@electric-sql/pglite/dist for _runExclusiveQuery and _runExclusiveTransaction; if PGlite still serialises through them, this lesson holds"
tags: [pglite, parallel-tests, race-condition, transactions, mutation-check, vitest, slot-engine, overbooking]
---

# PGlite parallel-write tests: give each call the bare database, because a transaction per call runs them one after another and hides a read-then-write race

## Context

PGlite (`@electric-sql/pglite` 0.5.9, the in-memory Postgres the Vitest suites use) has one connection. Every query goes through `_runExclusiveQuery`, and every transaction holds `_runExclusiveTransaction` for its whole callback (`node_modules/@electric-sql/pglite/dist/`). So:

- **Bare calls** on the database (`reserveSlot(db, ...)` five times in a `Promise.all`) interleave **query by query**. Call A's `select` can run, then call B's `select`, then A's `update`.
- **A transaction per call** (`db.transaction((tx) => reserveSlot(tx, ...))` five times) runs the five callbacks **one after another**. No two calls ever see the same "before" state.

In task 22 (`22_slot_engine`, not yet merged when this was written), the slot engine's reserve is one conditional upsert (`... on conflict do update ... where reserved < capacity`). To prove the parallel test could catch a race, the reserve was replaced once with the classic bug: read `reserved`, check it in JavaScript, then write `+1` in a second query. Observed on 2026-10-28:

| Test shape | Broken reserve | Result |
| --- | --- | --- |
| 5 bare calls, capacity 2 | read, then write | **failed**: 5 places taken, not 2 |
| 5 calls, each in its own `db.transaction` | read, then write | **passed**: the bug was hidden |

The transaction-per-call shape is the natural one to copy. Booking code runs `reserveSlot` inside the booking transaction, and the task 15 burst test (`src/server/auth/login.test.ts`, "ten requests at the same moment send one SMS") gives each request its own transaction through `decideAndRecordAttempt`. That test's comment already notes "PGlite runs one transaction at a time anyway". Copying it for a capacity test gives a test that can't fail.

## Guidance

1. **Call the bare test database in a parallel-write test.** Give each call `db`, not a `db.transaction` of its own, so the calls interleave query by query (`src/server/dal/slots.test.ts`, "five reservations at once never take more than capacity").
2. **Prove the test can fail.** Break the guarded code once into read-then-write, run the test, watch it fail, then restore it. Record the result in the learning doc. A parallel test that passes against the bug guards nothing.
3. **Say what the test can't prove.** Bare calls catch a read-then-write split across two queries. They can't reproduce a real row race inside one statement on Postgres under READ COMMITTED, because PGlite never runs two statements at once. Put that in the test's comment, and leave the real race to a Postgres run (task 20 on staging).
4. **Test transaction rollback separately.** Use a single `db.transaction` that reserves, then throws, and expect the counter unchanged. That covers "the place rolls back with the booking" without making the parallel test useless.
5. **When the code needs a transaction** (two statements that must commit together, like `moveSlot`), its own tests use `db.transaction`. Race tests still exercise the single-statement pieces on the bare database.

## Why this matters

The test stays green either way, so nothing tells you it's useless until overbooking shows up in production. Postgres there has many connections and real concurrency. Task 22's correctness rests on its one-statement reserve. The parallel test is the only automated thing that would notice a later refactor splitting it into a read and a write, and it only notices in the bare-database shape.

## When to apply

Every Vitest test on PGlite that claims "N at once never exceed a limit": the slot tests in tasks 23 to 28, and any later rate limit, stock count or one-per-customer rule. It also applies when reviewing such a test: if each parallel call opens its own transaction, ask for the bare-database shape or a mutation check.

## Related

- `CLAUDE.md`, "Booking slots", Tests bullet: the same rule in short.
- `document/learning/22_slot_engine.md`, mutation table.
- `document/solutions/conventions/better-auth-phone-login-only-from-server-actions.md`: PGlite's one connection, from the other side (a query made outside an open transaction waits forever).
