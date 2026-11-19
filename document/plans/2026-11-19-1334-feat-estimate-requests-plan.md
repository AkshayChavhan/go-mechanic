---
title: Free Estimate Requests - Plan
type: feat
date: 2026-11-19
origin: document/plans/2026-10-24-gomechanic-master-plan.md
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-plan-bootstrap
execution: code
---

# Free Estimate Requests - Plan

## Goal Capsule

- **Objective:** a logged-in customer can ask the garage for a free estimate on `/estimate`: they say which vehicle, describe the problem and add up to 6 photos if they like. They then see their requests on `/account`. Staff can read every request through the data-access layer; the inbox page itself comes after task 26 builds `/admin`.
- **Means:** an `estimate_requests` table, pure rules in `src/domain/estimate-requests.ts`, a save and two reads in `src/server/dal/estimate-requests.ts`, one Server Action, the `/estimate` page with a form island, a section on `/account`, and the privacy notice entry (KTD1–KTD9).
- **Authority:**
  - The master plan: row 32 ("`/estimate` with photos, account view, admin inbox") and features.md item 14.
  - `CLAUDE.md`: Database, Roles and access, Customer data, Bookings, Photos, Languages, and the privacy-notice rule.
  - This plan.
  - Lessons that apply (`document/solutions/`):
    - `conventions/idempotent-save-answer-duplicate-before-refusals-that-can-change.md`
    - `conventions/react-19-form-islands-hydration-action-activity.md`
    - `conventions/signed-upload-links-keep-pending-rows-until-links-expire.md`
    - `conventions/privacy-notice-retention-from-delete-code-not-expiry.md`
    - `conventions/server-action-login-invisible-until-next-request.md`
    - `conventions/pglite-parallel-tests-bare-database-not-transaction-per-call.md`
    - `workflow-issues/parallel-branches-same-migration-number-regenerate-not-rename.md`
