# 31_job_timeline: the engine behind a job's steps, notes and photos

> **Branch:** `31_job_timeline` · **Date:** 2026-11-19 · **Status:** In progress

## In one minute

Once a vehicle reaches the garage, staff can now move its job through steps (Booked → Vehicle received → Inspection → Awaiting approval → In service → Ready → Completed) and add notes and photos along the way. The customer can read their own booking's timeline, and a `JobTimeline` component shows it. This task built only the engine. No page calls it yet: the customer's booking page is task 25, and the mechanic's phone view under `/admin` is task 26.

Full details: [the plan](../plans/2026-11-19-1833-feat-job-timeline-engine-plan.md) (R1–R9, KTD1–KTD10, units U1–U6) and the "Jobs" block in `CLAUDE.md`.

**Built in parallel.** Two other Claude sessions worked at the same time, each in its own folder (a git worktree). This was Session 2, in `go-mechanic-s2`. There was no merge conflict. `origin/main` had no new migration when `0010` was generated, and `LOGIN_NOTICE_VERSION` moved from `2026-11-19.2` (on `main`) to `2026-11-19.3`.

## Why: the problem we solved

Before this task a booking stopped at "booked". Nothing recorded the work, so a customer couldn't see how far along their car was, and a mechanic had nowhere to write "front pads worn". The photo storage from task 30 only knew customers' own photo sets, not photos taken by the garage.

The owner decided on 2026-11-19: **build the engine now, no pages.** Tasks 25 and 26 aren't started, and assigning a mechanic is task 27. Tests set the assigned mechanic directly.

Claude picked these defaults and flagged them to the owner:

- **Inspection → Ready is allowed by hand** when no work is needed (the vehicle goes back as it is).
- **Ready → In service is the only way back** (a problem turns up at the end).
- **A mechanic loses access to a job once it's completed.** Managers and the owner keep it.
- **Customers see "the garage"**, never the mechanic's name.
- **Notes are always shown to the customer.** There are no staff-only notes in version 1.

