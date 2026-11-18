# 23_booking_flow: the booking engine, one save that can't overbook

> **Branch:** `23_booking_flow` · **Date:** 2026-11-13 · **Status:** Done (merged through PR #24 on 2026-11-17)

## In one minute

This task builds everything a booking needs *behind* the page: the rules for what a booking may hold, three new tables, and one function, `createMyBooking`, that takes a slot's place and writes the booking in a single transaction. It also makes a new login on a phone end the old one. The `/book` page that customers will click through is task 47, built on top of this.

Full details: [the plan](../plans/2026-11-11-2016-feat-booking-flow-plan.md) (task 23 is units U1–U5, task 47 is U6–U10) and the "Bookings" block in `CLAUDE.md`.

## Why: the problem we solved

- **The garage had slots (task 22) and prices (task 18), but no way to book.** Booking is the main thing the site exists for.
- **Overbooking is the expensive bug.** If two customers can both take the last place, someone drives to a garage that has no room for them.
- **A booking is a record of work.** If a customer later edits their vehicle or the garage changes a price, an old booking must still say what was booked. So a booking keeps its own copy.
- **Why two pull requests.** Task 21 came in at about 3,600 lines, too much to review in one sitting. Task 23 is about 1,850 hand-written lines (tests and docs included); the page (about 2,100 more) is task 47.

## What: what changed

| File | Change | Why it exists |
| --- | --- | --- |
| `src/domain/bookings.ts` + test | Added | The rules: `checkBookingInput`, `buildBookingLines` (lines and total), `makeBookingCode` / `formatBookingCode`, `MAX_FUTURE_BOOKINGS = 3` |
| `src/domain/ids.ts` | Added | `isUuid`: a made-up id is "not found" without a query (Postgres would crash on it) |
| `src/server/db/schema.ts`, `migrations/0006_bookings.sql`, `meta/` | Changed, Added | The `bookings`, `booking_items` and `booking_events` tables |
| `src/server/db/bookings-tables.test.ts` | Added | The tables' constraints, tested against PGlite |
| `src/server/dal/bookings.ts` + test | Added | `createMyBooking`, the only code that writes a booking |
| `src/server/dal/customer-vehicles.ts` | Changed | Split out `insertVehicleRow`, `findVehicleByRegistration` and `readMyVehicleForBooking`, so the booking can save a new vehicle inside its own transaction |
| `src/server/dal/sessions.ts`, `src/server/auth/login.ts` + test | Added, Changed | End the phone's old login after a correct code |
| `messages/en.json`, `privacy/page.tsx`, `privacy/coverage.test.ts`, `src/domain/consent.ts` + test | Changed | The privacy notice describes bookings; version `2026-11-13` |
| `CLAUDE.md`, `document/task/task.md` | Changed | The "Bookings" rules; task 47 added |

## How: step by step

1. **Wait for task 18, then merge it (U1).** Prices come from task 18, so this task's code started only after task 18 was merged into `main`. Task 18 owns migration `0005`, so this task's migration is `0006`. It was generated after the merge, not renamed by hand ([the lesson](../solutions/workflow-issues/parallel-branches-same-migration-number-regenerate-not-rename.md)).

2. **The rules, test first (U2).** A booking holds one package *or* several services, never both, and at least one. Each line is priced with the garage's **real** prices only, never the samples `npm run dev` shows. No real prices exist until task 39, so for now every line is "price confirmed at the garage" (`no-price`) and the total is `null`.

3. **The tables (U3).** `bookings` copies the vehicle (kind, model, fuel, price group, registration). `booking_items` copies each line's name and price. `booking_events` records "booked, by whom, when". The SQL migration was written by:
   ```bash
   npm run db:generate -- --name=bookings
   ```
   `--` passes `--name=bookings` through npm to drizzle-kit, which names the file `0006_bookings.sql`.

4. **The save, in a fixed order (U4).** `createMyBooking` in `src/server/dal/bookings.ts`:
   1. `authorizeUser()` first, then the input check, then the reads that may be cached (catalogue, services, prices) and the saved vehicle. These happen *before* the transaction: on PGlite, a separate query inside an open transaction waits forever.
   2. One transaction. It first takes a lock on this customer (`pg_advisory_xact_lock`), so two taps of "Confirm" run one after the other.
   3. Then reads only: the **request token** (the same confirm again answers `duplicate` with the first code), the typed plate against saved vehicles, **the same vehicle already booked in the same slot** (a reload makes a new token; this also answers `duplicate`), and the limit of 3 future bookings.
   4. Only then `reserveSlot`, then the writes.

   **Every refusal comes before `reserveSlot`.** After it, the only answer is `booked`. If a write fails, it throws and the whole transaction rolls back, the slot's place included. So a refused booking never keeps a place.

5. **One phone, one login.** Better Auth leaves the old session row alive when a *different* number verifies on the same phone. `verifyLoginCode` now reads the old login *before* the code check (afterwards, a stale cookie would make Better Auth clear the cookie it just set) and deletes it *after* a correct code.

6. **The privacy notice (U3, U5).** A new "Your bookings" item. The vehicles, withdraw and session texts are reworded: a booking keeps its vehicle copy after the vehicle is removed, and another login on the same device ends the old one. `LOGIN_NOTICE_VERSION` moved to `2026-11-13`.

## Decisions worth knowing

- **3 future bookings per customer**, the owner's choice over "one per vehicle". One-per-vehicle left customers stuck after a wrong time (cancelling comes in task 25) and didn't stop one login filling every slot.
- **The booking is a second request.** A login made inside a Server Action can't be read until the next request: `getCurrentUser()` reads the *request's* headers, and the new cookie isn't in them yet. So the page (task 47) checks the code in one request and saves the booking in the next.
- **No retry on a booking-code clash.** It throws and rolls back; the customer's retry draws a new code.

## New ideas in this task

- **Transaction:** a group of database changes that all happen or none do. Like a bank transfer: the money leaves one account only if it reaches the other.
- **Advisory lock** (`pg_advisory_xact_lock`): a lock on a name you pick (`booking-user:<id>`), not on a table. Like one key to a fitting room: the second person waits. The `xact` part means it's released when the transaction ends.
- **Request token:** a random id the page sends with each confirm. Seeing it twice means "the same tap again", so the server answers with the first booking instead of making a second.
- **Snapshot (copy):** the booking stores the vehicle and prices as they were, like a printed receipt that doesn't change when the shop changes its prices.
- **Mutation check:** break the code on purpose and make sure a test fails. It proves the test actually guards that line.

## What went wrong

- **A helper lost its connection.** During U3, the build step's API connection dropped mid-unit. A second helper picked up the half-done unit and finished it.
- **A shell slip.** One `git add` broke because zsh doesn't split a variable into words the way bash does, so a list of file names became one bad name. It was retried with an array.

## Check that it works

The booking tests (they open PGlite, so they take about half a minute):
```bash
npx vitest run src/domain/bookings.test.ts src/server/dal/bookings.test.ts src/server/db/bookings-tables.test.ts src/server/auth/login.test.ts
```
```
 Test Files  4 passed (4)
      Tests  102 passed (102)
```
`src/server/dal/bookings.test.ts` covers: logged out, A booking with B's vehicle, a full slot, a rollback after the place was taken, the fourth future booking, a double confirm, and a reload.

**Mutation checks in U4** (each one made a test fail, then was undone): dropping `authorizeUser()`; dropping `user_id` from the saved-vehicle `WHERE`; writing the booking before `reserveSlot`; moving the token lookup after `reserveSlot`.

**What PGlite can't prove.** PGlite runs one query at a time, so these tests can't show two real connections racing for the last place. Task 20's test on a real Postgres covers that, and should cover the per-customer lock too.

## Reviews

- **`ce-code-review`** (full, 8 reviewers): "Ready with fixes". Two confirmed P2 findings, both fixed:
  - The withdraw text promised to delete the login, but the database refuses to delete a user who has bookings. Fixed in `2cf2756`.
  - A reload plus a second confirm made a new request token, so one vehicle could be booked twice in one slot. Fixed in `7c1e19e` (the same-vehicle-same-slot check).
- **`code-reviewer`:** "Ready to merge", no must-fix items. Its five suggestions:
  - Two tracker fixes (task 23's row described the old scope; a backlog note pointed at task 23 instead of task 47): done.
  - Task 47 must show a `duplicate` answer as "you already booked this vehicle for this time", since it also comes back when the second confirm picked other services: added to task 47's U7 step.
  - Left as known risks, both rare and both rolling back cleanly: a saved vehicle removed in another tab during the booking makes the insert throw (an error, not "not found"), and if deleting the old login fails after a correct code, the person sees an error although the new login worked.
- **Compound step:** one lesson saved, [server-action-login-invisible-until-next-request.md](../solutions/conventions/server-action-login-invisible-until-next-request.md): a login made inside a Server Action can't be read until the next request, and Better Auth keeps the old login alive. Task 47 depends on both, and the code alone doesn't show either.
- **Tests:** `npm run check` passed with 1,792 tests after the fixes. `npm run test:e2e` passed with 118 tests after the fixes (2026-11-13).

## Common mistakes

- **Calling `getDatabase()`, `readServices()` or `getCurrentUser()` inside the transaction.** On PGlite it hangs forever. Read everything first.
- **Adding a new refusal after `reserveSlot`.** The place would be taken for a booking that was refused. Put new checks with the others, before it.
- **Passing a user id from the form to `insertVehicleRow` or `findVehicleByRegistration`.** Use only the id `authorizeUser()` returned.
- **Renaming a migration file to fix a number clash.** Regenerate it after merging `main` instead.

## Try it yourself

1. In `src/server/dal/bookings.ts`, move the `earlier` request-token lookup to just after `reserveSlot`.
2. Run `npx vitest run src/server/dal/bookings.test.ts`. Which tests fail, and why does "the first took the slot's last place: still duplicate, not full" catch it?
3. Undo your edit and run the file again: all green.

## Learn more

- [PostgreSQL: advisory locks](https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS): what they are and when they're released.
- [Drizzle ORM: transactions](https://orm.drizzle.team/docs/transactions): `db.transaction` and rollback.
- [Better Auth: phone number plugin](https://www.better-auth.com/docs/plugins/phone-number): the login this task changed.
