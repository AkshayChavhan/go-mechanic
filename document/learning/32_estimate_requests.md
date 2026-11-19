# 32_estimate_requests: ask the garage for a free estimate

> **Branch:** `32_estimate_requests` · **Date:** 2026-11-19 · **Status:** Done

## In one minute

A logged-in customer can now open `/estimate`, say which vehicle has the problem, describe it, and add up to 6 photos if they like. The request is saved with its own copy of the vehicle, and it shows at the top of `/account`. Staff can read every request through a checked data-access function, `listEstimateRequests()`. The `/admin` inbox page that shows it to them comes with task 26.

Full details: [the plan](../plans/2026-11-19-1334-feat-estimate-requests-plan.md) (R1–R8, KTD1–KTD9, units U1–U6) and the "Estimate requests" block in `CLAUDE.md`.

**Built in parallel.** Three Claude sessions worked at once, each in its own folder (a git worktree). This was Session 2, in `go-mechanic-s2`. `origin/main` didn't move during the task, so there was no merge conflict, and the migration got the number `0009` with no clash at the time of writing. If another session's `0009` migration or notice version reaches `main` first, this branch regenerates its migration and moves its version before merging. A few files that other tasks own got small additions, kept to a few lines each so a later merge conflict stays small: `account-content.tsx` (task 21), the item list in `privacy/page.tsx` (task 19) and the `/dev/design` page (a textarea sample).

## Why: the problem we solved

Many customers can't name the repair they need. "It makes a noise when I brake" isn't a service on a list, so the booking flow doesn't fit them. The brief (`features.md` item 14) promises a free estimate with photos. Task 30 built the photo uploads for exactly this, and task 33 (the estimate builder) needs requests to answer.

The owner decided on 2026-11-19:

- **The inbox page waits for task 26.** `/admin` belongs to another session's task; building it here would cause merge conflicts. So this task built only the staff read, `listEstimateRequests`.
- **Log in first.** No login inside the estimate form: photos already need a login.
- **A saved vehicle or the picker.** A first-time customer shouldn't have to add a vehicle before asking.
- **Photos optional, up to 6.** Some problems are sounds or warning lights.

## What: what changed

