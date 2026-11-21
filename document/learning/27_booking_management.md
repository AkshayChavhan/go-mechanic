# 27_booking_management: confirm, cancel, no-show and assign a mechanic

> **Branch:** `27_booking_management` · **Date:** 2026-11-20 · **Status:** In review

## In one minute

Each card on the staff board (`/admin/bookings`) now has a **Manage** panel. Staff can Confirm a booking, Cancel it with a reason only the garage sees (this frees its place in the slot), mark a No-show once the slot has started (this frees nothing), undo a no-show with "Arrived after all", and give the job to a mechanic. Every change is saved with who made it and when. A double tap or a retry never changes anything twice.

Full details: [the plan](../plans/2026-11-20-1302-feat-booking-management-plan.md) (units U1–U6) and the "Booking management" block in `CLAUDE.md`. Moving a booking to another time (reschedule) was split into task 52.

## Why: the problem we solved

Task 26's board was read-only, and every booking stayed `booked` forever. The garage couldn't record that it had checked a booking. It couldn't free a place when a customer cancelled by phone, or mark someone who never came. It also couldn't give a job to a mechanic, so task 31's mechanic job updates had nobody to reach. The owner runs the garage from a phone, so all of this had to work there, without a developer.

The statuses and buttons are the owner's choices of 2026-11-20.

## What: what changed

| File or folder | Change | Why it exists |
| --- | --- | --- |
| `src/domain/bookings.ts` (+ test) | Changed | The four statuses, `canChangeStatus` (the allowed changes), `PLACE_HOLDING_STATUSES`, `ACTIVE_STATUSES`, `checkCancelInput` (reason of 3 to 200 characters) |
| `src/server/db/schema.ts`, `migrations/0012_booking_management.sql` | Changed / Added | New status and history values; `booking_events` gains `new_status`, `reason`, `moved_from`, `moved_to`, `mechanic_id` and CHECKs |
| `src/server/dal/staff-booking-changes.ts` (+ test) | Added | `changeBookingStatus()` and `assignMechanic()`: the staff saves |
| `src/server/dal/staff-users.ts` (+ test) | Added | `isMechanic()` and `listMechanics()` (names only) |
| `src/server/dal/staff-bookings.ts` (+ test) | Changed | The board's read now includes status, job step, mechanic and cancel reason |
| `src/server/dal/job-access.ts`, `jobs.ts`, `photos.ts`, `bookings.ts` (+ tests) | Changed | Cancelled and no-show bookings stop being work and stop counting toward the customer's limits |
| `src/server/actions/admin-bookings.ts` (+ test) | Added | `changeStatusFromBoard` and `assignFromBoard`: the board's Server Actions |
| `src/server/auth/errors.ts` (+ test) | Changed | `staffWithoutDetails`: an unexpected error is logged without the cancel reason |
| `src/domain/board-dates.ts` (+ test) | Changed | The cancelled filter, the notice codes, `checkBoardView` |
| `src/components/admin/booking-manage-panel.tsx`, `board-notice.tsx`, `bookings-board.tsx` (+ test) | Added / Changed | The Manage panel, the notice after an action, status and mechanic on each card |
| `src/app/[locale]/admin/bookings/bookings-gate.tsx` (+ test) | Changed | Reads `?cancelled=` and `?notice=`, and the mechanics list |
| `messages/en.json`, `src/domain/consent.ts` (+ test), `privacy/coverage.test.ts` | Changed | Board words; the privacy notice describes the staff history; `LOGIN_NOTICE_VERSION` is now `2026-11-20` |
| `e2e/admin.spec.ts` | Changed | Confirms and cancels a booking before the page's JavaScript loads |
| `CLAUDE.md`, `readme.md`, `task.md` | Changed | The new rules, task 52, ticks |

## How: step by step

1. **The rules as a table (U1).** `canChangeStatus(from, to, facts)` in `src/domain/bookings.ts` holds six allowed changes, one row per button. Cancel and no-show are refused once the job has started (`job-started`). A no-show is also refused before the slot starts (`too-early`). Cancelled is final. A refusal is an answer, not an error.
2. **Two status lists, not one.** A no-show holds its place (the time has passed, so nobody else could use it), but it isn't a visit that will still happen. So:
   - `PLACE_HOLDING_STATUSES` (booked, confirmed, no-show) is what the slot counters count.
   - `ACTIVE_STATUSES` (booked, confirmed) is what a mechanic may work on, what can be assigned, and what the customer's limit of future bookings (`MAX_FUTURE_BOOKINGS`, 3) and the same-slot check count.

   One list would get one of these wrong.