- **Stop conditions:**
  - a paid service, or a new npm package (none planned);
  - creating `/admin`, or changing `src/lib/access-routes.ts`, the login page or `src/components/site/navigation.ts` (other sessions' tasks).
- **Who finishes:** Session 2 on branch `32_estimate_requests`. Commit and stop. Push and open the pull request only after the owner says yes.

---

## Product Contract

### Summary

A customer who isn't sure what's wrong, or what it will cost, asks the garage for a free estimate before booking. They pick one of their saved vehicles or choose one with the vehicle picker, describe the problem, and may add photos. The request keeps its own copy of the vehicle. `/account` lists the customer's requests, newest first. Staff read all requests through a permission-checked function that task 26's inbox page will call. Turning a request into a priced estimate is task 33's job.

### Problem Frame

- Customers often can't name the repair they need, so a booking with a fixed list of services doesn't fit them.
- The brief promises a free estimate with photos (features.md item 14).
- Task 30 built the photo uploads for this.
- Task 33 (the estimate builder) needs requests to answer.

### Requirements

**Asking**

- R1. Only a logged-in customer who has given their name can send a request. A guest on `/estimate` sees what the service is and a link to log in. A customer with no name sees a link to `/account`, where the name form is.
- R2. A request names one vehicle: either one of the customer's saved vehicles, or a type, brand, model and fuel chosen with the vehicle picker (no registration number). The request stores a copy of the vehicle (kind, model, fuel, and the registration number when it came from a saved vehicle). A later change to the saved vehicle never changes the request.
- R3. A description of the problem is required: 10 to 1,000 characters after trimming.
- R4. Photos are optional, up to 6, through task 30's `PhotoUploader`. The form can't be sent while a photo is still being resized or uploaded, is picked but not yet sent, or failed and wasn't removed. A failed photo can always be removed, so a bad connection never blocks a text-only request. A posted photo set must belong to the customer, be open, and not already be part of another request.
- R5. Sending the same form twice (a double tap, or a retry after a lost answer) makes one request. A customer can send at most 3 requests in any 24 hours.

**Seeing**

- R6. `/account` lists the customer's requests, newest first. Each shows the date, the vehicle, the start of the description, the number of photos, and "Waiting for the garage". `/account` also has a "Request a free estimate" link.
- R7. Staff with `estimates.manage` (manager, owner) can list every request, newest first. Each row has the customer's name, their phone number only for `customers.contact`, the vehicle, the description and the photo set's id; the photos open through `photoViewUrls`. Anyone else gets `AccessDeniedError`.

**Privacy**

- R8. The privacy notice says what a request stores (the vehicle copy and the description; the photos are covered by "Photos you send us"), why, who sees it, and how long it's really kept. `LOGIN_NOTICE_VERSION` moves.

### Key Decisions

- **The inbox page waits for task 26.** (session-settled: user-directed — chosen over building a small `/admin/estimates` now: `/admin` and its proxy rule belong to Session 1's task 26, and building them here would cause merge conflicts.) Governs R7.
- **Log in first.** (session-settled: user-directed — chosen over an inline login on `/estimate`: photos already need a login, and the shared inline-login helper is still on Session 1's task 47 branch.) Governs R1.
- **A saved vehicle or the picker.** (session-settled: user-directed — chosen over saved vehicles only: a first-time customer shouldn't have to add a vehicle before asking.) Governs R2.
- **Photos optional, up to 6.** (session-settled: user-directed — chosen over requiring a photo: some problems are sounds or warning lights.) Governs R4.

### Scope Boundaries

- **Not built, waiting on other tasks:**
  - the `/admin` inbox page (after task 26);
  - estimates, their lines and statuses beyond "waiting" (task 33);
  - closing the photo set when the estimate closes (tasks 33 and 34);
  - links to `/estimate` from the menu, the footer and the home page (other sessions are changing `navigation.ts`; backlog note);
  - going back to `/estimate` after login (the login page has no return path; task 47 may add one).
- **Considered and not built:**
  - Withdrawing or editing a sent request. Nothing acts on it yet; this would change once task 33 lets the garage answer.
  - A "sent" banner after the redirect. Reading a query string would make `/account` dynamic. The new request at the top of the list confirms it.

---

## Planning Contract

### Key Technical Decisions

- **KTD1. The `estimate_requests` table.** No status column: "waiting" is every request today, and task 33 works a request's state out from its estimates (a column added now would be guessed). Columns:
  - `id` (uuid);
  - `user_id` (restrict, like bookings: task 43 decides deletion);
  - `vehicle_id` (set null);
  - the vehicle copy: `vehicle_kind`, `model_id` (restrict), `fuel`, and `registration_number` (nullable, compact-format CHECK when set);
  - `description` (text, CHECK 10 to 1,000 characters);
  - `photo_set_id` (uuid, unique, `on delete set null`, so photo cleanup and `deletePhotosOfUser` still work);
  - `request_token` (uuid, unique with `user_id`);
  - `created_at`;
  - indexes on `(user_id, created_at)` and on `created_at`.
- **KTD2. Pure rules in `src/domain/estimate-requests.ts`.**
  - `ESTIMATE_REQUEST_RULES`: description 10 to 1,000, at most 3 per 24 hours.
  - `normalizeDescription`: trims, and keeps line breaks.
  - `checkEstimateRequestInput`: vehicle saved or typed, description, an optional photo set id that must be a uuid, a request token that must be a uuid. Problems are tagged by field: `vehicle`, `description`, `photos`, `form`.
- **KTD3. `createMyEstimateRequest` keeps the booking save's order.** `authorizeUser()`, then the input check, then the reads made before the transaction (the saved vehicle through `readMyVehicleForBooking`, or `readVehicleCatalogue` with `resolveVehicle`), kept as values or "problem" flags. Then one transaction:
  1. an advisory lock on the customer;
  2. the request token: if found, answer `duplicate`;
  3. the refusals that can change between tries, each answered only after the duplicate check (the lesson): a saved vehicle that's gone, a model no longer listed, and the photo set (the customer's, open, not used by another request);
  4. the 24-hour limit;
  5. the insert.

  The photo set check is a query on the transaction itself, never a cached read.
- **KTD4. Reads.**
  - `listMyEstimateRequests()` calls `authorizeUser()` and filters by its id. It joins the model and brand for their names, counts stored photos, and returns newest first.
  - `listEstimateRequests({ limit })` calls `authorize("estimates.manage")` first. It adds the phone number only when `can(user.role, "customers.contact")` and returns the newest 50 by default (paging is task 26's choice).
  - Both are live reads at request time, never `'use cache'`.
  - The `estimates.manage` comment in `permissions.ts` names task 32 too. The table itself doesn't change.
- **KTD5. The Server Action `sendEstimateRequest(locale, previous, formData)`** in `src/server/actions/estimates.ts`.
  - It calls `checkedLocale` and `requireUser`, and sends a customer with no name to `/account`.
  - It reads only the form's own fields: `vehicle` (a saved id or `other`), the picker's model and fuel, `description`, `photoSetId`, `requestToken`.
  - `sent` and `duplicate` both redirect to `/account` (replace).
  - Anything else returns the form state with one message per field. Form state and its reader live in `src/lib/estimate-form.ts`.
- **KTD6. The form island `src/components/estimate/estimate-form.tsx`.**
  - It follows `VehicleForm` (`FreshOnEachVisit`, `submitterWithFallback`, labels as props), with one difference: here the visit-level component renders the `<form action={formAction}>` itself.
  - The `<form>`'s direct children are the hidden request-token field, the `PhotoUploader` and the Send button. Only the inner fields (the vehicle choice, the picker and the description, with their errors) are keyed by the submission counter.
  - The visit-level component holds the request token, made in the browser after mount (`crypto.randomUUID()` in an effect; submit is disabled until it's set), and the `PhotoUploader`. Both survive the remount after each answer. So a retry reuses the token, and an error never empties the photos.
  - While Send is disabled because of photos, a hint under it (linked with `aria-describedby`) says why: "Upload your photos first, or remove them", or that photos are uploading. Otherwise the hint is empty.
  - The description is a labelled multi-line field:
    - a shadcn `textarea` added through the CLI to `src/components/ui/`, restyled to the design system and covered by `restyle.test.tsx`;
    - a short hint;
    - a polite live character count against 1,000;
    - one message for each description problem, tied with `aria-invalid` and `aria-describedby`.
  - The vehicle choice is a `ChoiceGroup` of the saved vehicles plus "Another vehicle", which shows the `VehiclePicker`. With no saved vehicles, only the picker shows.
  - The uploader is keyed by the user's id and posts `photoSetId`.
- **KTD7. A `PhotoUploader` addition (task 30's component, this session's own):**
  - an optional `onBusyChange(busy)`: busy while any photo is resizing, ready, uploading or failed;
  - a failed photo gets the same remove button as a ready one. Removing it takes it out of the browser's list only: its pending row keeps its place until the 24-hour cleanup (`conventions/signed-upload-links-keep-pending-rows-until-links-expire.md`). Stored photos stay as they are, since removing one would need a server action;
  - an optional `uploadVariant` prop for the Upload button (the blue default by default; `secondary` on `/estimate`), so Send is the form's only blue button;
  - the hidden set-id field keeps its value through React's form reset after an action, checked by a test.

  Its buttons already have `type="button"`. The remove button on failed photos and the new variant prop are small visible changes: add a sample to `/dev/design` (`test:design` can't run in this session; say so in the learning doc).
- **KTD8. `/estimate` is a public page under `(site)`.**
  - It's built ahead of time, with no `ensureStatic`: the gate streams at request time, like `/account/vehicles/new`'s.
  - Static parts: the heading, a lead, three short steps (describe, add photos, the garage replies), and call or WhatsApp as the way out.
  - `EstimateGate`, inside `<Suspense>`, reads the session. It shows a login link, a link to the name form, or the form fed by `listMyVehicles()`, the cached catalogue and the user's id.
  - Indexable, with a title and description from messages. The sitemap and JSON-LD are task 42's.
- **KTD9. Privacy notice.**
  - `PrivacyPage.items.estimates` is new: what is stored, why, who (the garage and the database host), and how long ("we keep every request for now; nothing deletes them yet"; photos follow their own item).
  - `PrivacyPage.data.lead`, which lists when the website keeps data, adds "when you ask for a free estimate".
  - It's added to `PRIVACY_ITEMS` in `privacy/page.tsx`, a one-line change to task 19's file that CLAUDE.md's privacy rule requires.
  - `coverage.test.ts` lists the table.
  - `LOGIN_NOTICE_VERSION` becomes `2026-11-19.2` (task 24 used `2026-11-19`), or the merge day's date if it merges later, and the fingerprint is pinned again.

### Risks

- **Migration or notice-version clash:** another session's migration `0009` or notice version may land first. Merge `origin/main` right before `db:generate` and again before the pull request. Regenerate, never rename.
- **Photo loss:** an open photo set is deleted 30 days after it started (`PHOTO_RULES.keepOpenDays`), so photos on a request nobody answers within 30 days are lost. Accepted for now. Backlog note for task 33: close the set when the garage answers.
- **Photo set still open after sending:** a sent request's set stays open until task 33 closes it, so a direct `startPhotos` call with its id could still add photos the request didn't have. The normal flow can't do this (each visit starts a new set). Backlog note for task 33: close the set, or refuse uploads to a set a request uses.
- **First production-build photo test:** U6's browser test is the first to run the fake photo storage on `next start` (only `e2e/dev/` has done it under `next dev`). Expect some setup there.
- **Form reset vs the uploader's hidden field:** React 19's form reset after an action could clear it. U5's test proves it survives; if not, the uploader moves outside the `<form>` and posts through the `form` attribute.
- **Description in logs:** the description reaches the insert, and a failed write's error carries the query's values. The action catches nothing, as in task 23. The booking-action wrapper task 47 plans should cover this action too (backlog note).
- **Shared files:** `account-content.tsx` (task 21), `privacy/page.tsx` (task 19) and `/dev/design`'s page (the textarea and uploader samples CLAUDE.md requires) get small additions, which another session could also touch. Keep each edit to a few lines, in its own block, so a merge conflict stays small.

---

## Implementation Units

### U1. Rules

- **Goal:** the pure checks.
- **Requirements:** R2, R3, R4, R5.
- **Dependencies:** none.
- **Files:**
  - create `src/domain/estimate-requests.ts` and `src/domain/estimate-requests.test.ts`.
- **Approach:**
  - follow KTD2;
  - typed vehicle: model and fuel required, fuel checked with `isFuel`;
  - saved vehicle: a non-blank id.
- **Patterns to follow:** `checkBookingInput` and `checkPickupInput`.
- **Test scenarios:**
  - a saved vehicle with a 10-character description passes, trimmed;
  - a typed vehicle with a model and a valid fuel passes;
  - a typed vehicle with a blank model gives `vehicle-missing`;
  - a bad fuel gives `vehicle-fuel-not-offered`;
  - a description of 9 characters gives `description-too-short`;
  - 1,001 characters gives `description-too-long`;
  - only spaces gives `description-missing`;
  - line breaks are kept, and the length is counted by characters (an emoji counts once);
  - a photo set id that isn't a uuid gives `photos-not-found`; a blank one means no photos;
  - a bad request token gives a `form` problem;
  - several problems come back together.
- **Verification:** the tests pass.

### U2. Table and migration

- **Goal:** the `estimate_requests` table.
- **Requirements:** R2, R3, R4, R5.
- **Dependencies:** U1.
- **Files:**
  - modify `src/server/db/schema.ts`;
  - generate `src/server/db/migrations/0009_estimate_requests.sql` and `meta/`;
  - create `src/server/db/estimate-requests-table.test.ts`.
- **Approach:**
  - follow KTD1;
  - `git fetch origin && git merge origin/main`, then `npm install`, right before `npm run db:generate -- --name=estimate_requests`.
- **Patterns to follow:** `bookings` and `pickup-tables.test.ts`.
- **Test scenarios:**
  - a 9-character description is refused by the CHECK;
  - a lowercase registration is refused;
  - two requests on one photo set are refused (unique);
  - deleting the photo set sets `photo_set_id` to null;
  - deleting the saved vehicle sets `vehicle_id` to null and keeps the copy;
  - the same token twice for one user is refused, and for two users is allowed.
- **Verification:** the migration applies on a fresh PGlite; the tests pass.

### U3. Save and reads

- **Goal:** `createMyEstimateRequest`, `listMyEstimateRequests` and `listEstimateRequests`.
- **Requirements:** R2, R4, R5, R6, R7.
- **Dependencies:** U2.
- **Files:**
  - create `src/server/dal/estimate-requests.ts` and `src/server/dal/estimate-requests.test.ts`;
  - modify `src/domain/permissions.ts` (the comment only).
- **Approach:** KTD3 and KTD4. The result union is `sent`, `duplicate`, `problems`, `not-found` (saved vehicle) and `too-many-requests`.
- **Patterns to follow:** `bookings.ts` (lock, token, order) and `customer-vehicles.test.ts` (A cannot touch B).
- **Test scenarios:**
  - logged out throws, before `getDatabase`;
  - a saved vehicle is copied with its registration number;
  - a typed vehicle is copied with a null registration number;
  - another customer's saved vehicle, or a malformed id, gives `not-found`;
  - an unlisted model gives `vehicle-unknown-model`;
  - the same token twice gives one row and a `duplicate`;
  - a retry after the saved vehicle was removed is still `duplicate`;
  - a retry after the model was hidden is still `duplicate`;
  - the photo set belongs to another customer, is closed, or is already used gives `photos-not-found`;
  - a retry with the same set and token is `duplicate`;
  - the 4th request in 24 hours gives `too-many-requests`; one 25 hours old doesn't count;
  - `listMyEstimateRequests` returns only the caller's requests, newest first, with model and brand names and the stored photo count (pending photos not counted);
  - `listEstimateRequests`:
    - a customer and a mechanic each get `AccessDeniedError` before `getDatabase`;
    - a manager and the owner get every request with the phone number;
    - with `can` stubbed so the caller has `estimates.manage` but not `customers.contact`, rows come back without the phone number;
    - the limit applies.
- **Verification:** the tests pass. Break the ownership on purpose (drop `user_id` from a `WHERE`) and a test fails.

### U4. Server Action and form state

- **Goal:** `sendEstimateRequest`.
- **Requirements:** R1, R5.
- **Dependencies:** U3.
- **Files:**
  - create `src/lib/estimate-form.ts`, `src/server/actions/estimates.ts` and `src/server/actions/estimates.test.ts`;
  - modify `messages/en.json` (a new `EstimatePage` namespace).
- **Approach:** KTD5.
- **Patterns to follow:** `addVehicle` in `src/server/actions/account.ts` and its tests.
- **Test scenarios:**
  - a bad locale is refused;
  - logged out redirects to login;
  - no name redirects to `/account`;
  - `sent` redirects to `/account`; `duplicate` does the same;
  - problems return one message per field, with the posted values kept;
  - a posted `userId` is ignored;
  - `vehicle=other` reads the picker's model and fuel; a saved id ignores them.
- **Verification:** the tests pass.

### U5. The `/estimate` page and form

- **Goal:** the page, the gate and the form island, plus the uploader addition.
- **Requirements:** R1, R2, R3, R4.
- **Dependencies:** U4.
- **Files:**
  - create `src/app/[locale]/(site)/estimate/page.tsx`, `page.test.tsx`, `estimate-gate.tsx` and `estimate-gate.test.tsx`;
  - create `src/components/estimate/estimate-form.tsx` and `estimate-form.test.tsx`;
  - add `src/components/ui/textarea.tsx` (shadcn CLI, restyled) and extend `src/components/ui/restyle.test.tsx`;
  - modify `src/components/site/photo-uploader.tsx` and its test, and its sample in `src/app/[locale]/dev/design/page.tsx`;
  - modify `src/i18n/client-messages.ts` only if the island reads messages (prefer props).
- **Approach:** KTD6, KTD7 and KTD8. Lay out the design with the design system (`Section`, `type-*`, one blue button).
- **Patterns to follow:**
  - `src/app/[locale]/(site)/account/vehicles/new/` (page and gate);
  - `vehicle-form.tsx` (visit/fields split, `FreshOnEachVisit`);
  - `photo-uploader.test.tsx`.
- **Test scenarios:**
  - page: renders the heading, steps and call/WhatsApp; metadata has a title and description;
  - gate: logged out shows a login link and no form; no name shows a link to `/account`; with a name shows the form with the saved vehicles;
  - form, vehicle choice: with saved vehicles they show as choices plus "Another vehicle", and picking it shows the picker; with none, only the picker shows;
  - form, description: the textarea shows its hint and count, and each description problem shows its own message;
  - form, sending:
    - submit is disabled until the token is set, and while the uploader says busy, with the hint saying why;
    - the photo set id and the token are posted (they sit inside the `<form>`);
    - an error answer keeps the description and the photos, and puts focus on the first invalid field;
    - the same token is posted on a retry;
    - a new visit gets a new token;
  - uploader:
    - `onBusyChange` is true while a photo is ready or uploading, and false after all are stored;
    - a failed photo blocks sending; after it's removed, the form can be sent;
    - `uploadVariant="secondary"` changes the Upload button's variant;
    - the hidden `photoSetId` survives a form reset.
- **Verification:** the tests pass; `/estimate` under `npm run dev` on port 3001 at 375px and 1280px, logged out and logged in.

### U6. Account section, privacy and e2e

- **Goal:** the customer's list, the notice, a browser test, and the docs.
- **Requirements:** R6, R8.
- **Dependencies:** U3, U5.
- **Files:**
  - create `src/components/account/estimate-request-list.tsx` and its test;
  - modify `src/components/account/account-content.tsx` and its test;
  - modify `messages/en.json` (`MyEstimates`; `PrivacyPage.items.estimates`);
  - modify `src/app/[locale]/(site)/privacy/page.tsx` (`PRIVACY_ITEMS`), `privacy/coverage.test.ts`, `src/domain/consent.ts` and `consent.test.ts`;
  - create `e2e/estimate.spec.ts`;
  - modify `CLAUDE.md` (an "Estimate requests" block and repo-map entries);
  - modify `document/task/task.md` (backlog notes for tasks 26, 33, 47 and the navigation).
- **Approach:**
  - the list is a Server Component given rows as props. When the customer has a request, it sits right under the greeting, above the vehicles, so the request just sent shows on a phone screen after the redirect. With no requests, the "Request a free estimate" link sits below the vehicles;
  - the e2e test logs in with `freshNumber()`, gives a name, sends a request with the picker and one photo (a small JPEG made in the test), and sees it at the top of `/account`;
  - it also checks that a guest on `/estimate` sees the login link.
- **Patterns to follow:** `vehicle-list.tsx`, and `e2e/account.spec.ts` with `logInThroughTheForm`.
- **Test scenarios:**
  - the list shows the date with `formatDate`, the vehicle name, the registration with `formatRegistration` when present, a description cut to about 120 characters, the photo count and "Waiting for the garage";
  - an empty list shows a short line and the link;
  - with a request, the section comes before the vehicles;
  - the privacy page renders the new item, and its lead names estimate requests;
  - `coverage.test.ts` passes with the table listed;
  - the consent fingerprint matches the new version.
- **Verification:** `check` and `test:e2e` pass.

---

## Assumptions

- After logging in from `/estimate`, the customer lands on `/account`, which links to `/estimate`. A return path waits for the login page's owner.
- 3 requests per 24 hours is a placeholder limit the owner can change, like the slot capacity.
- The staff read returns the newest 50. Task 26's page decides paging and filters.

## Verification Contract

- `npm run check` after each unit.
- `npm run test:e2e` once at the end (port 3210; wait and retry if it's taken).
- Never `npm run test:design` (port 3000 belongs to another session).

## Definition of Done

- Every unit's tests pass, and `check` and `test:e2e` pass on the final branch.
- The migration is numbered after `main`'s latest and generated, never renamed.
- No staff page and no change to another session's files beyond the small additions named under Risks ("Shared files").
- The learning doc, `ce-code-review`, `code-reviewer` and the compound question are done (CLAUDE.md task workflow).