| File or folder | Change | Why it exists |
| --- | --- | --- |
| `src/domain/estimate-requests.ts` (+ test) | Added | The rules: `ESTIMATE_REQUEST_RULES` (description 10–1,000 characters, 3 requests a day), `normalizeDescription`, `checkEstimateRequestInput` |
| `src/server/db/schema.ts`, `migrations/0009_estimate_requests.sql`, `meta/` | Changed / Added | The `estimate_requests` table: a copy of the vehicle, the description (with a length CHECK), an optional photo set, a request token |
| `src/server/db/estimate-requests-table.test.ts` | Added | Proves the CHECKs refuse bad rows and match the rules |
| `src/server/dal/estimate-requests.ts` (+ test) | Added | `createMyEstimateRequest` (the save), `listMyEstimateRequests` (the customer's own), `listEstimateRequests` (staff, `estimates.manage`) |
| `src/server/actions/estimates.ts` (+ test) | Added | `sendEstimateRequest`, the Server Action the form posts to |
| `src/lib/estimate-form.ts` | Added | The form's state and the one reader of what it posts, shared by the action and the form |
| `src/app/[locale]/(site)/estimate/page.tsx`, `estimate-gate.tsx` (+ tests) | Added | The `/estimate` page, built ahead of time; `EstimateGate` reads the session inside `<Suspense>` |
| `src/components/estimate/estimate-form.tsx` (+ test) | Added | The form island: vehicle choice, description, photos, Send |
| `src/components/account/estimate-requests.tsx` (+ test), `account-content.tsx` | Added / Changed | The request list on `/account`, above the vehicles once there is a request |
| `src/components/site/photo-uploader.tsx` (+ test) | Changed | `onBusyChange`, failed photos can be removed, `uploadVariant` |
| `src/components/ui/textarea.tsx`, `restyle.test.tsx` | Added / Changed | shadcn's textarea, restyled like the input |
| `src/app/[locale]/dev/design/` | Changed | Samples of the textarea and of the uploader inside a form |
| `messages/en.json` | Changed | The page's, form's and list's text; the privacy notice's "Your estimate requests" and its lead sentence |
| `src/domain/consent.ts` (+ test), `privacy/page.tsx`, `privacy/coverage.test.ts` | Changed | `LOGIN_NOTICE_VERSION` moved to `2026-11-19.2` with a new fingerprint; the new item and table are listed |
| `src/domain/permissions.ts` | Changed | Only a comment: `estimates.manage` now names task 32 too |
| `e2e/estimate.spec.ts` | Added | The guest view, and a real request with a photo, on a production build |
| `CLAUDE.md`, `task.md` | Changed | The "Estimate requests" rules, and backlog notes for tasks 26, 33, 43 and 47 |

## How: step by step

1. **Plan with `ce-plan`, then review the plan.** `ce-doc-review` ran six reviewers on the plan, and their findings changed it before any code was written:
   - **Failed photos must be removable.** Three reviewers found the same trap: Send is disabled while a photo has failed, and a failed photo had no remove button. On a bad connection the customer could never send, not even text only.
   - where the `<form>` sits (step 5 below);
   - a real multi-line textarea for the description, not a one-line input;
   - the privacy notice's lead sentence, which lists *when* the site keeps data, must mention estimates too;
   - the request list goes above the vehicles, so the request just sent shows without scrolling.
2. **The rules (U1).** `checkEstimateRequestInput` trims the description (keeping line breaks: people list symptoms one per line), checks the vehicle and that the photo set id and request token are uuids. Each problem is tagged with its field (`vehicle`, `description`, `photos`, `form`), so the form shows it in the right place.
3. **The table (U2).**
   ```bash
   npm run db:generate -- --name=estimate_requests   # wrote 0009_estimate_requests.sql + meta/
   ```
   `--name` sets the part of the file name after the number. There's no status column: every request is "waiting" until task 33's estimates answer it.
4. **The save and the reads (U3).** `createMyEstimateRequest` keeps the booking save's order (see "Decisions" below). `listMyEstimateRequests` filters by the logged-in user's id. `listEstimateRequests` calls `authorize("estimates.manage")` first and adds the phone number only for roles with `customers.contact`.
5. **The action and the form (U4, U5).** The textarea came from the shadcn CLI, then was restyled:
   ```bash
   npx shadcn@latest add textarea --yes
   ```
   `--yes` answers the CLI's questions with the defaults. The form follows `VehicleForm` (task 21) with two differences, explained under "Decisions".
6. **`/estimate` and `/account` (U5).** The page is static except `EstimateGate`, which shows a login link to guests, a link to `/account` to a customer with no name, and the form to everyone else.
7. **Privacy notice and the browser test (U6).** `consent.test.ts` failed until `LOGIN_NOTICE_VERSION` moved, which is its job. Task 24 already used `2026-11-19` today, so this one is `2026-11-19.2`.
8. **Proving the ownership filters matter.** As `CLAUDE.md` asks for customer data, the `user_id` filters in the data-access code were broken on purpose. 2 tests failed, so the tests really guard them. Then the code was put back.

## Decisions worth knowing

- **The save's order.** Reads that open their own queries (the saved vehicle, the cached catalogue) run *before* the transaction; on PGlite a read inside it would wait forever. What they find is kept, not answered yet. Inside the transaction: lock the customer, then check the request token and answer `duplicate`, and only then the refusals that can change between tries (a removed vehicle, a hidden model, the photo set), then the 3-a-day limit, then the insert. Why duplicate first: if the answer to the first send got lost and the customer then removed the vehicle, the retry must say "already sent", not "vehicle not found". This is task 24's lesson: [idempotent-save-answer-duplicate-before-refusals-that-can-change.md](../solutions/conventions/idempotent-save-answer-duplicate-before-refusals-that-can-change.md).
- **The `<form>` belongs to the visit, not to the answer.** In `VehicleForm`, the whole form remounts after each answer, keyed by the submission counter. Here that would throw away the uploaded photos on every error. So the outer component renders the `<form>` and the `PhotoUploader` once per visit, and only the inner fields (vehicle, description and their errors) are keyed by the counter. A typo in the description no longer costs the customer their photos.
- **The request token lives in a ref.** The token is made on the first send, inside the submitter (`token.current ??= crypto.randomUUID()` in `estimate-form.tsx`), and reused for every retry of that visit. The first version made it in an effect that set state; the lint rule `react-hooks/set-state-in-effect` refused that. A ref is simpler anyway: changing it doesn't re-render anything.
- **Send stays the only blue button.** The uploader's Upload button takes `uploadVariant="secondary"` here, because the design system allows one blue button per group.
- **A removed failed photo only leaves the browser's list.** Its pending row in the database keeps its place until the 24-hour cleanup, because its signed upload link still works (task 30's lesson).

## New ideas in this task

- **Request token:** a random id the form sends with every try. The server keeps it with the request. If the same token arrives again, it answers "duplicate" instead of saving twice. Like a ticket number at a counter: show it twice, you still get one coffee.
- **Advisory lock:** a lock Postgres holds on a name we choose (here, the customer), not on a row. Two sends from the same customer run one after the other, so both can't slip under the daily limit.
- **Ref (`useRef`):** a box a React component keeps between renders. Changing what's inside doesn't redraw the screen. Good for values the screen doesn't show, like the token.
- **Remount by key:** giving a component a new `key` makes React throw it away and build a fresh one. Useful to reset a form, dangerous when part of it (the photos) must survive.
- **Busy callback (`onBusyChange`):** the uploader tells its parent "I'm busy" while a photo is resizing, waiting, uploading or failed, so the form can disable Send.

## Check that it works

What was run in this session:

```bash
npm run check                               # passed: 143 files, 2,029 tests (final branch)
npm run test:e2e                            # passed: 121 tests on a production build (final branch)
npx playwright test -c <a copy of playwright.dev.config.ts on port 3001>   # passed: 50 tests
```

