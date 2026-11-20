---
title: Customer Reviews - Plan
type: feat
date: 2026-11-19
origin: document/plans/2026-10-24-gomechanic-master-plan.md
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-plan-bootstrap
execution: code
---

# Customer Reviews - Plan

## Goal Capsule

- **Objective:** a customer whose job is completed can review it (stars and an optional comment) from `/account`. Visitors read every published review on `/reviews`. Once 3 reviews exist, the home page shows the average rating and the latest reviews. Staff can hide a review or reply to it through the data-access layer; their page comes with task 26.
- **Means:** a `reviews` table that keeps a copy of who and which vehicle (KTD1), rules in `src/domain/reviews.ts`, a save, a cached public read and staff functions in `src/server/dal/reviews.ts`, a Server Action, a review page under `/account`, a section on `/account`, the `/reviews` page, the home page switch, and the privacy notice (KTD1–KTD11).
- **Authority:**
  - the master plan, row 37;
  - features.md items 6 and 27;
  - the owner's decisions of 2026-11-19 (Key Decisions);
  - `CLAUDE.md`: Database, Roles and access, Customer data, Services and prices (draft models), Languages, Design system, and the privacy-notice rule;
  - this plan;
  - the lessons in `document/solutions/`: the idempotent-save lesson (including its lock-filter section), the React 19 form islands lesson, the privacy-notice retention lesson, the Next.js 16 dev-server lesson, the parallel-branches migration lesson, and the new-enum-value lesson.
- **Stop conditions:**
  - a paid service or a new npm package (none planned);
  - creating `/admin`;
  - changing `src/lib/access-routes.ts` or `src/components/site/navigation.ts` (other sessions are changing them).
- **Who finishes:** Session 2, on branch `37_reviews`. Commit and stop. Push and open the pull request only after the owner says yes.

---

## Product Contract

### Summary

After the garage completes a job, the customer sees it on `/account` with a "Write a review" button. The button opens a review page with:

- 1 to 5 stars, required;
- a comment of up to 1,000 characters, optional;
- a preview of how the review will be credited, such as "Asha, Honda car".

The review is public as soon as it's sent. `/reviews` lists every published review, newest first, with the average and the count. The home page's reviews section and its rating stat switch from dev-only samples to real reviews once 3 are published. Staff can hide a review, show it again, or reply, through functions that task 26's admin page will call.

### Problem Frame

Reviews are the home page's last made-up content. The owner decided on 2026-10-27 that only real reviews may reach customers, and task 31 has just made "completed" real. No page lists a customer's bookings yet (task 25), so task 37 adds the first list of completed jobs.

### Requirements

- **R1.** Only the booking's own customer can review it, and only once the job is completed. Each booking gets one review.
- **R2.** A review is 1 to 5 whole stars plus an optional comment of up to 1,000 characters. A second send of the same form creates no second review.
- **R3.** A review is credited with the customer's first name and the vehicle's brand and type ("Asha, Honda car"; "Ravi, TVS two-wheeler"). The first name is copied when the review is sent. The vehicle comes from the booking's own copy, which never changes. The form shows the credit before sending, and says the review is public as soon as it's sent, can't be edited, and can be hidden by the garage on request. The model ("City") is shown only once the owner has approved the draft models (task 39).
- **R4.** A review is public at once. Staff with `content.edit` (manager, owner) can hide it, show it again, or set and clear one reply, which is shown under the review. A hidden review is left out of `/reviews`, the average and the home page.
- **R5.** `/reviews` lists the published reviews, newest first, with the average (one decimal) and the count. With none, it says so and explains how to leave one.
- **R6.** The home page shows its reviews preview and the rating only when at least 3 reviews are published. The preview always has 3 cards: the newest reviews with a comment first, topped up with the newest stars-only ones. It also shows the average, the count and a link to `/reviews`. With fewer than 3, a production build shows neither, and `npm run dev` keeps the samples.
- **R7.** The rating stat's only source is this site's reviews. Its label stops saying "Google".
- **R8.** `/account` lists the customer's completed jobs. Each one shows "Write a review" or the stars the customer gave.
- **R9.** The privacy notice says what a review stores, that the first name and vehicle are public with it, who sees it, and how long it's kept. `LOGIN_NOTICE_VERSION` moves.

### Key Decisions