3. **History rows (U2).** Each staff change adds one `booking_events` row: `status-change` (with `new_status`, and `reason` for a cancel), `assigned` (with `mechanic_id`), or `rescheduled` (columns ready for task 52). The migration was written with:
   ```bash
   npm run db:generate -- --name=booking_management
   ```
   Its CHECKs compare `kind::text`, not the enum. drizzle runs every pending migration in one transaction, and Postgres refuses to use an enum value added in a transaction that hasn't committed yet.
4. **The staff saves (U4).** `src/server/dal/staff-booking-changes.ts` keeps one fixed order:
   1. `authorize("bookings.manage")`, then the input check (status, reason, token);
   2. one transaction that locks the booking row (`select ... for update`) and reads status, slot and job step only from that row;
   3. the request token, looked up on this booking and this staff member. The same choice again answers `duplicate`. A *different* choice under an old token answers `stale` and writes nothing;
   4. `not-found`, then the refusals from `canChangeStatus`;
   5. `releaseSlot` for a cancel only;
   6. the booking update and its event row.

   Why `stale`? Each form gets a fresh random token when the board renders. If staff assign mechanic A, press Back, pick mechanic B on the old page and send it, the token is the same but the choice isn't. Treating that as a duplicate would hide the second choice; saving it would act on an out-of-date page. So the board says "This booking changed" and staff look again.
5. **Mechanics (U3).** No "mechanic" role is compared in code. `isMechanic()` asks the permission table: the user's effective role (`effectiveRole`) may `jobs.update` but not `bookings.manage`. `assignMechanic` checks it again inside its transaction. Nobody is a mechanic until task 29 adds the team screen, so the board says "No mechanics yet"; the tests seed mechanic users.
6. **Guards elsewhere.** `jobsOf()` in `job-access.ts` now adds `bookingActive`, so a mechanic loses a job the moment it's cancelled or marked no-show, and gets it back after "Arrived after all". `updateJob` and `startJobPhotoUpload` answer `booking-closed` for those bookings. `createMyBooking` counts only active bookings.
7. **The board (U5).** The panel is a native `<details>` with plain forms in a Server Component:
   ```tsx
   const changeStatus = changeStatusFromBoard.bind(null, locale, id, view);
   ```
   The bound locale, booking id and board view (day, cancelled filter) travel with the form, encrypted by Next.js. The action redirects back to the board with a fixed `notice` code, the booking code and `#booking-<id>`, so the page lands on the card. No reason, name or phone number ever goes in a URL. Cancelled cards are hidden by default (`?cancelled=show` shows them), so after a cancel the notice itself carries the customer's call link: the customer hears nothing from the site until tasks 25 and 35.
8. **Privacy (U6).** "Your bookings" in the notice now lists the staff history and says the cancel reason is for the garage only. `LOGIN_NOTICE_VERSION` moved to `2026-11-20`.
9. **Size checkpoint.** After U6 the work was about 3,300 changed lines (about 1,450 of app code), past the plan's stop line. Reschedule (U7, U8) would add about 1,300 more. The owner agreed to split it into task 52 on 2026-11-20. Phone bookings (task 50) need the same staff time window anyway.

## Decisions worth knowing

- **"Works without JavaScript" means "before the page's JavaScript loads".** This was found while writing the browser test. The board appears after the access check, inside `<Suspense>`. React sends a streamed part later in the same HTML and shows it with a small inline script. With JavaScript fully off, that script never runs, and the page stays on its loading line forever. So the test blocks only the page's script files (`**/_next/static/**/*.js`) instead of using `javaScriptEnabled: false`. That is what a slow phone sees before React starts. Task 26's "works without JavaScript" claim was too strong for the same reason; `CLAUDE.md` now says it precisely.
- **Plain forms, no client island.** No staff data sits in browser JavaScript, and a button works the moment the HTML arrives.
- **"Arrived after all" saves `confirmed`.** It's the same status as Confirm, with a different notice.

## New ideas in this task

- **Row lock (`for update`):** the first change to read the booking row holds it until its transaction ends; a second change waits. Like one person holding the only pen for a sign-up sheet. Without it, two cancels at once could both give the place back.
- **Request token (idempotency):** a random id sent with the form. If it was already used, the server knows this is a repeat, not a new request. A shop receipt number: showing the same receipt twice doesn't get you two refunds.
- **Bound Server Action arguments:** `action.bind(null, a, b)` fixes the first arguments of a Server Action. Next.js encrypts them in the page, so the browser can't change which booking a button acts on.
- **Streaming with `<Suspense>`:** the server sends the page's outline first and the slow part later in the same response. A tiny inline script swaps it in.

