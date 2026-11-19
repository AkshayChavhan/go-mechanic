# 26_admin_bookings_board: the staff area and the bookings board

> **Branch:** `26_admin_bookings_board` · **Date:** 2026-11-19 · **Status:** In progress (ready for review)

## In one minute

The garage now has a staff area at `/admin`. A manager or the owner opens it from a "Staff area" button on `/account`, presses Bookings, and sees one India day's bookings: time, code, vehicle, services, customer and pickup. Customers who try `/admin` get the normal 404 page, and nothing in that page's HTML gives the staff area away. Staff can also add `/admin` to their phone's home screen like an app.

Full details: [the plan](../plans/2026-11-19-1840-feat-admin-bookings-board-plan.md) (units U1–U6) and the staff-area rules in `CLAUDE.md`.

## Why: the problem we solved

Since task 23, customers can book, but nobody at the garage could see those bookings without opening the database. The mechanics' day starts with "who is coming, when, and for what?" This task answers that question.

It's also the first page only some logged-in people may see. Every later staff page (tasks 28, 29, 33, 50, 51) copies the pattern set here, so getting the lock right mattered more than the board itself.

Two things were split off, both the owner's choice on 2026-11-19:

- **Phone and walk-in bookings → task 50.** Staff will copy the caller's name and phone onto the booking (no account needed), may book from today onward, and may never book over a full slot.
- **The estimate inbox → task 51.** At the plan's size checkpoint the work was about 2,000 lines after U1–U3 and U5, too big for a 15-minute review. The inbox's menu item is commented out in `src/components/admin/admin-navigation.ts`, and its words stay in `messages/en.json` for task 51.

## What: what changed

| File or folder | Change | Why it exists |
| --- | --- | --- |
| `src/server/dal/staff-bookings.ts` (+ test) | Added | `listBookingsOn(date)`: one India day's bookings, for `bookings.manage` only |
| `src/domain/board-dates.ts` (+ test) | Added | `BOARD_RANGE_DAYS` (366), `boardRange`, `isOnBoard`, `pickBoardDate`: which day `?date=` may show |
| `src/i18n/format.ts` (+ test) | Changed | `formatIndiaLongDay`: "Thursday, 19 November 2026" for the board's heading |
| `src/lib/access-routes.ts` (+ test), `src/proxy.test.ts` | Changed | `PROTECTED_PREFIXES` now has `/admin`, so a logged-out visitor gets a real 307 to `/login` |
| `src/app/[locale]/admin/layout.tsx` (+ test) | Added | The staff bar, the title (the brand alone), `noindex`, the manifest and icon links |
| `src/app/[locale]/admin/page.tsx` (+ test) | Added | `/admin`: a card for each section this person may open |
| `src/app/[locale]/admin/bookings/page.tsx`, `bookings-gate.tsx` (+ test) | Added | `/admin/bookings`: the shell, and the gate that checks access, reads the clock and the day |
| `src/components/admin/` | Added | `AdminBar` (with Log out), `AdminNavGate`, `admin-navigation.ts`, `AdminOverview`, `BookingsBoard`, `AdminLoading`, the home-screen icon drawing |
| `src/app/admin.webmanifest/route.ts` (+ test) | Added | The web app manifest, linked only from the admin layout |
| `src/app/admin-icon-192.png/`, `admin-icon-512.png/`, `admin-apple-icon.png/` | Added | Home-screen icons drawn with `ImageResponse` |
| `src/components/account/account-content.tsx` (+ test) | Changed | The "Staff area" button, for roles with `admin.open` |
| `messages/en.json` | Changed | The `Admin` namespace and `Account.staffLink` |
| `e2e/admin.spec.ts`, `e2e/access.spec.ts`, `e2e/helpers.ts`, `playwright.config.ts` | Added / Changed | Browser tests; a test owner number |
| `CLAUDE.md`, `readme.md`, `task.md` | Changed | The staff-area rules, the repo map, ticks and backlog notes |