- **Public at once; staff can hide or reply** (session-settled: user-directed, chosen over approve-first: no waiting, and reviews look less hand-picked). Governs R4.
- **First name and vehicle** (session-settled: user-directed, chosen over vehicle only or customer's choice). Governs R3.
- **Brand and type until the models are approved** (session-settled: user-directed, chosen over showing the draft model: CLAUDE.md keeps draft models off the live site until task 39). Governs R3.
- **Written from `/account`** (session-settled: user-directed, chosen over building the engine only). Governs R8.
- **Home page shows reviews from 3 published** (session-settled: user-directed, chosen over showing from the first). Governs R6.
- **The rating stat comes from the site's own reviews** (session-settled: user-directed, chosen over the owner's Google rating). Governs R7.
- **The staff reply-and-hide page waits for task 26**, as task 32's inbox did. Governs R4.

### Scope Boundaries

Considered and not built:

- **Editing or deleting a review in the app.** A customer who wants a review gone calls the garage, and staff hide it. The notice says so.
- **Spam or language filtering.** Every reviewer has a real login and a completed job, and staff can hide a review. Revisit if abuse appears.
- **Review photos.** No one asked for them.

Not this task:

- the `/admin` page (26);
- a "Reviews" link in the menu or footer (another session owns `navigation.ts`; a backlog note);
- `AggregateRating` structured data (42);
- deleting reviews with a customer's data (43);
- showing the model after approval (39).

---

## Planning Contract

### Key Technical Decisions

- **KTD1. The `reviews` table** (migration `0011_reviews`):
  - Columns: `id`, `booking_id` (unique, fk bookings `cascade`), `user_id` (fk users `restrict`, like bookings), `request_token` (uuid, unique with `user_id`), `rating` (integer, CHECK 1–5), `comment` (text, nullable, CHECK `char_length` 1–1000, counted in code points like `typedLength`).
  - Copy: `shown_name` (CHECK 1–60). The vehicle isn't copied: the booking already keeps its own unchanging copy (kind and model), and the review can't outlive it (`cascade`). Reads join bookings → models → makes for the brand, type and, after task 39, the model.
  - Times: `created_at`.
  - Moderation: `hidden_at` and `hidden_by`, `reply` (CHECK 1–1000), `replied_at` and `replied_by` (fks to users, `set null`).
  - An index on `(hidden_at, created_at)` for the public read.
