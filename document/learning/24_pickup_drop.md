# 24_pickup_drop: pickup and drop by PIN code, with one fee

> **Branch:** `24_pickup_drop` · **Date:** 2026-11-19 · **Status:** Done

## In one minute

A booking can now ask the garage to collect the vehicle from an address and bring it back. The garage serves a list of PIN codes, each with one fee for both trips. The booking keeps its own copy of the address, the PIN code and the fee. `/contact` lists the PIN codes and fees. Until the owner gives the real list, the table is empty: production shows no pickup section and refuses pickup, and `npm run dev` shows sample areas marked "Sample". The booking page's pickup step is task 47's job.

Full details: [the plan](../plans/2026-11-19-1145-feat-pickup-drop-plan.md) (R1–R9, KTD1–KTD7, units U1–U6) and the "Pickup and drop" block in `CLAUDE.md`.

**Built in parallel.** Three Claude sessions worked at once, each in its own folder (git worktree). This was Session 2, in `go-mechanic-s2`. Before generating the migration, this branch merged `origin/main` (task 48, the Next.js 16.4.6 upgrade). There was one conflict, in the tracker: `main` had task 23 as Done, this branch had task 24 as In progress; both were kept. The migration then came out as `0008_pickup_drop` with no number clash.

## Why: the problem we solved

Many customers can't bring their vehicle in during working hours. The brief (`features.md` item 13) asks for a pickup step "by pincode, with fee". Task 23 built the booking save without it.

The catch: the owner hasn't given the PIN codes or fees yet, and ruled on 2026-10-29 that **no made-up price reaches a customer**. A fee is a price. So we couldn't just put placeholder areas in the database.

The owner decided on 2026-11-18:

- **Placeholder areas for now, but only as dev-only samples**, not in the database, because the "no made-up price" rule covers fees.
- **One fee per PIN code**, for pickup and drop together, the same for cars and two-wheelers. A fee of 0 means free.
- **One choice:** pickup and drop together (no "pickup only").
- **Show the areas on `/contact`.**

## What: what changed

| File or folder | Change | Why it exists |
| --- | --- | --- |
| `src/domain/pickup.ts` (+ test) | Added | The rules: `PICKUP_RULES` (address 10–200 characters), `asksForPickup`, `checkPickupInput`, `findPickupArea` |
| `src/domain/bookings.ts` (+ test) | Changed | `BookingInput.pickup`; `checkBookingInput` returns pickup problems with the others, tagged `field: "pickup"` |
| `src/server/db/schema.ts`, `migrations/0008_pickup_drop.sql`, `meta/` | Changed / Added | Table `pickup_areas`, and three booking columns: `pickup_address`, `pickup_postal_code`, `pickup_fee_paise`, with CHECKs |
| `src/server/db/pickup-tables.test.ts` | Added | Proves the CHECKs refuse bad rows |
| `src/server/dal/pickup.ts` (+ test) | Added | `readPickupAreas()`: listed areas, cached, ordered by PIN code |
| `src/content/sample-pickup-areas.ts` (+ test) | Added | Four sample areas and `selectPickupAreas()`: real areas, else samples under `npm run dev`, else `null` |
| `src/server/dal/bookings.ts` (+ test) | Changed | `createMyBooking` finds the fee, refuses an unserved PIN code, saves the copy |
| `src/app/[locale]/(site)/contact/page.tsx`, `_components/pickup-areas.tsx` (+ page test) | Changed / Added | The "Pickup and drop" section, last on the page |
| `messages/en.json` | Changed | A `PickupAreas` namespace, and the privacy notice's "Your bookings" now mentions the address, PIN code and fee |
| `src/domain/consent.ts` (+ test), `privacy/coverage.test.ts` | Changed | `LOGIN_NOTICE_VERSION` moved to `2026-11-19`; the new table and columns are listed |
| `e2e/info-pages.spec.ts` | Changed | Scans the production `/contact` for `₹` and the section's words |
| `CLAUDE.md`, `task.md` | Changed | The "Pickup and drop" rules, and backlog notes for tasks 28, 47 and 43 |