The last line is `npm run test:design` on another port. That command is fixed to port 3000, which another session was using, so a temporary copy of its config pointed it at port 3001 (`npm run dev -- --port 3001`; `--` passes `--port` on to Next.js). The copy was deleted after the run and never committed.

The second test logs in, picks a vehicle with the picker, uploads one real photo to the fake storage on the production build, sends, and finds the request at the top of `/account`, on a 375px-wide phone screen. `/estimate` is listed in `.next/prerender-manifest.json`, so it's built ahead of time.

By hand: under `npm run dev -- --port 3001` (`--` passes `--port` on to Next.js), `/estimate` showed the guest view correctly at desktop width. The browser window couldn't be resized to phone width in this session, so the phone layout is covered only by the e2e test at 375px.

Nothing in the Definition of done was skipped.

## Common mistakes

- **Answering a refusal before the duplicate check.** A retry after a lost answer is then refused for a request that exists.
- **Reading the catalogue or the session inside the transaction.** On PGlite it hangs with no error. Read first.
- **Keying the whole form by the submission counter.** Every error empties the photos.
- **Leaving a failed photo with no way out.** The form can never be sent.
- **Changing the notice's wording without moving `LOGIN_NOTICE_VERSION`.** `consent.test.ts` fails, on purpose.

## Try it yourself

1. Change `ESTIMATE_REQUEST_RULES.maxPerDay` in `src/domain/estimate-requests.ts` from 3 to 5. Before running anything, guess which tests fail. Then run:
   ```bash
   npx vitest run src/domain/estimate-requests.test.ts src/server/dal/estimate-requests.test.ts \
     src/server/db/estimate-requests-table.test.ts src/server/actions/estimates.test.ts
   ```
   Hint: the test "the 4th request in 24 hours is refused" in `src/server/dal/estimate-requests.test.ts` types the 3 itself. Does the database need a new migration? Look at the CHECKs in `0009_estimate_requests.sql`: they cover the description's length and the registration format, not the daily limit. So no. The message in `messages/en.json` (`too-many-requests`) gets the number as `{limit}`, so it needs no change. Undo your edit afterwards.
2. Now change `descriptionMinLength` to 5 instead. Which test reminds you that the CHECK must change too, and what command writes the new migration?

## Learn more

- [React: `useRef`](https://react.dev/reference/react/useRef): when a ref beats state.
- [React: resetting state with a key](https://react.dev/learn/preserving-and-resetting-state#option-2-resetting-state-with-a-key): what a remount does.
- [PostgreSQL: advisory locks](https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS): locks on a name instead of a row.
- [shadcn/ui: Textarea](https://ui.shadcn.com/docs/components/textarea): the component we started from.

## Review

Two rounds, then fixes.

**`ce-code-review`** (nine reviewers: correctness, project rules, testing, maintainability, past lessons, security, the migration, an adversarial read, front-end races). Verdict: **Ready with fixes**, no serious findings. An independent check confirmed three:

1. **The privacy notice was wrong about photos.** It sent readers to "Photos you send us", which says estimate photos are kept a year after the estimate closes. Nothing closes a request's photo set yet, so they're really deleted after 30 days. "Your estimate requests" now says so, with the number read from `PHOTO_RULES` (commit `6b65cde`). The version stays `2026-11-19.2` with a new fingerprint: it hadn't been merged anywhere yet.
2. **Removing a failed photo freed a place the server still counted.** Its row stays pending for 24 hours, so the next upload was refused. The uploader now counts it too (`48f656e`, with a test that fails without the fix).
3. **A saved vehicle tapped before the page loaded was reset.** The fix taught us a new rule (see Compound) (`dd2edbd`, with a `hydrateRoot` test).

It also found two missing tests, now added: an error answer keeps the uploaded photos and the photo set, and a retry of the third request of the day answers "duplicate", not "too many" (`ec4605f`).

**`code-reviewer`** (repo rules). Verdict: **Needs changes**, one must-fix: the new in-form uploader sample sat in the same sample box as the old one, so the design-page browser test (`e2e/dev/photo-resize.spec.ts`) would find two uploaders and fail. It now has its own box (`d6ca840`), and all 50 design-page tests pass. Its other points, also done: the cursor goes to the vehicle choice when none was picked, the character count no longer reads itself out on every keystroke (`35de412`), a NUL character in a description no longer crashes the save (`ca64654`), and this doc's numbers and wording. Left as backlog notes: a shared helper for the copied `fill()` text function, and a CLAUDE.md sentence about draft models that disagrees with the account forms.

## Compound

One lesson passed the question "would a future session repeat this without it?": **restore values, never structure, while hydrating.** The estimate form kept a choice tapped before the page loaded (like the vehicle picker does), but showing the vehicle picker because of it during hydration made React throw "Hydration failed". The fix renders what the server rendered until hydration is done. It extends an existing lesson instead of starting a new one: `document/solutions/conventions/react-19-form-islands-hydration-action-activity.md` (commit `48239a6`).

The privacy mistake (#1 above) needed no new lesson: `privacy-notice-retention-from-delete-code-not-expiry.md` already says it, and the review found it by reading that lesson.