- **KTD2. The first name is the first word of `users.name`** as `checkName` normalised it ("Asha Patil" → "Asha"; "A. Patil" → "A."). It's copied at send time, like a booking copies its vehicle, so a later name change never rewrites a public review. A customer with no name is sent to `/account`, as with `/estimate`.
- **KTD3. The save, `createMyReview`, keeps the repo's order:**
  1. Before the transaction: `authorizeUser()`, the input check, then `readMyProfile()`.
  2. (No customer advisory lock: there's no per-customer limit to guard. The booking-row lock and the unique `booking_id` cover a race on one booking.)
  3. In the transaction, lock the booking with `select … for update`, filtered by id, the user and `job_status = 'completed'`.
  4. The token lookup, by user and token: if it exists, answer `duplicate` with its id. This runs whether or not the lock found a row, per the lesson's lock-filter section.
  5. `not-found` when no booking row came back.
  6. An existing review for the booking: `already-reviewed` with its id.
  7. Insert with `on conflict do nothing`. A clash answers `already-reviewed`.
- **KTD4. One cached public read, `readPublishedReviews()`.** It uses `'use cache'`, `cacheTag("reviews")` and `cacheLife("max")`. It returns every published review, newest first, with its brand name and an `average` and a `count`. Every write calls `updateTag("reviews")` after its commit: the save's Server Action, and the staff functions `hideReview`, `showReview`, `setReviewReply` and `clearReviewReply`, which call it themselves, like `saveGarage`. So they can only be called from Server Actions, which their comments say.
- **KTD5. Staff functions** (`hideReview`, `showReview`, `setReviewReply`, `clearReviewReply`) use `authorize("content.edit")`. Its table comment already names tasks 37–40, so the permission table doesn't change. The staff list of reviews, hidden ones included, waits for the page that shows it (task 26 or its split-out task), which will design its filters.
- **KTD6. The review page is `/account/reviews/[bookingId]`.**
  - It sits under `/account`, so the proxy already sends a logged-out visitor to `/login` with a 307.
  - There's no `generateStaticParams`. The shell (heading, intro) is prerendered, and `params` is awaited inside `<Suspense>` by `ReviewGate`, as `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md` ("Without generateStaticParams") describes.
  - It's noindex.
  - `ReviewGate` reads the session and `readMyReviewTarget(bookingId)`, which returns the booking's vehicle, credit preview and status: can review, already reviewed, or not found.
  - It renders the form, a note, or the 404 content.
- **KTD7. `ReviewForm` is a client island modelled on `EstimateForm`:**
  - a new site component, `StarRatingInput`:
    - five native radios in a `fieldset` with a legend ("Your rating");
    - each label at least 44px square, a star filled up to the chosen one;
    - the chosen state shown by shape (filled vs outline), not colour alone;
    - a focus ring on the label;
    - accessible names ("3 out of 5 stars");
    - the field error under the group.
    It works before hydration and gets a `/dev/design` sample.
  - a `Textarea`, with a counter of characters left (counted like `checkReviewInput`, no `maxLength`, which counts differently);
  - above the button, a note: "Shown publicly as soon as you send it, with your first name and vehicle. You can't edit it here; call the garage if you want it hidden." It has a link to `/privacy`.
  - States, each from messages:
    - the loading line;
    - "Sending…";
    - the rating and comment errors at their fields;
    - "no connection";
    - "already reviewed", with its stars and links;
    - "not found";
    - the thank-you panel.
  - the request token made on the first send;
  - `FreshOnEachVisit` keyed by user and booking;
  - the answer remounts it.
  - On success it shows a "Thank you" panel with links to `/reviews` and `/account`.
- **KTD8. Credit and display.**
  - `ReviewCard` takes a review of type `{ id, rating, comment: string | null, kind: VehicleKind, credit: { name, makeName } | null, reply: string | null }`. `kind` sits outside the credit, so samples keep "Sample customer, car" or "…, two-wheeler".
  - A `variant`: `preview` (home) clamps the comment to 4 lines and leaves the reply out; `full` (`/reviews`) shows the whole comment, and the reply in its own block under the quote, outside the `blockquote`.
  - A stars-only card shows its stars and credit and no quote element.
  - `/dev/design` gets samples for a long comment, a reply and stars only.
  - A sample's credit stays "Sample customer, car".
  - The credit's text comes from messages ("{name}, {make} {kind}").
  - The reply shows as "Reply from the garage".
  - A review without a comment shows its stars and credit only. The home preview picks reviews with a comment.
- **KTD9. The home page and the samples.**
  - `selectReviews(real)` and `selectRating(real)` take the cached read's result.
  - Real data is used when `count >= 3`. Otherwise the dev samples are used under `npm run dev`, else null. The 3 cards are the newest with a comment first, topped up with the newest stars-only ones.
  - The samples stay, for `/dev/design` and dev design checks. This replaces the tracker's "delete `sampleReviews`" step, with the reason written there.
  - The rating moves out of the four-stat grid into the reviews section's header: "4.7 out of 5 · 12 reviews", with a link to `/reviews` outside any reveal group. `selectTrustStats` drops the `rating` id, and its label stops being "Google rating". The stat grid becomes 3 tiles (`grid-cols-1 sm:grid-cols-3`), and its `/dev/design` sample follows.
  - The production sample scan in `e2e/home.spec.ts` changes to search only sample-only text (the canary and the sample comments and credit), not section titles, which real reviews also use.
- **KTD10. `/reviews`** is a prerendered `(site)` page with `ensureStatic = "navigation"`. It reads `readPublishedReviews()` and uses metadata in the `FaqPage` style. It lists the 100 newest; paging waits until there are more. Its tones come from `pageTones`. With none, it shows the empty state and a line about how to leave a review (from `/account` after a completed job).
- **KTD11. `/account` gets a "Your completed jobs" section** from `listMyCompletedJobs()`:
  - Completed bookings, newest first, at most 10.
  - Each row shows the vehicle, the completed date (`formatIndiaDate`, from its completing job update), the booking code, and either its stars or a secondary (grey) "Write a review" button. The page's one blue button stays "Add a vehicle".
  - It's shown only when the list isn't empty, after the estimate requests and before the vehicles.

### Risks

- **Parallel migration numbers.** Merge `origin/main` right before `db:generate`. If another session lands `0011` first, regenerate, never rename.
- **e2e can't make a completed job** (no admin page, and each process starts a fresh database). The write flow and the 3-review threshold are proven in Vitest. e2e covers the empty `/reviews`, that no sample leaks in production, and that the review page redirects when logged out (a 307).
- **A public review needs a way to hide it.** Reviews go public at once, and nothing in this task can hide one without the database. So the staff hide-and-reply screen must ship no later than the first screen that moves a job to "completed". This goes in `task.md` as a dependency on whichever task (26, or one split from it) ships job completion.
- **The home page's cached read.** Its `updateTag` only refreshes the process that wrote. That's fine for one server, and task 20 checks it on Vercel.

---

## Implementation Units

### U1. Review rules

- **Goal:** the pure rules.
- **Requirements:** R2, R3.
- **Dependencies:** none.
- **Files:** `src/domain/reviews.ts` and its test.
- **Approach:**
  - `REVIEW_RULES`: `commentMaxLength` 1000, `minForHome` 3.
  - `checkReviewInput({ bookingId, rating, comment, requestToken })` returns problems tagged by field: `rating-missing`, `rating-invalid`, `comment-too-long`, `bad-request`. The comment is cleaned with `normalizeTypedText`.
  - `firstName(name)`.
  - `averageRating(ratings)`, rounded to one decimal.
- **Test scenarios:**
  - Ratings 1–5 pass; 0, 6, "4.5" and blank are refused.
  - A blank comment becomes null.
  - 1,000 emoji pass; 1,001 characters are too long.
  - A token or booking id that isn't a uuid is a bad request.
  - `firstName`: "Asha Patil" → "Asha"; "A. Patil" → "A."; a single word stays itself; Devanagari works.
  - The average: [5, 4, 4] → 4.3; an empty list → null.
- **Verification:** the domain tests pass.

### U2. Table and migration

- **Goal:** KTD1.
- **Requirements:** R1–R4.
- **Dependencies:** U1.
- **Files:**
  - `src/server/db/schema.ts`;
  - `src/server/db/migrations/0011_reviews.sql`, with its meta files;
  - `src/server/db/reviews-table.test.ts`.
- **Test scenarios:**
  - A second review for one booking is refused.
  - A rating of 0 or 6 is refused.
  - An empty comment or reply is refused, and so is one over 1,000 characters.
  - One token twice for one user is refused.
  - Deleting a booking deletes its review.
  - Deleting a staff user nulls `hidden_by` and `replied_by`.
- **Verification:** the table tests pass, and `db:generate` shows no further changes.

### U3. Save, reads and staff functions

- **Goal:** KTD3–KTD5, plus the account and gate reads.
- **Requirements:** R1–R8.
- **Dependencies:** U2.
- **Files:** `src/server/dal/reviews.ts` and `src/server/dal/reviews.test.ts`.
- **Approach:**
  - `createMyReview`.
  - `listMyCompletedJobs`.
  - `readMyReviewTarget`.
  - `readPublishedReviews` (cached).
  - `hideReview`, `showReview`, `setReviewReply`, `clearReviewReply`.
- **Execution note:** after the tests pass, break the user filter and the duplicate order on purpose. A test must fail each time. Record it in the learning doc.
- **Test scenarios:**
  - Logged out: `AccessDeniedError` before `getDatabase`, for the save and the customer reads.
  - Another customer's booking, a job not completed and a missing id give the same `not-found`.
  - A completed own booking gets `sent`, with the first name copied.
  - A second send with the same token is `duplicate`, even after a staff member hides the review.
  - A new token on a reviewed booking gets `already-reviewed`.
  - A customer with no name gets `needs-name`.
  - Staff: a customer and a mechanic get `AccessDeniedError` before the database. A manager hides a review, shows it again, sets a reply and clears it, and `updateTag("reviews")` is called each time.
  - `readPublishedReviews` leaves hidden reviews out, lists newest first, and returns the average and count.
  - `listMyCompletedJobs` lists only the caller's completed bookings, each with its review's stars.
- **Verification:** the data-access tests pass, and so do the mutation checks.

### U4. Server Action, review page and form

- **Goal:** KTD6 and KTD7.
- **Requirements:** R1–R3, R8.
- **Dependencies:** U3.
- **Files:**
  - `src/lib/review-form.ts`;
  - `src/server/actions/reviews.ts` and its test;
  - `src/app/[locale]/(site)/account/reviews/[bookingId]/page.tsx` and its test;
  - `review-gate.tsx` and its test;
  - `src/components/reviews/review-form.tsx` and its test;
  - `messages/en.json`, a new `ReviewPage` namespace (also listed in `src/i18n/client-messages.ts` only if the island reads it; labels go in as props).
- **Approach:**
  - The action, `sendReview(locale, previous, formData)`: `checkedLocale`, `requireUser`, `createMyReview`, then `updateTag("reviews")` on `sent`.
  - It answers every other result as form state, except `needs-name`, which redirects to `/account`.
- **Test scenarios:**
  - The action: logged out redirects; `sent` calls `updateTag`; `duplicate` answers like `sent` (the thank-you panel); `already-reviewed` and `not-found` show messages; input problems map to fields.
  - The gate: a guest gets the login link; no name gets the `/account` link; another person's or a missing booking gets the not-found content; an already reviewed booking gets "you've reviewed this" with its stars; otherwise the form appears with the credit preview "Asha, Honda car".
  - The form: a star chosen before hydration is kept; the same token is reused on retry; the thank-you panel appears; it starts fresh on each visit; the public note and the characters-left counter show.
  - `StarRatingInput`: five radios in a fieldset, a name for each, the error under the group.
- **Verification:** the tests pass, and the page builds with a static shell.

### U5. Public display: `ReviewCard`, `/reviews`, the home page and `/account`

- **Goal:** KTD8–KTD11.
- **Requirements:** R4–R8.
- **Dependencies:** U3.
- **Files:**
  - `src/components/site/review-card.tsx` and its test;
  - `src/content/home.ts` and its test;
  - the home `page.tsx`, `_components/home-reviews.tsx`, `_components/home-stats.tsx` and their tests;
  - `src/app/[locale]/(site)/reviews/page.tsx` and its test;
  - `src/components/account/completed-jobs.tsx` and its test;
  - `account-content.tsx`;
  - `messages/en.json`: the `ReviewsPage` and `MyReviews` namespaces, plus the `HomePage.reviews` and `HomePage.stats` keys that change;
  - the `/dev/design` review card block;
  - `e2e/home.spec.ts`;
  - `e2e/reviews.spec.ts`.
- **Test scenarios:**
  - The card: stars and a screen-reader rating; the credit "Asha, Honda car"; the reply under "Reply from the garage"; no comment means no quotation; a sample is still marked as one.
  - The home page:
    - 2 real reviews in production: no reviews section, no rating;
    - 3 or more: the section shows 3 cards, the average, the count and the link;
    - 3 published with only 1 comment: 3 cards, the commented one first, then two stars-only;
    - under dev with no reviews: the samples.
  - `/reviews`: the list newest first, the average and count, and the empty state.
  - The account: completed jobs show "Write a review" or the stars.
  - e2e:
    - `/reviews` in production shows the empty state and has a title;
    - the review page logged out answers a 307 to `/login`;
    - no sample text reaches the production home page.
- **Verification:** the tests and `test:e2e` pass, the `/dev/design` sample is updated, and the design suite passes on port 3001.

### U6. Privacy notice and docs

- **Goal:** R9, plus the repo docs.
- **Requirements:** R9.
- **Dependencies:** U2–U5.
- **Files:**
  - `messages/en.json`: a new `PrivacyPage.items.reviews` item, and `items.name.who` and `items.name.howLong` (a review keeps its own copy of the first name: changing or deleting the name doesn't change a review already sent, and hiding one keeps it stored until task 43 deletes reviews with a customer's data);
  - `privacy/page.tsx` (`PRIVACY_ITEMS`) and its test;
  - `coverage.test.ts`;
  - `consent.ts` and `consent.test.ts`;
  - `CLAUDE.md` (a "Reviews" section and repo-map entries);
  - `task.md` (steps and backlog lines: the navigation link; the staff page and its review list, which must ship by the first job-completion screen; 39's model credit; 42's structured data; 43's deletion).
- **Approach:**
  - The retention comes from the delete code: nothing deletes reviews yet, a hidden one stays stored, and deleting a booking deletes its review.
  - Move `LOGIN_NOTICE_VERSION` to the next value after `origin/main`'s at the time.
- **Test scenarios:** the coverage test lists the `reviews` table, and the fingerprint is pinned again.
- **Verification:** `npm run check` passes.

---

## Assumptions

- The comment is optional; stars alone are a review.
- The review can't be edited after sending.
- "First name" means the first word of the saved name.

## Verification Contract

- `npm run check` passes. Timeouts that come only from machine load get a rerun; never raise the time limits.
- `npm run test:e2e` passes.
- The design suite passes on port 3001 through a temporary config.
- The SEO review runs for `/reviews`, the home page, `/account` and `/privacy`.

## Definition of Done

- U1–U6 are done and their tests pass.
- The mutation checks are recorded.
- Migration `0011` is the last one on top of `origin/main`.
- `CLAUDE.md`, `task.md` and the learning doc are updated.
- Both reviews have run, and their must-fixes are fixed.
- No leftover experimental code.
