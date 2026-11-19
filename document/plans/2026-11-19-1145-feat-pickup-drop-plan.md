---
title: Pickup and Drop - Plan
type: feat
date: 2026-11-19
origin: document/plans/2026-10-24-gomechanic-master-plan.md
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-plan-bootstrap
execution: code
---

# Pickup and Drop - Plan

## Goal Capsule

- **Objective:** once the owner gives real areas, a booking can carry pickup and drop to an address in a served PIN code, with its fee copied onto it, and `/contact` lists the served PIN codes and fees. Nobody ever sees or books a made-up fee. Showing the fee on the booking page is task 47's.
- **Means:** a `pickup_areas` table that starts empty, pure rules in `src/domain/pickup.ts`, a cached public read, sample areas under `npm run dev` only, a pickup part in `createMyBooking`, a section on `/contact`, and the privacy notice entry (KTD1–KTD7).
- **Authority:** the master plan (row 24, "Pickup areas, 6-digit pincode, fee"; features.md item 13); `CLAUDE.md` (Database, Roles and access, Customer data, Services and prices, Bookings, Languages, the privacy-notice rule); this plan.
  Lessons that apply (`document/solutions/`): `conventions/privacy-notice-retention-from-delete-code-not-expiry.md` (retention from the code that deletes); `workflow-issues/parallel-branches-same-migration-number-regenerate-not-rename.md` (merge `main` right before `db:generate`); `conventions/nextjs-16-dev-server-is-not-one-process-use-cache-probe.md` (no throw inside a cached read, no database in `generateStaticParams`); `conventions/pglite-parallel-tests-bare-database-not-transaction-per-call.md`.
- **Stop conditions:** a paid service; a new npm package (none planned); a change to the `/book` page (task 47) or to another session's code.
- **Who finishes:** Session 2 on branch `24_pickup_drop`. Commit and stop; push and the pull request only after the owner says yes.

---

## Product Contract

### Summary

The garage lists the PIN codes it picks up from, each with one fee for pickup and drop together. A booking may ask for pickup and drop, with an address and a PIN code from that list; the booking keeps a copy of the address, the PIN code and the fee. `/contact` shows the list. Until the owner gives real areas the table is empty: production shows no pickup section and refuses pickup in a booking, and `npm run dev` shows labelled samples.

### Problem Frame

Many customers can't bring their vehicle in during working hours. The booking flow in the brief (features.md item 13) has a pickup step "by pincode, with fee", and task 23 built the booking save without it. The owner hasn't given the served PIN codes or fees yet, and has ruled that no made-up price reaches a customer (2026-10-29).

### Requirements

**Pickup areas**

- R1. A pickup area is one 6-digit Indian PIN code with one fee in paise for pickup and drop together, the same for cars and two-wheelers; a fee of 0 means free.
- R2. An area can be paused (`listed = false`) without losing its fee, so task 28's screen can stop and restart pickup in a PIN code; only listed areas are offered or shown.
- R3. No made-up area or fee is stored: the table is empty in every build until the owner's real list arrives (task 28's screen, or a seed change the owner approves).

**Booking with pickup**

- R4. A booking may ask for pickup and drop by sending an address and a PIN code. Both blank (after trimming) or left out books without pickup, as today; one filled means pickup was asked for, and the blank one gets its problem.
- R5. The address is checked (length, not blank) and the PIN code must be a listed area; otherwise the booking is refused with a problem on the pickup field, before any slot place is taken.
- R6. A booking with pickup stores copies of the address, the PIN code and the fee, so a later fee change never changes it; the slot stays the time the vehicle reaches the garage and takes a place like any booking.
- R7. The confirmation result carries the pickup copy (or none), so task 47 can show the fee next to the services' total.

**What customers see**

- R8. `/contact` shows "Pickup and drop" with each listed PIN code and its fee (or "Free"), only when real areas exist; under `npm run dev` with no real areas, the samples show, marked Sample; otherwise the section is absent.
- R9. The privacy notice says what pickup stores (the address and PIN code on the booking), why, who sees it and how long it's really kept; `LOGIN_NOTICE_VERSION` moves.

### Key Decisions