## How: step by step

1. **Plan, then review the plan.** `ce-plan` asked the owner to confirm the scope first (that's where task 50 split off). `ce-doc-review` ran 6 reviewers. Five fixes went straight in: staff text only inside the gates, one size checkpoint, how to split, and a Back-button check that doesn't retry until it passes. The owner approved six more: notes for the inbox, a Today link with the first and last day's arrows disabled, a back link, a note on photos, and loading placeholders.
2. **The staff read (U2).** `listBookingsOn` follows the data-access rules: `authorize("bookings.manage")` on its first line, then `parseIndiaDate`, then one query for the day's bookings and one `inArray` query for all their lines (not one query per booking). The phone number and pickup address are `null` unless the role also has `customers.contact`.
3. **The area and the board (U1, U3, U5).** Built in two parallel waves: the `ui-engineer` agent did U1 and U3, general-purpose helpers did U2, U5 and U6. The main session checked and committed each unit.
4. **The tests (U6).** `e2e/admin.spec.ts` runs serially: a customer books, then a customer checks `/admin`, then the owner finds that booking by its code.
5. **Simplify and review.** `ce-simplify-code` merged the day link into one `Button`, added `boardRange()`, fixed import order, and removed a duplicate label test and three comments that only repeated the code. Then `ce-code-review` (see "Reviews").

## Decisions worth knowing

- **Each page checks its own permission.** The layout never does the check alone. See "Route gate vs page gate" below.
- **No `admin/not-found.tsx`.** A customer's 404 is the site's root 404, which replaces the admin layout. An admin one would draw the 404 *inside* the staff bar and tell a customer the area exists.
- **The title is the brand alone.** Pages under `/admin` set no title. The `<head>` is part of the shell everyone receives, so it must hold no staff word.
- **Log out sits outside `<Suspense>`**, in the static bar, so it works without JavaScript (same as `/account`).
- **`searchParams` goes into the gate unawaited.** Awaiting it in the page would make the whole page wait for the request. Only the gate waits: `requirePermission`, then `await io()`, then today's India date, then `pickBoardDate`.
- **The board reaches 366 days either way.** That's a year and a day, so the same date next year, leap day included, still works. A bad or far-off `?date=` shows today with a note.
- **The manifest is a Route Handler, not `app/manifest.ts`.** Next.js links `manifest.ts` from every page. Ours is linked only from the admin layout, so public pages offer no "Add to home screen". Its `scope` is `/` so `/login` and `/account` stay inside the installed app; `start_url` and `id` are `/admin`.
- **Found while building, not in the plan:** an `icons` export in a nested layout drops the link Next.js makes for the root `src/app/icon.svg`. So the admin layout lists `icon.svg` again itself.
- **A test owner number.** `playwright.config.ts` sets `OWNER_PHONE_NUMBER` to `+918000000001` for the test server only. The owner logs in just once in the specs: `LOGIN_RULES` allow 5 codes an hour, and `alreadySent` gives no new code while one is still usable.
- **No browser fallback needed.** Task 47 needed a `FollowPageLogin`-style fix for stale pages after a login change. Here the test presses Back after the owner logs out and a new customer logs in, and no staff data showed. So nothing was added.
- **Privacy notice: no change.** Nothing new is stored, and "Your bookings" already says the garage sees them.

## New ideas in this task

- **Route gate vs page gate:** the route gate is the proxy (`src/proxy.ts`). It runs before any page and only checks that a login cookie exists. The page gate (`requirePermission` inside each page's `<Suspense>`) reads the real session and the role. The proxy is the receptionist who checks you have a badge; the page gate is the lock on each room.
- **Why a layout alone isn't a lock:** when you move between pages, Next.js keeps the layout and doesn't run it again. And a page can render without its layout's check (a direct request for its data). So a check in the layout could be skipped; the page must be safe on its own.
- **The prerendered shell reaches everyone:** the parts outside `<Suspense>` are built once, ahead of time, and sent to *every* visitor, a customer too. So the brand, "Back to site", "Log out" and a neutral loading line are the only things there. Staff words render only after the session check passes.
- **Web app manifest and scope:** a small JSON file that tells a phone the app's name, icons and start page, so it can be added to the home screen. `scope` is the set of addresses that stay "inside the app"; a link outside it opens the browser.
- **India day boundaries in UTC:** times are stored in UTC. India is UTC+5:30, so one India day runs from 18:30 UTC the day before to 18:30 UTC. `listBookingsOn` asks for `indiaInstantOn(day, 0)` up to (but not including) the next day's midnight.
- **Masking by permission:** the same rows go to a manager and the owner, but personal fields (phone, pickup address) are blanked in the data-access layer unless the role has `customers.contact`. The page never sees what it mustn't show.

## Check that it works

```bash
npx vitest run src/server/dal/staff-bookings.test.ts src/domain/board-dates.test.ts src/components/admin
```

Run on 2026-11-19, it printed `Test Files  7 passed (7)` and `Tests  52 passed (52)`.

```bash
npm run test:e2e
```

Run on 2026-11-19: 133 passed. `npm run check` passed with 2,203 tests after the two review tests in `a55be68`. `npm run test:design` wasn't needed: no `site/` or `ui/` component changed.

By hand: `npm run dev`, log in at `/login` with `97647 50567` (the code is on `/dev/outbox`), press **Staff area** on `/account`, then **Bookings**. Try `/admin/bookings?date=2026-02-30`: you get today and a note.

## Common mistakes

- **Checking access only in the layout.** It won't re-run on navigation. Call `requirePermission` in each page's gate.
- **Putting staff words outside `<Suspense>`.** They land in the HTML a customer receives. `e2e/admin.spec.ts` scans a customer's raw `/admin` HTML for them.
- **Adding `admin/not-found.tsx`.** It would show the staff bar on a customer's 404.
- **Awaiting `searchParams` in the page.** The whole page then waits for the request and stops being built ahead of time.
- **Filtering the day by UTC dates.** From 18:30 UTC it's already tomorrow in India; use `indiaInstantOn`.

## Try it yourself

In `src/server/dal/staff-bookings.ts`, move `const user = await authorize("bookings.manage");` below the `parseIndiaDate` line (and its `return`). Run:

```bash
npx vitest run src/server/dal/staff-bookings.test.ts
```

Find the test that fails ("a customer with an unreadable date is refused too: access is checked before the input") and explain why the order matters: a customer could tell what the function accepts from the answers it gives. Put the line back.

## Reviews

- `ce-code-review` (7 reviewers: correctness, security, adversarial (run in-process, since cross-model review is off), testing, maintainability, project standards, past lessons): **Ready with fixes**. No code defects. One P3 process finding: the steps weren't ticked and there was no learning doc (fixed by `c02dac2` and this doc). Two testing gaps, fixed in `a55be68`: reset the `can()` stub per test, and cover two bookings in one slot. Leftover notes went to the backlog in `task.md`: show each booking's status once cancelling exists (tasks 25 and 27), a `/login?next=` return path, shared e2e helpers, and consistent privacy wording.
- SEO check: `/admin`, `/admin/bookings` and `/account` all Pass. Public pages have no manifest link. For task 42: keep `/admin` and `/account` out of the sitemap, but don't disallow them in `robots` (they're `noindex`, and search engines must be able to read that).
- code-reviewer: pending.
- Compound step: pending.

## Learn more

- [Next.js: Authentication](https://nextjs.org/docs/app/guides/authentication): why checks belong close to the data, not only in layouts or the proxy.
- [Next.js: `io`](https://nextjs.org/docs/app/api-reference/functions/io) (also `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/io.md`): marking where request-time work starts.
- [MDN: Web app manifests](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest): `scope`, `start_url`, `id` and icons.
- [MDN: `Intl.DateTimeFormat`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat): the `timeZone` option behind `formatIndiaLongDay`.