## Check that it works

```bash
npx vitest run src/domain/bookings.test.ts src/server/dal/staff-booking-changes.test.ts src/server/actions/admin-bookings.test.ts
```

Run on 2026-11-20 it printed `Test Files  3 passed (3)` and `Tests  131 passed (131)`.

The main session ran the full checks on the branch: `npm run check` passed with 2,567 tests, and `npm run test:e2e` passed 136. After the review fixes, `npm run check` passed with 2,569 (the first run after them had one failure that didn't come back on a full rerun: most likely the photo-uploader timing test that has flaked before). `npm run test:design` wasn't needed: no `ui/` or `site/` component changed.

By hand: `npm run dev`, log in as the owner (`97647 50567`, the code is on `/dev/outbox`), book something as a customer, then open **Staff area → Bookings**, open the card's **Manage** panel, and Confirm, then Cancel with a reason. Press **Show cancelled** to see the reason on the card.

**Honest limit:** two of the plan's mutation checks can't fail any test today: writing the booking before `releaseSlot`, and dropping `for update`. PGlite runs one transaction at a time, so two changes never overlap in a test. Task 20 will prove the lock on a real Postgres.

## Common mistakes

- **Comparing a status with `'booked'` alone.** Use `PLACE_HOLDING_STATUSES` or `ACTIVE_STATUSES`; a confirmed booking is still active.
- **Looking up the token after the refusals.** A retry of a successful cancel would then answer "not allowed" (it's already cancelled) instead of `duplicate`.
- **Putting the reason or a phone number in the redirect URL.** URLs end up in history and logs; use the fixed notice codes.
- **Testing "no JavaScript" with `javaScriptEnabled: false`** on a page that streams: you only test the loading line.

## Try it yourself

In `src/domain/bookings.ts`, delete the line in `canChangeStatus` that returns `too-early`. Run:

```bash
npx vitest run src/domain/bookings.test.ts src/server/dal/staff-booking-changes.test.ts
```

Find the tests that fail (look for "No-show before the slot starts"). Explain in one sentence why a no-show must wait for the slot to start. Then put the line back.

## Review

- `ce-code-review` (eight reviewers: correctness, security, adversarial, project rules, testing, maintainability, the migration, past lessons): **Ready with fixes**. Nothing serious. One confirmed gap: no test showed that a mechanic loses access to a job's photos once its booking is cancelled or a no-show. Fixed by a new test in `src/server/dal/photos.test.ts` (e217c43). Three small tidy-ups were made too (a doc comment moved back above its function, a needless type cast dropped, and a note that no query reads `PLACE_HOLDING_STATUSES`) (144dd3f). One note became a step for task 25: if a customer's Confirm on `/book` is retried after staff cancelled that booking, the retry shows the cancelled booking as "You already have this booking".
- `code-reviewer`: **Needs changes** at first, for one must-fix: a stray backtick in `CLAUDE.md`'s repo map broke the formatting of the `src/server/` row. Fixed. Its suggestions were fixed too: the privacy notice said "marked as not come", which now reads "marked as a no-show (the vehicle didn't come)", with the fingerprint in `consent.test.ts` updated (version `2026-11-20` never shipped, so it stays). The code itself was ready to merge.
- Compound: [suspense-streaming-needs-inline-script-test-no-js-by-blocking-bundles.md](../solutions/conventions/suspense-streaming-needs-inline-script-test-no-js-by-blocking-bundles.md). It records the discovery that a fully JavaScript-free browser never shows streamed content, so a "works without JavaScript" test blocks the page's script files instead.

## Learn more

- [Next.js: Forms and Server Actions](https://nextjs.org/docs/app/guides/forms) (also `node_modules/next/dist/docs/01-app/02-guides/forms.md`, "Passing additional arguments"): `bind` and plain form posts.
- [Next.js: Streaming](https://nextjs.org/docs/app/guides/streaming): how `<Suspense>` sends parts of a page later.
- [PostgreSQL: Explicit locking, row-level locks](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-ROWS): what `FOR UPDATE` does.
- [PostgreSQL: `ALTER TYPE`](https://www.postgresql.org/docs/current/sql-altertype.html): the note on using a new enum value in the same transaction.
- [MDN: `<details>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/details): the panel that opens without JavaScript.