## How: step by step

1. **Plan with `ce-plan`.** Its repo-research helper timed out with a server error, so the planner did that reading itself. Then `ce-doc-review` ran six reviewers on the plan and ten fixes went in. Some examples:
   - the section tones depend on whether the pickup section shows;
   - the list is a proper two-column table with headers;
   - "pickup asked for" is defined when only one field is filled (then the blank one gets its problem);
   - the address must stay out of error logs (Drizzle's errors carry the query's values);
   - task 47 must show the pickup step from real areas only.
2. **The rules (U1).** `checkPickupInput` trims the address and collapses spaces, checks its length, and checks the PIN code with `isIndianPinCode` (six digits, first not 0). It doesn't know which PIN codes are served; that needs the database.
3. **Merge `main`, then the tables (U2).**
   ```bash
   git fetch origin && git merge origin/main
   npm run db:generate -- --name=pickup_drop   # wrote 0008_pickup_drop.sql + meta/
   ```
   Merging first means the migration gets the next free number. `--name` sets the part of the file name after the number.
4. **The read and the samples (U3).** `readPickupAreas()` is a public cached read (`'use cache'`, `cacheTag("pickup-areas")`, `cacheLife("max")`). The page passes its result to `selectPickupAreas()`, built on `realOrSamples()`, like the home page's reviews.
5. **Booking with pickup (U4).** In `createMyBooking`, *before* the transaction, the code reads the areas and looks up the PIN code. Not served: inside the transaction, after the two "duplicate" checks and before `reserveSlot`, it returns `pickup-not-offered`, so no slot is touched. Served: the fee is copied into the booking row in the same insert. (The first version refused before the transaction; the review changed that, see Review below.)
6. **The `/contact` section (U5).** A Server Component with a `<table>` (PIN code, fee). The page asks for `pageTones(pickup ? 4 : 3)` so the colour bands still alternate.
7. **Privacy notice and docs (U6).** The notice says what pickup keeps. `consent.test.ts` failed until `LOGIN_NOTICE_VERSION` moved, which is its job.

## Decisions worth knowing

- **Why the booking keeps a copy of the fee.** If the owner raises a fee next month, a customer who booked at ₹300 must still see ₹300. So `pickup_fee_paise` is copied onto the booking, not looked up later. That's also why `pickup_postal_code` has no foreign key: it's a copy, like the vehicle copy from task 23. The fee isn't added to `total_paise`; it's shown beside it.
- **Why the PIN code is the primary key.** Every build worker starts its own in-memory database. A random id would differ between them. A PIN code is the same everywhere, and one row per PIN code is exactly the rule.
- **Why read the areas before the transaction.** PGlite has one connection. Inside a transaction, a cached read that needs the database would wait for a connection the transaction holds: forever. So the areas are read first, and the transaction reads nothing that needs a second connection (only its own queries: the token, the plate, the same-slot booking, the future-bookings count). The accepted risk: a fee changed in that moment books at the old fee.
- **Why samples never sit in the database.** The booking save reads the table, never the samples file. So a sample can't be booked, and the first real area turns every sample off. Rows in the database would reach a production build.
- **"Free", not "₹0".** A 0 fee shows the word "Free". It reads better, and it keeps `₹` out of `messages/en.json`, which the e2e scan relies on.

## New ideas in this task

- **PIN code:** India's six-digit postal code. Here it's the unit of "where we go".
- **CHECK constraint:** a rule the database itself enforces on every row. `bookings_pickup_complete` says all three pickup columns are set, or none are. Even buggy code can't save half a pickup. It's like a form that won't submit with a box missing.
- **Copy (snapshot) on a record:** saving the value as it was at that moment, like a printed receipt, instead of a pointer to a price list that can change.
- **Cached read:** `'use cache'` stores the result, so `/contact` stays built ahead of time. Task 28's save will call `updateTag("pickup-areas")` to refresh it.
- **Discriminated problems:** each problem says which field it belongs to (`{ field: "pickup", problem: "address-too-short" }`), so the form can show it in the right place.

## Check that it works

