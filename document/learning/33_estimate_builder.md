# 33_estimate_builder: the estimate engine and job steps on the board

> **Branch:** `33_estimate_builder` · **Date:** 2026-11-22 · **Status:** In review

## In one minute

Managers and the owner can now build an **estimate** for a booked job: a list of part and labour lines, each marked needed or optional. They can send it, and later start a new version to change it. Sending moves the job to "Awaiting approval". The staff board also got small "Move to …" buttons, so a job can reach Inspection, the step where estimates start. This task has no estimate page. That page is task 53, so for now only code and tests use the engine.

Full details: [the plan](../plans/2026-11-22-1058-feat-estimate-builder-plan.md) and the "Estimates" block in `CLAUDE.md`.

## Why: the problem we solved

Task 31 gave jobs their steps (received, inspection, in service, ready, completed), and one step, `awaiting-approval`, that nothing could reach. When a mechanic finds more work than the customer booked, the garage needs to say "this is the work, this is the price" and wait for a yes. Without a record of that, nobody could later prove what price was agreed.

There was a second gap. Before this task, the board had no way to move a job forward at all, so no job could ever reach Inspection.

The owner's decisions (2026-11-21 and 2026-11-22):

- **Estimates for booked jobs only.** Answering free estimate requests (task 32) moves to task 51, with the inbox.
- **Each line is needed or optional.** Task 34 decides what rejecting a needed line does.
- **Amounts are what the customer pays.** One line will say "Prices include taxes" (no GST breakdown in version 1). That wording ships with the page in task 53.
- **A small Job step control on the board**, which stops at Ready (KD4, KD5). "Completed" waits for a staff page that can hide reviews: a completed job can be reviewed, and nothing else could take a review down.
- **Managers and the owner only** (`estimates.manage`). Customers see nothing until task 34.

## What: what changed

32 files changed (`git diff 872fa7c...HEAD --stat`). The important ones:

| File or folder | Change | Why it exists |
| --- | --- | --- |
| `src/domain/estimates.ts` (+ test) | Added | Line rules (`checkEstimateLineInput`), `estimateTotals`, `canEditEstimate` |
| `src/domain/jobs.ts` (+ test) | Changed | Each move in `JOB_MOVES` has a `how`: `by-hand` or `by-estimate`. Adds `bookingDayReached` and `canMoveJobFromBoard` |
| `src/server/db/schema.ts`, `migrations/0013_estimate_builder.sql`, `meta/` | Changed / Added | The `estimates` and `estimate_lines` tables |
| `src/server/db/estimates-tables.test.ts` | Added | Proves the CHECKs and unique indexes refuse bad rows |
| `src/server/dal/estimates.ts` (+ test) | Added | `startEstimateVersion`, `addEstimateLine`, `removeEstimateLine`, `sendEstimate`, `readEstimateForStaff`. Only this file writes the two tables |
| `src/server/dal/jobs.ts` (+ test) | Changed | `updateJob` refuses `before-booking-day` |
| `src/server/dal/staff-booking-changes.ts` | Changed | `lockBooking` exported, so the estimate saves lock the same row the same way |
| `src/server/dal/staff-bookings.ts` (+ test) | Changed | The board reads each booking's newest estimate version (shown from task 53) |
| `src/server/actions/admin-bookings.ts` (+ test) | Changed | `moveJobFromBoard`, the Server Action behind the buttons |
| `src/components/admin/booking-manage-panel.tsx`, `board-notice.tsx` (+ test) | Changed | "Job step: …" and the "Move to …" buttons, and their notices |
| `src/domain/board-dates.ts` (+ test) | Changed | New notice codes: `job-moved`, `job-step-changed`, `before-booking-day` |
| `messages/en.json`, `src/domain/consent.ts`, `consent.test.ts`, `privacy/coverage.test.ts` | Changed | The privacy notice covers estimates; `LOGIN_NOTICE_VERSION` is now `2026-11-22` |
| `e2e/admin.spec.ts` | Changed | Checks that a later day's booking offers no job step; the moves themselves are unit-tested |
| `CLAUDE.md`, `task.md` | Changed | The "Estimates" rules; task 53 and backlog lines |

