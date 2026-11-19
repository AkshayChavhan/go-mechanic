# 37_reviews: customers review a completed job, and visitors read the reviews

> **Branch:** `37_reviews` · **Date:** 2026-11-19 · **Status:** In progress

## In one minute

A customer whose job is completed can now give it 1 to 5 stars and an optional comment, from `/account`. The review is public at once on the new `/reviews` page. Once 3 reviews are published, the home page shows the average rating, the count and 3 review cards, instead of the dev-only samples it had until now. Staff can hide a review or reply to it through data-access functions; their screen comes with task 26.

Full details: [the plan](../plans/2026-11-19-2019-feat-customer-reviews-plan.md) (R1–R9, KTD1–KTD11, units U1–U6) and the "Reviews" block in `CLAUDE.md`.

**Built in parallel.** Two other Claude sessions worked at the same time, each in its own git worktree. This was Session 2, in `go-mechanic-s2`. There was no merge conflict. Migration `0011_reviews` sits on top of `main`'s `0010`, and `LOGIN_NOTICE_VERSION` moved from `2026-11-19.3` to `2026-11-19.4`.

## Why: the problem we solved

Reviews were the home page's last made-up content. The owner decided on 2026-10-27 that only real reviews may reach customers, so a production build showed no reviews at all. Task 31 had just made "completed" a real job step, so a real review could finally be tied to real work.

The owner's decisions (2026-11-19):

- **Public at once**, with staff able to hide or reply. No waiting for approval, and reviews look less hand-picked.
- **Credited with the first name and the vehicle.**
- **Brand and type only, for now:** "Asha, Honda car", not "Asha, Honda City". A `CLAUDE.md` rule keeps the draft vehicle models off the live site until the owner checks them (task 39). The research for the plan caught that "Asha, Honda City" would break that rule, and the owner chose brand and type.
- **Written from `/account`.**
- **The home page shows reviews from 3 published.** One or two lonely reviews look worse than none.
- **The rating has one source: the site's own reviews.** It left the trust stats (it used to say "Google rating").

Claude's default: **the staff page waits for task 26**, as task 32's inbox did.

## What: what changed

| File or folder | Change | Why it exists |
| --- | --- | --- |
| `src/domain/reviews.ts` (+ test) | Added | `REVIEW_RULES` (1,000 characters, 3 for the home page), `checkReviewInput`, `firstName`, `averageRating` |
| `src/server/db/schema.ts`, `migrations/0011_reviews.sql`, `meta/` | Changed / Added | The `reviews` table: one per booking, rating CHECK 1–5, comment, `shown_name`, request token, hide and reply columns |
| `src/server/db/reviews-table.test.ts` | Added | Proves each CHECK, unique key and foreign key on a fresh database |
| `src/server/dal/reviews.ts` (+ test) | Added | `createMyReview`, `listMyCompletedJobs`, `readMyReviewTarget`, the cached `readPublishedReviews`, and staff `hideReview`, `showReview`, `setReviewReply`, `clearReviewReply` |
| `src/lib/review-form.ts` | Added | The review form's state, shared by the action and the form |
| `src/server/actions/reviews.ts` (+ test) | Added | `sendReview`: `requireUser`, then `createMyReview` |
| `src/app/[locale]/(site)/account/reviews/[bookingId]/` | Added | The review page (prerendered shell) and `ReviewGate`, which reads the id and session inside `<Suspense>` |
| `src/components/reviews/review-form.tsx` (+ test) | Added | The client island: stars, comment with characters left, the public note, the thank-you panel |
| `src/components/site/star-rating-input.tsx` (+ test) | Added | Five native radios with 44px stars that fill by CSS alone |
| `src/components/site/review-card.tsx` (+ test) | Changed | The real credit, a `preview` and a `full` variant, the garage's reply, stars-only cards |
| `src/components/account/completed-jobs.tsx` (+ test), `account-content.tsx` | Added / Changed | "Your completed jobs" on `/account`, each with "Write a review" or its stars |
| `src/app/[locale]/(site)/reviews/page.tsx` (+ test) | Added | `/reviews`: every published review, the average and the count, or the empty state |
| `src/content/home.ts` (+ test), `(site)/page.tsx`, `_components/home-reviews.tsx`, `home-stats.tsx` | Changed | Real reviews from 3; the rating moved into the reviews section; the stat grid is 3 tiles |
| `src/app/[locale]/dev/design/page.tsx`, `MASTER.md` | Changed | Samples and notes for the star rating and the review card |
| `messages/en.json` | Changed | `ReviewPage`, `ReviewsPage`, `MyReviews`, the home page's changed keys, the privacy notice |
| `src/domain/consent.ts` (+ test), `privacy/page.tsx`, `privacy/coverage.test.ts` | Changed | `LOGIN_NOTICE_VERSION` `2026-11-19.4`, a "Your reviews" item, the `reviews` table listed |
| `e2e/reviews.spec.ts`, `e2e/home.spec.ts`, `e2e/dev/home-preview.spec.ts` | Added / Changed | 3 new production tests; the sample scan; the design checks' new expectations |
| `CLAUDE.md`, `task.md` | Changed | The "Reviews" rules; backlog notes for tasks 20, 26, 39, 42, 43 and the menu link |