- **Fees are real-only.** (session-settled: user-directed — chosen over seeding placeholder areas with made-up fees in the database: the owner's 2026-10-29 rule that no made-up price reaches a customer covers fees.) Governs R3, R8.
- **One fee per PIN code, for pickup and drop together, same for every vehicle kind.** (session-settled: user-directed — chosen over a fee per PIN code and vehicle kind, and over one fee everywhere: simplest for customers and staff.) Governs R1.
- **One choice: pickup and drop together.** (session-settled: user-directed — chosen over pickup-only / drop-only / both: avoids half-fee rules.) Governs R4.
- **Shown on `/contact` now.** (session-settled: user-directed — chosen over showing pickup only in task 47's booking page.) Governs R8.

### Scope Boundaries

- Not built: the `/book` page and its pickup step (task 47), editing areas (task 28), area names or maps, a pickup time separate from the slot, saved addresses on the account.
- Considered and not built: the pickup copy in the `duplicate` answer (task 47 shows "already booked, code ...", and task 25's booking detail shows the fee; would change if task 47 needs the fee there).
- Considered and not built: a geocoded distance check (the PIN code is the owner's rule; would change only if the owner asks for distance pricing); a per-booking limit on pickups per slot (the owner hasn't asked; the slot capacity already limits vehicles).
- The FAQ's sample pickup answer (`src/content/faq.ts`) stays a sample until the owner gives the facts (task 40).

---

## Planning Contract

### Key Technical Decisions

- KTD1. `pickup_areas` keyed by `postal_code` (text, CHECK `^[1-9][0-9]{5}$`, matching `isIndianPinCode`), with `fee_paise integer not null` (CHECK `>= 0`), `listed boolean default true`, `created_at`, `updated_at`. No seed function now: an empty table needs none, and `createDatabase` stays as it is (a seed of real areas would be its own owner-approved change). A natural key keeps ids the same in every build worker (the catalogue's reason for text ids).
- KTD2. `bookings` gains three nullable columns: `pickup_address` (text), `pickup_postal_code` (text, no foreign key: a copy, like the vehicle copy) and `pickup_fee_paise` (integer). A CHECK makes all three null or all three set, and the fee `>= 0`. `total_paise` stays the services' total; the fee is shown beside it, so a `no-price` booking still says its fee.
- KTD3. Pure rules in a new `src/domain/pickup.ts`: `PICKUP_RULES` (address 10–200 characters after trimming and collapsing spaces), `checkPickupInput` (address and PIN problems, using `isIndianPinCode` from `garage.ts`), `findPickupArea(areas, postalCode)` (listed only). `checkBookingInput` calls `checkPickupInput` when `pickup` is present, so its problems come back with the others, tagged `field: "pickup"`.
- KTD4. `readPickupAreas()` in `src/server/dal/pickup.ts`: public, `'use cache'`, `cacheTag("pickup-areas")`, `cacheLife("max")`, listed rows ordered by PIN code, an empty list without error. Task 28's save will `updateTag("pickup-areas")`.
- KTD5. `createMyBooking` reads `readPickupAreas()` before the transaction (with the other cached reads) and resolves the area there; an unlisted PIN code returns `problems` with `pickup-not-offered`. Inside the transaction nothing new is read; the copy is written with the booking. Every refusal stays before `reserveSlot` (CLAUDE.md "Bookings").
- KTD6. Samples in `src/content/sample-pickup-areas.ts` (`server-only`), read only through `selectPickupAreas(real)` built on `realOrSamples()`. The `/contact` section lives in the page's own folder (`contact/_components/pickup-areas.tsx`, a Server Component), not in `src/components/site/`, so no `/dev/design` sample is owed. The sample PIN codes are numbers only, with no place names, so nothing made up looks like a fact.
- KTD7. The notice: `PrivacyPage.items.bookings.what` adds the pickup address and PIN code; `who` and `howLong` stay true as written (the garage and the host; bookings aren't deleted yet). `LOGIN_NOTICE_VERSION` becomes the merge day's date (`2026-11-19`, or `.2` if another notice change lands that day), and the fingerprint in `consent.test.ts` is re-pinned.

### Risks

- Another session's migration `0008` or notice version may land first: merge `origin/main` right before `db:generate` and again before the pull request; regenerate, never rename, and pick the version again.
- The fee read is cached and the booking reads it before the transaction: a fee changed in between is booked at the old fee. Accepted: task 28's save is rare, and task 47 shows the fee from the same cached read before confirm.
- The address goes into the booking's insert, and a failed write's error (Drizzle's `DrizzleQueryError`) carries the query's values, so it could reach the logs. Task 47's booking action must wrap unexpected errors without message or cause, as `LoginServiceError` does (backlog note in U6).

---

## Implementation Units

### U1. Pickup rules

**Goal:** the pure checks and lookup.
**Requirements:** R1, R4, R5.
**Dependencies:** none.
**Files:** `src/domain/pickup.ts`, `src/domain/pickup.test.ts`.
**Approach:** KTD3. Types `PickupArea { postalCode, feePaise }`, `PickupInput { address, postalCode }` (strings), `PickupProblem` (`address-missing`, `address-too-short`, `address-too-long`, `postal-code-invalid`, `pickup-not-offered`).
**Patterns to follow:** `src/domain/profile.ts` (`checkName`, character counts), `src/domain/garage.ts` (`isIndianPinCode`).
**Test scenarios:**
- A valid address and PIN code come back trimmed with spaces collapsed.
- Blank, 9-character and 201-character addresses each give their problem; 10 and 200 pass.
- `41210`, `0412101`-style and letters give `postal-code-invalid`; both problems come back together.
- `findPickupArea` finds a listed code, misses an unknown one, and a fee of 0 is a found area.
**Verification:** the tests pass; no framework imports.

### U2. Tables and migration

**Goal:** `pickup_areas` and the booking's pickup columns.
**Requirements:** R1, R2, R3, R6.
**Dependencies:** U1.
**Files:** `src/server/db/schema.ts`, `src/server/db/migrations/0008_pickup_drop.sql` (number as generated), `src/server/db/migrations/meta/`, `src/server/db/pickup-tables.test.ts`, `src/app/[locale]/(site)/privacy/coverage.test.ts`.
**Approach:** KTD1, KTD2. Merge `origin/main`, then `npm run db:generate -- --name=pickup_drop`, then `npm run db:reset` for this folder.
**Patterns to follow:** `bookings-tables.test.ts`, `photos-tables.test.ts`.
**Test scenarios:**
- A fresh database has no pickup areas.
- The PIN CHECK refuses `012345` and `41210`; a negative fee is refused; 0 is accepted.
- A booking with only some pickup columns set is refused; all null or all set passes.
- `coverage.test.ts` lists `pickup_areas` (no personal data) and the three booking columns.
**Verification:** `database.test.ts` (numbering, snapshot chain) and the new tests pass.

### U3. Cached read and samples

**Goal:** what pages and the booking read.
**Requirements:** R2, R3, R8.
**Dependencies:** U2.
**Files:** `src/server/dal/pickup.ts`, `src/server/dal/pickup.test.ts`, `src/content/sample-pickup-areas.ts`, `src/content/sample-pickup-areas.test.ts`.
**Approach:** KTD4, KTD6.
**Patterns to follow:** `readServicePrices` in `src/server/dal/services.ts`; `src/content/sample-prices.ts` and its test.
**Test scenarios:**
- Listed rows come back ordered by PIN code; an unlisted row is left out; an empty table gives `[]`.
- `selectPickupAreas` returns real rows (not samples) when any exist, samples marked `sample: true` under development only, else null.
- The samples file is never imported from a client file (the same check as `sample-prices.test.ts`).
**Verification:** the tests pass.

### U4. Booking with pickup

**Goal:** `createMyBooking` takes and stores pickup.
**Requirements:** R4, R5, R6, R7.
**Dependencies:** U1, U3.
**Files:** `src/domain/bookings.ts`, `src/domain/bookings.test.ts`, `src/server/dal/bookings.ts`, `src/server/dal/bookings.test.ts`.
**Approach:** KTD3, KTD5. `BookingInput.pickup?`, `CheckedBooking.pickup: PickupInput | null`, `BookedBooking.pickup: { address, postalCode, feePaise } | null`. Nothing here logs the address.
**Test scenarios:**
- No pickup: booked as before, pickup columns null.
- A listed PIN code: booked, with the copy and the fee, and the result carries it.
- A fee of 0 is stored as 0, not null.
- An unlisted or hidden PIN code: `problems` with `pickup-not-offered`, and the slot's counter is unchanged.
- A bad address and a bad slot come back together in one `problems` answer.
- Both pickup fields blank books without pickup; only the PIN code filled gives `address-missing`.
- A later fee change leaves the booked fee as it was.
- Logged out: `AccessDeniedError` before `getDatabase` (the existing test still passes).
**Verification:** the tests pass; the order comment at the top of `bookings.ts` still matches the code.

### U5. The `/contact` section

**Goal:** customers see where the garage picks up.
**Requirements:** R8.
**Dependencies:** U3.
**Files:** `src/app/[locale]/(site)/contact/page.tsx`, `src/app/[locale]/(site)/contact/_components/pickup-areas.tsx`, `src/app/[locale]/(site)/contact/page.test.tsx`, `messages/en.json` (`ContactPage.pickup`), `e2e/info-pages.spec.ts`.
**Approach:** KTD6.
1. The section goes last, after the breakdown section; the page calls `pageTones(areas ? 4 : 3)`, so production without areas keeps today's tones.
2. A heading, one line saying the fee covers pickup and drop together for any vehicle, and a two-column table shaped like `ServicePrices` (`th scope="col"` "PIN code" and "Fee for pickup and drop", fee right-aligned, `formatRupees` or the "Free" message, ordered by PIN code).
3. A closing line: PIN code not listed? Call or WhatsApp us.
4. Samples: one `SampleBadge` in the heading and `data-sample="pickup-areas"` on the section, as `ServicePrices` does.
5. No `₹` in messages. The page keeps `ensureStatic`.
**Patterns to follow:** the home page's samples (`SampleBadge`, `data-sample`), `ServicePrices`.
**Test scenarios:**
- Real areas: the section lists each code and fee, "Free" for 0, no Sample badge.
- Samples: one Sample badge in the heading and `data-sample="pickup-areas"` on the section.
- With and without the section, no two neighbouring sections share a tone and the breakdown section keeps its tone when there are no areas.
- Null: no section and no heading.
- Production build: `/contact` stays prerendered and contains no `₹` and no pickup heading (e2e).
**Verification:** the tests pass; the page is `○` in `next build`.

### U6. Privacy notice and docs

**Goal:** the notice and the repo docs say what pickup does.
**Requirements:** R9.
**Dependencies:** U2, U4.
**Files:** `messages/en.json` (`PrivacyPage.items.bookings.what`), `src/domain/consent.ts`, `src/domain/consent.test.ts`, `CLAUDE.md`, `document/task/task.md`.
**Approach:** KTD7. `CLAUDE.md` gets a short "Pickup and drop" block and repo-map entries; `task.md` gets backlog notes for task 28 (edit and pause areas, `updateTag("pickup-areas")`; a full pickup booking can first be tried end to end then), 47 (the pickup step shows only from `readPickupAreas()`, never the samples, so it's hidden until real areas exist; show the fee beside the total; wrap unexpected booking errors so the address never reaches logs) and 43 (the address is deleted with the bookings).
**Test scenarios:** `consent.test.ts` pins the new wording and version.
**Verification:** `npm run check` passes.

---

## Verification Contract

- `npm run check` (lint, typecheck, unit tests) after each unit.
- `npm run test:e2e` once at the end (port 3210; wait and retry if taken).
- Never `npm run test:design` (port 3000 belongs to another session); a look at `/contact` under `npm run dev` on port 3001 confirms the samples.

## Definition of Done

- Every unit's tests pass, and `check` and `test:e2e` pass on the final branch.
- The migration is numbered after `main`'s latest, generated (never renamed).
- No made-up fee in the database or a production build.
- The learning doc, `ce-code-review`, `code-reviewer` and the compound question are done (CLAUDE.md task workflow).
- No leftover experimental code in the diff.