## How: step by step

1. **The rules (U1).** `checkEstimateLineInput` checks what a form posts: kind (`part` or `labour`), needed or optional, a description of at most 120 characters, and an amount. Amounts go through task 39's `parseRupees`, so every staff screen reads typed money the same way. The new `how` field in `JOB_MOVES` matters most here. `canMoveJob` (used by `updateJob`) only accepts `by-hand` moves. So no job update can ever reach `awaiting-approval`: only `sendEstimate` can.
2. **The tables (U2).** Edit `schema.ts`, then write its migration:
   ```bash
   npm run db:generate -- --name=estimate_builder
   ```
   This makes `src/server/db/migrations/0013_estimate_builder.sql`. `--` passes `--name` on to drizzle-kit instead of to npm. An estimate's state is never stored as a word. It comes from two timestamps: no `sent_at` means **draft**, `sent_at` without `superseded_at` means **sent** (the current one), and both mean **superseded**. Two partial unique indexes keep that honest: `estimates_one_draft_per_booking` and `estimates_one_current_per_booking`.
3. **Job step buttons (U3).** The Manage panel shows "Job step: …" and one "Move to …" button per allowed next step, through `moveJobFromBoard`. The panel is still a plain form post, as in task 27.
4. **The saves (U4).** Every write in `src/server/dal/estimates.ts` follows one order, written at the top of the file:
   1. `authorize("estimates.manage")`, then check the input.
   2. Reads that open their own connection, before the transaction (PGlite has one connection).
   3. Lock the booking row.
   4. Look up the caller's request token. If it was already used, answer `duplicate`.
   5. `not-found`, then the refusals, then the writes.

   "Change estimate" starts the next version with a copy of the sent lines. `sendEstimate` also checks a **revision** number. The page posts the revision it showed, and each add or remove raises it by one. If someone changed the draft in another tab, the send answers `estimate-changed` instead of sending lines the sender never saw.
5. **Why a send supersedes first.** Postgres checks a unique index after *each* statement, not at the end of the transaction. If the draft were marked sent first, for a moment there would be two current versions, and the index would refuse it. So `sendEstimate` marks the old version superseded first, then marks the draft sent.
6. **Size checkpoint.** After U4 the branch was about 2,230 lines, and near 3,600 with the page. That is too much for a 15-minute review, so the owner moved the page (U5) and its browser steps to **task 53**.
7. **U6.** Updated the privacy notice ("Your bookings" now lists estimates), added the browser test, and wrote the `CLAUDE.md` block.
8. **Simplify pass.** Only small tidy-ups (`071912a`): repeated comments and a duplicated type.

## Decisions worth knowing

- **The state comes from timestamps, not a `status` column.** A status column could say "sent" while `sent_at` is empty. With timestamps only, the CHECK `estimates_send_complete` makes "sent" and "who sent it, when, with which token" arrive together.
- **"Vehicle received" only from the booking's day.** The review found that one mis-tap on a future booking started its job. After that, cancel and no-show were refused for good. The owner chose (2026-11-22): `updateJob` refuses `before-booking-day` before the booking's India day, and the board hides the button.
- **The board stops at Ready.** See the owner's decisions above.

## New ideas in this task

- **Idempotent:** doing it twice has the same effect as doing it once. A double-tap on Send must not send two versions.
- **Request token:** a random id the form makes each time it renders. The save stores it. If the same token arrives again (a retry after a lost answer), the save answers `duplicate` with the first result instead of writing again. It works like a ticket number at a counter: show the same ticket twice and you get the same order back, not a second one.
- **Row lock (`select ... for update`):** while one transaction holds the lock on a booking's row, a second save of that booking waits. That way two staff can't both make "version 3". It works like taking the only pen: the next person waits for it.
- **Partial unique index:** a unique rule that only covers rows matching a `WHERE`. `UNIQUE (booking_id) WHERE sent_at IS NULL` means "at most one draft per booking", while sent versions can be many.
- **Supersede:** to replace something with a newer one and keep the old one as history. A superseded estimate isn't deleted; it just isn't the current one any more.

## Check that it works