**Why the step is its own column.** Bookings already have a `status` column. But `createMyBooking` (task 23, another session's code) filters on `status = 'booked'` in its duplicate check and its count of future bookings. If job steps went into that same column, a booking whose job had started would stop counting, and both checks would break. So the step lives in a new `bookings.job_status`, which is null until the vehicle arrives.

## What: what changed

| File or folder | Change | Why it exists |
| --- | --- | --- |
| `src/domain/jobs.ts` (+ test) | Added | `JOB_STATUSES`, `JOB_STEPS`, the table of allowed moves read through `canMoveJob(from, to)`, and `checkJobUpdateInput` (note at most 1,000 characters) |
| `src/domain/typed-text.ts` (+ test) | Added | `normalizeTypedText` and `typedLength`, moved out of task 32's estimate code so notes and descriptions are cleaned the same way |
| `src/domain/estimate-requests.ts` (+ test) | Changed | Imports the shared cleaner instead of its own copy |
| `src/domain/bookings.ts` (+ test) | Changed | The event kinds gain `job-update` |
| `src/server/db/schema.ts`, `migrations/0010_job_timeline.sql`, `meta/` | Changed / Added | `bookings.job_status` and `assigned_mechanic_id`; on `booking_events`: `job_status`, `note`, `photo_set_id`, `had_photos`, `request_token`, with their CHECKs; `photo_sets.booking_id` |
| `src/server/db/job-timeline-tables.test.ts` | Added | Migrates a fresh database from zero and proves each CHECK and foreign key |
| `src/server/dal/job-access.ts` | Added | `jobsOf` and `jobRowFilter`: which bookings a staff member may work on, as a `WHERE` condition |
| `src/server/dal/jobs.ts` (+ test) | Added | `updateJob`, `readMyJobTimeline` (customer), `readJob` and `listMyAssignedJobs` (staff) |
| `src/server/dal/photos.ts` (+ test) | Changed | `startJobPhotoUpload`, `finishJobPhotoUpload`, a third viewer (the assigned mechanic), `viewLinksFor`; customer uploads refuse job sets |
| `src/server/dal/estimate-requests.ts` (+ test) | Changed | An estimate request refuses a job's photo set |
| `src/components/jobs/job-timeline.tsx` (+ test) | Added | The `JobTimeline` Server Component: the steps (done, current, to come) and the updates, newest first |
| `src/app/[locale]/dev/design/page.tsx` | Changed | A "Job timeline" sample in several states |
| `messages/en.json` | Changed | The `JobTimeline` text; the privacy notice's "Your bookings" and the renamed "Photos of your vehicle" |
| `src/domain/consent.ts` (+ test), `privacy/coverage.test.ts` | Changed | `LOGIN_NOTICE_VERSION` to `2026-11-19.3`; the new columns listed |
| `CLAUDE.md`, `task.md` | Changed | The "Jobs" rules, and backlog notes for tasks 20, 25, 26, 27, 33, 35 and 43 |

## How: step by step

1. **Plan, then review the plan.** `ce-plan` wrote the plan. `ce-doc-review` then ran six reviewers on it (coherence, feasibility, scope, security, adversarial, design). They caught four real bugs before any code existed:
   - **A CHECK on `photo_set_id` would break later.** The first idea was "a `job-update` must have a step, a note or a photo set". But the photo cleanup deletes old sets, and `photo_set_id` is `on delete set null`. A photos-only update would then break its own CHECK, the cleanup's delete would fail, and every later upload (which runs the cleanup first) would fail with it. The fix is a `had_photos` flag that is set once and never cleared.
   - **The migration couldn't use its own new enum value.** See "Enum migration in one transaction" below. The CHECKs compare `kind::text` instead.
   - **The token lookup must match the booking too.** Otherwise a token reused on booking Y could answer with booking X's update.
   - **Close a photo set when it's attached to an update**, not only when the job is completed. A long job would otherwise lose its photos at 30 days (the rule for open sets).
   - Smaller changes: the unreachable "estimate sent" path was dropped (task 33 adds it), the two step fields got clear names (`movedTo`: the step this update moved to; `stepAfter`: the job's step once it was applied), and notes are plain text shown with `whitespace-pre-line` to keep line breaks.
2. **The rules (U1).** The allowed moves are seven rows in `JOB_MOVES` in `src/domain/jobs.ts`. Nothing reaches `awaiting-approval` yet; it is in the enum only because Postgres stores the enum's order.
3. **The tables (U2).**
   ```bash
   npm run db:generate -- --name=job_timeline   # wrote 0010_job_timeline.sql + meta/
   ```
   The `--` passes `--name` through npm to drizzle-kit; it sets the file name after the number.
4. **Job photos (U3).** A job's photo set is a normal customer set (`user_id` is the booking's customer, so the customer sees it and `deletePhotosOfUser` removes it) that also carries `booking_id`. Job sets don't count toward the customer's 5 new sets a day.
5. **The update and the reads (U4).** `updateJob` keeps a fixed order: check the permission and the input, then in one transaction lock the booking row through `jobRowFilter`, look up the request token on this booking and actor (`duplicate`), and only then answer `not-found` if the lock found no row, then refuse `job-closed`, `move-not-allowed` or `photos-not-found`, then write the event, move `job_status` and close the set.
6. **The component (U5).** `JobTimeline` is an async Server Component. It shows each step's state in words, not colour alone, and dates and times in India time.
7. **Privacy notice (U6).** "Your bookings" now lists job progress, notes, photos and the assigned mechanic, who never sees the mobile number. "Photos you send us" became "Photos of your vehicle": it covers the garage's photos too, and says an update's photos go a year after that update.

## Decisions worth knowing

- **Duplicate before the refusals, but after the lock.** A retry after a lost answer must get "duplicate", even if the job has moved on since. The lock comes first, so a second send waiting on it sees the first one's update. The lock's filter is itself a refusal that can change: a mechanic's own update to "completed" ends their access to the job, and so does a reassignment. So when the lock finds no row, the caller's own update with that token still answers `duplicate`, and only then comes `not-found`. That's safe because it shows them only what they wrote. The first version answered `not-found` first; the code review caught it (see Review).
- **The rule is in the query.** A mechanic's query includes `assigned_mechanic_id = <their id>` and "not completed". A booking you may not touch and a missing one both give `not-found`, so nobody can probe which booking ids exist.
- **Every move of `job_status` writes a `job-update` event.** A `readJob` test first failed because its setup set `job_status` straight in the database, with no event. The timeline works out `stepAfter` by carrying the step forward from events, so it disagreed. The test was fixed to move through `updateJob`, and the rule went into `CLAUDE.md` and the code comment. Task 33's estimate move must follow it too.
- **The phone number only for `customers.contact`.** Staff reads select it only when the reader may contact customers, so a mechanic never receives it.

## New ideas in this task

- **Row lock (`select … for update`):** reading a row and holding it, so any other transaction that wants it waits until yours finishes. Like taking the job card off the board while you write on it: nobody else can move it meanwhile. Two staff moving one job at once can't both read "inspection" and both move it.
- **Idempotency token (request token):** a random id the update form will send with every try. If the same token arrives again from the same person on the same booking, the server answers with the first update instead of saving a second one. Pressing "Send" twice on a slow connection makes one update.
- **Enum migration in one transaction:** an enum is a column type with a fixed list of values. Migration `0010` adds `job-update` to `booking_event_kind` with `ALTER TYPE … ADD VALUE`, the first time this repo does that. Postgres won't let the same transaction *use* a value it just added ("unsafe use of new value"), and drizzle runs all pending migrations in one transaction. So the CHECKs compare `kind::text <> 'job-update'`, a plain text comparison that doesn't need the new value to exist yet.
- **Mutation check:** breaking the code on purpose to see whether a test notices. If no test fails, the tests don't really guard that line.
- **Carry forward (`stepAfter`):** each update stores only the step it moved to, if any. The read walks the updates oldest first and remembers the last step, so a note-only update still knows which step it happened during.

## Check that it works

What was run in this session:

```bash
npm run check                               # passed: 2,211 tests (on the final code, after the review fixes)
npm run test:e2e                            # passed: 128 tests on a production build (final code)
npx playwright test -c <a copy of playwright.dev.config.ts on port 3001>   # design suite
```

The design suite (`npm run test:design`) is fixed to port 3000, which Session 1 was using, so a temporary copy of its config pointed it at port 3001. The first run: 49 passed, 1 failed, the motion demo "Play puts the tile at the end straight away". That is a timing flake under load: it passed 3 of 3 on a rerun, and a second full run passed all 50. The temporary config was then deleted and never committed. Screenshots of the timeline sample at 375px and 1280px wide were checked by eye.

**Mutation checks on U4.** Each break was undone after its run:

| Break on purpose | Tests failed (of 70) |
| --- | --- |
| `jobsOf` without the assignment filter | 11 |
| No "not completed" rule for mechanics | 4 |
| Token lookup without `booking_id` | 1 |
| Duplicate lookup moved after the refusals | 1 |

An honest note on the last one: the first try put the lookup just before the `if (problems.length > 0) return`. That still runs before any refusal returns, so it isn't a real change of order, and 0 tests failed. It was redone with the lookup truly after the refusals, and then 1 test failed.

**What isn't proven.** PGlite has one connection and runs one transaction at a time, so no test can show two `updateJob` calls racing on one booking. The `for update` lock is checked by reading the code; task 20 tests it on a real Postgres (a backlog note says so).

## Common mistakes

- **Moving `job_status` without writing an event.** The timeline then shows the wrong step for later updates.
- **Using a new enum value in the same migration that adds it.** Compare `kind::text`, or put the use in a later migration.
- **A CHECK on a column that a cleanup sets null.** The cleanup's delete fails. Keep a flag that never changes.
- **Looking up a token by actor only.** A token reused on another booking answers with the wrong booking's update.
- **Checking the mechanic's assignment after the query.** Put it in the `WHERE` (`jobRowFilter`), so "not yours" and "not there" look the same.

## Try it yourself

1. Task 33 will let an estimate move a job to Awaiting approval. Add `["inspection", "awaiting-approval"]` to `JOB_MOVES` in `src/domain/jobs.ts`. Before running anything, guess which tests fail. Then run:
   ```bash
   npx vitest run src/domain/jobs.test.ts src/server/dal/jobs.test.ts
   ```
   Hint: `jobs.test.ts` checks every pair of steps against its own copy of the allowed list, and says "nothing reaches awaiting approval". Does the database need a migration? Look at `0010_job_timeline.sql`: the enum already holds the value, and no CHECK lists the moves. So no. Undo your edit afterwards.
2. Read `jobsOf` in `src/server/dal/job-access.ts`. Why does it use `is distinct from 'completed'` and not `<> 'completed'`? (Hint: what does `null <> 'completed'` give in SQL, and what does `job_status` hold for a job that hasn't started?)

## Learn more

- [PostgreSQL: `SELECT … FOR UPDATE`](https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE): row locks.
- [PostgreSQL: `ALTER TYPE … ADD VALUE`](https://www.postgresql.org/docs/current/sql-altertype.html): see its Notes on using a new value inside a transaction.
- [PostgreSQL: comparison operators](https://www.postgresql.org/docs/current/functions-comparison.html): `IS DISTINCT FROM` and nulls.
- [Drizzle ORM: migrations](https://orm.drizzle.team/docs/migrations): how `drizzle-kit generate` writes them.

## Review

**`ce-code-review`** ran 8 reviewers (correctness, project standards, testing, maintainability, saved lessons, security, migration, adversarial; the cross-model pass is off in this repo). Verdict: **Ready with fixes**, no P0 or P1. An independent validator confirmed both findings:

- **#3 (P2): a mechanic's retry of their "completed" update answered `not-found`.** Four reviewers found it on their own. Completing the job ends the mechanic's access, so the lock found no row and the save said "not found" before it looked at the request token. Fixed in `1d8d24d`: the caller's own token is checked first, and the reassigned case now answers `duplicate` too. Two new tests guard it. Moving the `not-found` line back above the lookup makes both fail (checked).
- **#4 (P3): an update could link a photo set with no stored photos**, and the customer's timeline would then say the photos are "no longer kept". Fixed: a set must hold at least one stored photo, with a test.
- Also fixed from its notes:
  - a customer now sees a job's photos only once an update holds them;
  - the transaction type and the "not completed" filter are shared;
  - the reused-token test checks the constraint's name;
  - a manager's assigned-jobs list has a test.

**`code-reviewer`** (repo rules, the final gate). Verdict: **Needs changes**, with one must-fix, all in docs.

- **Must fix, fixed in `1e2a61d`:** this learning doc still described the old retry order.
- **Should fix, fixed:** the test counts above were from before the fixes (they are re-run now), and one plan line still said the old answer.
- **Nice to have, two fixed in `2afe658`:**
  - a job that went Inspection → Ready showed "In service: Done", which told the customer work happened when it didn't (with tests);
  - photo view links were made one at a time.
- **Nice to have, left as is:**
  - a token reused on another booking throws, which is noted for task 26's action;
  - one commit (`feat(31): show the job timeline on /dev/design`) should have been `chore`, and rewriting history isn't worth it.

Everything above was re-run after the fixes: `npm run check` (2,211), `npm run test:e2e` (128) and the design suite on port 3001 (50, all passed).

## Compound

Two lessons pass the question "would a future session repeat this?":

- **Retries after a lock that hides the row:** `document/solutions/conventions/idempotent-save-answer-duplicate-before-refusals-that-can-change.md`, updated with the case the code review caught. When the row lock's own access filter is what the first send changes, the caller's token must still answer `duplicate` before `not-found`.
- **New enum values:** `document/solutions/conventions/drizzle-migration-new-enum-value-compare-as-text.md`, new, from what the plan review caught. A migration that adds an enum value can't use it anywhere in the same drizzle run, so its CHECKs compare the column as text. Tasks 25, 27 and 33 add more statuses and will hit this.