```bash
npm run check   # passed after the review fix: 135 files, 1,940 tests
npm run test:e2e   # passed: 119 tests on a production build; /contact is still built ahead of time
```

Only the new tests:

```bash
npx vitest run src/domain/pickup.test.ts src/server/dal/pickup.test.ts \
  src/content/sample-pickup-areas.test.ts src/server/db/pickup-tables.test.ts \
  src/server/dal/bookings.test.ts
```

By hand: `npm run dev`, open `/contact`. At the bottom you should see "Pickup and drop" with a Sample badge and a table of four PIN codes. `412101` shows "Free". A production build shows no such section. Checked on 2026-11-19 under `npm run dev` on port 3001, at 375px and 1280px wide: the section is the last one (dark), the fees read ₹400, ₹300, Free and ₹200, and the page doesn't scroll sideways.

## Common mistakes

- **Showing the samples on the booking page.** Task 47 must use `readPickupAreas()`, never `selectPickupAreas()`. Otherwise a customer could pick a made-up fee.
- **Reading data inside the booking transaction.** On PGlite it hangs with no error. Read first, then open the transaction.
- **Logging a failed booking write.** Drizzle's error message includes the query's values, the customer's address included. Wrap errors without message or cause, as `LoginServiceError` does.
- **Typing `₹` into a message.** Format the amount with `formatRupees` in code instead.
- **Changing the notice's wording without moving `LOGIN_NOTICE_VERSION`.** `consent.test.ts` fails, on purpose.

## Try it yourself

1. In `src/domain/pickup.test.ts`, add a case: what does `checkPickupInput({ address: "  12,   MG Road  ", postalCode: "412 101" })` return? Work it out first (count the characters after collapsing spaces).
2. In `src/server/db/pickup-tables.test.ts`, try to insert a booking with `pickup_address` set but `pickup_fee_paise` null. Which CHECK refuses it?
3. Bonus: add a fifth sample area in `sample-pickup-areas.ts`, run `npm run dev`, and see it on `/contact`. Then undo it.

## Learn more

- [Drizzle ORM: indexes and constraints](https://orm.drizzle.team/docs/indexes-constraints): how `check(...)` is written in a schema.
- [PostgreSQL: check constraints](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-CHECK-CONSTRAINTS): what the database does with them.
- Next.js `'use cache'`, `cacheTag` and `updateTag`: read the bundled docs in `node_modules/next/dist/docs/` (this project's Next.js 16 is newer than most online guides).

## Review

- **`ce-code-review`** (eight reviewers: correctness, project standards, testing, maintainability, learnings, security, data migration, adversarial; the other-model pass is off in this repo): **"Ready with fixes"**. One confirmed P2: a confirm retried after its area was paused answered `pickup-not-offered` instead of "duplicate", although the booking already existed. Fixed in `fix(24)` (commit 3a87521): the areas are still read before the transaction, but the refusal now comes after the duplicate checks. Two tests were added: that retry, and a saved vehicle booked with pickup. A second point (a reload with a new token answers "duplicate" even if only the new confirm asked for pickup) became a backlog note for task 47.
- **`code-reviewer`**: code ready; one must-fix in this doc (step 5 still described the old order). Fixed here, along with the test count. It also suggested a note in the plan's KTD5 (done) and warned that `LOGIN_NOTICE_VERSION` `2026-11-19` may clash with another session's notice change today: whichever branch merges second moves to `2026-11-19.2` with its own fingerprint.
- **SEO check** (`/contact`, `/privacy`): both Pass. Optional ideas for later: place names next to PIN codes once task 28 has real areas, and "pickup and drop" in `/contact`'s description once the section is live.

## Compound

Yes, one lesson: [idempotent-save-answer-duplicate-before-refusals-that-can-change.md](../solutions/conventions/idempotent-save-answer-duplicate-before-refusals-that-can-change.md). A save with a request token must answer "duplicate" before any refusal that depends on data that can change, or a retry after a lost answer is refused for a booking that exists. Task 23's own refusals have the same shape and are listed there for tasks 25 and 47.