Run in the main session after the review fixes:

```bash
npm run check      # 2,884 tests passed (after merging main, which brought task 41)
npm run test:e2e   # 137 passed (a first run under very heavy machine load timed out in access.spec.ts; the rerun with the load down passed)
```

The estimate tests alone (run while writing this doc):

```bash
npx vitest run src/domain/estimates.test.ts src/domain/jobs.test.ts src/server/dal/estimates.test.ts src/server/db/estimates-tables.test.ts
#  Test Files  4 passed (4)
#       Tests  90 passed (90)
```

In `e2e/admin.spec.ts`, the owner opens a second booking on a later day and checks that it offers no "Move to …" button (a vehicle can be received only from its booking day). No browser test clicks a step button yet: the moves are proven by `bookings-board.test.tsx`, `admin-bookings.test.ts` and `jobs.test.ts`. A browser test that moves a job needs a booking for today, which task 53's step says to solve.

**Known gaps (honest list):**

- A sent job sits at `awaiting-approval`, and cancel is refused there, until task 34 adds the moves out of it. Production can't reach this before task 53, because there's no page to send from.
- PGlite runs one transaction at a time, so no test proves two sends racing. Task 20 checks that on real Postgres.
- If you add a line, remove it, then retry the *add* with the same token, the line comes back. The token lived on the removed row, so the retry finds nothing and adds the line again.

## Common mistakes

- **Moving a job to `awaiting-approval` through `updateJob`.** It's a `by-estimate` move, so `canMoveJob` refuses it. Send an estimate instead.
- **Marking the draft sent before superseding the old version.** The partial unique index fails at once.
- **Calling `readServices()` inside the transaction.** On PGlite it waits forever. Read first.
- **A browser test (task 53) that books a later day.** The board won't offer "Move to Vehicle received", so the job never reaches Inspection. Book today's date.

## Try it yourself

1. Open `src/server/db/estimates-tables.test.ts` and find the test for two drafts on one booking. Predict which index name the error mentions, then check.
2. In `sendEstimate`, swap the two `update(estimates)` statements and run `npx vitest run src/server/dal/estimates.test.ts`. Which tests fail, and why? Undo the swap afterwards.
3. Bonus: in `src/domain/jobs.ts`, change one `by-estimate` row to `by-hand` and see which test in `jobs.test.ts` notices. Undo it.

## Learn more

- [PostgreSQL: partial indexes](https://www.postgresql.org/docs/current/indexes-partial.html): unique rules for some rows only.
- [PostgreSQL: row-level locks](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-ROWS): what `FOR UPDATE` does.
- [PostgreSQL: unique constraints are checked per statement](https://www.postgresql.org/docs/current/sql-set-constraints.html): why the order of the two updates matters.
- [Drizzle Kit: generate](https://orm.drizzle.team/docs/drizzle-kit-generate): how `db:generate` writes migrations.

## Review

**`ce-code-review`** (8 reviewers, full depth): "Ready with fixes". It confirmed two P2 findings, and both are fixed:

- **`CLAUDE.md` still named task 33** for answering free estimate requests. It now names task 51 (`fa7907c`).
- **One mis-tap on a future booking started its job for good.** Fixed with the booking-day rule above (`e1f821c`). We also added a test that sends an estimate after the job moved to Ready.

**`code-reviewer`:** "Needs changes" for one must-fix in the docs: this doc said the browser test moves a job, but it only checks that the button is absent. Fixed above. Its suggestions were fixed too: the description comment in `schema.ts` now says what `normalizeTypedText` really does (it keeps line breaks), the file count and the `staff-bookings.ts` row here are corrected, task 53's steps say the card must use `StaffBookingRow.estimate`, and the backlog notes that moving a job to Ready leaves a draft read-only.

## Compound

No new lesson in `document/solutions/`. The two things this task taught are now written where the next session reads them: the booking-day rule and "a browser test that needs a started job must book today's date" are in `CLAUDE.md` ("Jobs", "Estimates") and in task 53's steps, and the supersede-before-send order is in the schema comment and tested. The rest followed lessons we already had (idempotent saves, enum migrations, the privacy notice).