## How: step by step

1. **Plan, then review the plan.** `ce-plan` wrote the plan, then six reviewers read it. They changed it before any code existed:
   - **Dropped the vehicle copy columns.** The booking already keeps its own unchanging copy of the vehicle, and a review is deleted with its booking (`cascade`), so a second copy added nothing.
   - **Dropped an advisory lock** on the customer. There is no per-customer limit to guard; the booking row lock and the unique `booking_id` cover a race.
   - **Left the staff review list for task 26's page**, which will design its filters.
   - **Added the public note on the form**: shown publicly at once, with your first name and vehicle; call the garage to hide it.
   - **A `StarRatingInput` with 44px targets.**
   - **The home preview always has 3 cards**: the newest with a comment first, topped up with stars-only reviews.
   - **A 3-tile stat grid**, now that the rating left it.
   - **The privacy notice's name promise:** a review keeps its own copy of the first name, so changing your name doesn't change a sent review.
   - **Recorded a dependency:** nothing in this task can take a public review down without the database, so the staff hide screen must ship no later than the first screen that moves a job to "completed" (a backlog line in `task.md`).
2. **The rules (U1).** `src/domain/reviews.ts`. `firstName("Asha Patil")` is `"Asha"`; `averageRating([5, 4, 4])` is `4.3`.
3. **The table (U2).**
   ```bash
   npm run db:generate -- --name=reviews   # wrote 0011_reviews.sql + meta/
   ```
   The `--` passes `--name` through npm to drizzle-kit. **A slip:** the first table commit (`464f9e5`) was made while one table test failed. Two test bookings shared one request token, so the second booking hit the bookings table's own unique key before reaching the review constraint under test. The next commit (`24117db`) gave each booking its own token. A commit should only follow a green run.
4. **The save and the reads (U3).** `createMyReview` keeps the repo's idempotent-save order: lock the booking row through a filter (yours, completed), then look up the caller's own token (`duplicate`) whether or not the lock found a row, then `not-found`, `already-reviewed`, `needs-name`, then the insert with `on conflict do nothing`.
5. **The page and form (U4).** `/account/reviews/[bookingId]` has no `generateStaticParams`, so the id is read inside `<Suspense>` (see New ideas).
6. **Public display (U5).** `/reviews`, the home switch, the cards, and "Your completed jobs" on `/account`.
7. **Privacy notice (U6).** A new "Your reviews" item, and "Your name" now says a review keeps its own copy of the first name.

## Decisions worth knowing

- **`sampleReviews` was kept.** The tracker's task-13 step said "delete `sampleReviews`". It stays on purpose: it shows only under `npm run dev`, and `/dev/design` and the design checks need it, like the other content files' samples. The production scan in `e2e/home.spec.ts` now searches only sample-only text (the canary, the sample comments and credit), because real reviews use the section's own titles too.
- **The first name is a copy (`shown_name`).** Like a booking copying its vehicle: a later name change never rewrites a public review.
- **The model is already read, just not shown.** `readPublishedReviews` returns `modelName`, so task 39 only has to show it.
- **A comment and a reply are plain text**, shown with `whitespace-pre-line`, never as HTML.

## New ideas in this task

- **A cached read with `cacheTag` and `updateTag`:** `readPublishedReviews()` starts with `'use cache'`, `cacheTag("reviews")` and `cacheLife("max")`. Next.js keeps its answer and builds `/reviews` and the home page with it ahead of time. Every write then calls `updateTag("reviews")`, which throws the kept answer away so the next visitor gets fresh reviews. Like a shop's price board: it stays up until someone changes a price and rewrites it. `updateTag` only works inside a Server Action, so the staff functions must be called from one.
- **A dynamic route segment read inside `<Suspense>`:** `[bookingId]` in the folder name means "any value here". With Cache Components on and no `generateStaticParams`, the id is only known per request, so it counts as runtime data. The page builds its heading and intro ahead of time and reads the id inside `<Suspense>` with `params.then(...)`, as `dynamic-routes.md` ("Without generateStaticParams") shows. The visitor sees the shell at once; the form streams in.
- **`:has()` CSS for stars that work before hydration:** `:has()` lets a CSS rule ask "does this element contain something?". Each star's `<label>` holds a hidden radio. The classes `has-checked:` and `has-[~label_input:checked]:` say "fill this star if its own radio, or a later star's, is checked". So the stars fill with no JavaScript at all, before React has loaded ("hydration" is React taking over server HTML in the browser).
- **A snapshot (copy) column:** a column that stores a value as it was at one moment, not a link to the live value. `shown_name` is the first name on the day the review was sent.
- **A request token:** a random id the form makes on the first send and reuses on every retry. If the same token arrives twice, the server answers `duplicate` with the first review instead of saving a second one.
- **Mutation check:** breaking the code on purpose to see whether a test notices.

## Check that it works

What was run in this session:

```bash
npm run check      # passed: 2,292 tests at the time
npm run test:e2e   # passed: 131 tests on a production build, 3 new in e2e/reviews.spec.ts
npx playwright test -c <a copy of playwright.dev.config.ts on port 3001>   # design suite
```

**What e2e can't prove.** A browser test can't make a completed job: there is no staff page yet, and each `next start` has its own fresh database. So writing a review and the 3-review home page are proven in Vitest. The e2e tests check the empty `/reviews`, that the review page gives a logged-out visitor a 307 to `/login`, a logged-in customer opening someone else's booking, and that no sample reaches the production home page.

**The design suite.** `npm run test:design` is fixed to port 3000, which another session used, so a temporary config pointed it at port 3001 and was deleted afterwards. First run: 47 passed, 3 failed. Two were this branch's own expectations in `e2e/dev/home-preview.spec.ts` (the sample summary line is marked as a sample too, and there are now two counting stats, not three); the spec was fixed. The third was the known motion-demo timing flake. Second run: 50 passed. Screenshots of the star rating, the review cards and the home reviews section were checked by eye. That found the sample summary line (the made-up average and count) had `data-sample` but no visible Sample badge; fixed in `1ff33a1`, with its test in `94c8fcf`.

**Mutation checks on U3.** Each break was undone after its run:

| Break on purpose | Tests failed |
| --- | --- |
| No user filter in the save | 1 of 18 |
| Hidden reviews not left out of the public read | 1 of 18 |
| `not-found` before the `duplicate` lookup | 0 of 18, then 1 of 19 |

An honest note on the last one: at first no test failed. "Completed" is a final step, so a reviewed booking can never leave the lock's filter, and no test ever reached the case. A test that moves the booking out of the filter was added, and then 1 of 19 failed.

## Common mistakes

- **Calling a staff review function outside a Server Action.** `updateTag` throws there.
- **Reading `params` at the top of a page with no `generateStaticParams`.** The whole page becomes runtime data; read it inside `<Suspense>`.
- **Showing the vehicle model in a credit.** The models are a draft until task 39.
- **Committing with a failing test** (`464f9e5`). Run the tests, then commit.
- **A test fixture that reuses a token.** It hits the wrong unique key and the test proves nothing about the one you meant.

## Try it yourself

1. Open `src/components/site/star-rating-input.tsx`. Remove `has-[~label_input:checked]:text-foreground` and its `svg` partner. Predict: when you pick 4 stars, what do stars 1 to 3 look like? Check on `/dev/design` under `npm run dev`, then undo.
2. In `src/domain/reviews.ts`, change `REVIEW_RULES.minForHome` to 2. Before running anything, guess which tests in `src/content/home.test.ts` and `src/app/[locale]/(site)/page.test.tsx` fail. Then run:
   ```bash
   npx vitest run src/content/home.test.ts "src/app/[locale]/(site)/page.test.tsx"
   ```
   Undo your edit afterwards.

## Learn more

- Next.js caching: `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-cache.md`, and `cacheTag.md` and `updateTag.md` in its sibling folder `04-functions/`.
- Next.js dynamic routes: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md`, "Without generateStaticParams".
- [MDN: `:has()`](https://developer.mozilla.org/en-US/docs/Web/CSS/:has): the parent selector the stars use.
- [MDN: the subsequent-sibling combinator (`~`)](https://developer.mozilla.org/en-US/docs/Web/CSS/Subsequent-sibling_combinator): "a later star".

## Review

_To fill in after `ce-code-review` and `code-reviewer` have run._

## Compound

_To fill in after the compound step._
