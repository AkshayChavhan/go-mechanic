# 47_book_wizard: the /book page, booking in four steps

> **Branch:** `47_book_wizard` · **Date:** 2026-11-19 · **Status:** In progress (ready for review)

## In one minute

Customers can now book a visit on the website. `/book` walks them through four steps: vehicle, then services or a package, then a time, then logging in with an SMS code (the same consent boxes as `/login`). They confirm and get a booking code such as `K7Q-4MX`. Every "Book" link on the site now opens this page. It sits on top of task 23's booking engine (`createMyBooking`).

Full details: [the plan](../plans/2026-11-11-2016-feat-booking-flow-plan.md) (task 47 is units U6–U10; task 23 was U1–U5), [task 23's learning doc](23_booking_flow.md) and the "Bookings" block in `CLAUDE.md`.

## Why: the problem we solved

- **Task 23 could save a booking, but nobody could make one.** There was no page. The header's "Book a service" still opened WhatsApp with a booking message.
- **Logging in comes last, on purpose.** A visitor chooses first and only then gives a phone number. Sending them to `/login` halfway would lose their choices, so the login happens inside the page.
- **The phone action bar was in the way.** On a phone, the shell puts a Call/WhatsApp/Book bar at the bottom of the screen. On `/book` the wizard's own Back and Continue buttons belong there.

## What: what changed

| File | Change | Why it exists |
| --- | --- | --- |
| `src/app/[locale]/(book)/layout.tsx` + test | Added | A route group: the shell with `actionBar={false}` |
| `src/components/site/site-chrome.tsx`, `action-bar.tsx`, `src/app/globals.css` | Changed | `actionBar` prop; the bar carries `data-action-bar`; its gap only appears when the bar is there |
| `src/app/[locale]/(book)/book/page.tsx`, `booking-loader.tsx` + tests | Added | The page (built ahead of time) and the part that reads the session and live slots inside `<Suspense>` |
| `src/components/booking/booking-wizard.tsx`, `booking-steps.tsx`, `booking-labels.ts`, `booking-prices.ts` + test | Added | The wizard: one client island with the four steps, confirm and done |
| `src/server/actions/booking.ts` + test | Added | `bookingLoginStep`, `confirmBooking`, `notMe` |
| `src/lib/booking-form.ts` | Added | The wizard's state types, shared by the actions and the island |
| `src/server/actions/login-form-step.ts`, `login.ts` | Added, Changed | The phone-and-code step, now shared by `/login` and `/book` |
| `src/components/account/login-form-labels.tsx`, `login-form.tsx` | Added, Changed | `loginFormLabels()`: one source for both pages' login words |
| `src/server/auth/login.ts` + test | Changed | `verifyLoginCode` also returns `needsName` |
| `src/server/dal/bookings.ts` + test | Changed | A `duplicate` answer now carries the earlier booking |
| `src/components/site/choice-group.tsx`, `src/i18n/format.ts` + tests | Changed | Disabled pills (closed days); `formatIndiaDay` for the day pills |
| `src/components/site/navigation.ts` + test | Changed | `bookPage.live = true`: every Book link opens `/book` |
| `messages/en.json`, FAQ, terms, home and about tests | Changed | The `Booking` texts; the site now says you can book online |
| `e2e/booking.spec.ts`, `home.spec.ts`, `layout-shell.spec.ts` | Added, Changed | The whole flow on a production build |
| `CLAUDE.md`, `readme.md`, `MASTER.md`, `task.md`, a solution doc | Changed | The rules for `/book` |

## How: step by step

1. **A shell without the phone bar (U6).** `(book)` is a route group like `(site)`: the brackets keep it out of the URL, so `(book)/book/page.tsx` is `/book`. Its layout passes `actionBar={false}` to `SiteChrome`. The CSS that reserves space for the bar now only applies when the bar is on the page:
   ```css
   @media (width < 48rem) {
       :root:has([data-action-bar]) { --stage-height: calc(100svh - var(--header-height) - var(--action-bar-height)); }
   }
   ```
   `:has(...)` means "the page root, if it contains an element with `data-action-bar`".

2. **The actions (U7).** `bookingLoginStep` runs the same phone-and-code step as `/login` (moved into `login-form-step.ts`), with the same consent snapshot. A correct code answers only `verified`. It never redirects. `confirmBooking` calls `createMyBooking`. `notMe` logs out and returns to the phone step.

3. **The wizard island (U8).** One `"use client"` component. Every label comes in as a prop. Prices are worked out in the browser with the same `priceFor` rule the server uses (until task 39 every line says "price confirmed at the garage"). It makes a request token once per visit, so a double tap books once.

4. **The page and the live link (U9).** `page.tsx` does the cached reads (catalogue, services, real prices, garage). Only `BookingLoader` waits for the request, inside `<Suspense>`. A `<noscript>` block offers Call and WhatsApp, because the wizard needs JavaScript. `bookPage.live` flipped to `true` in the same commit.

5. **Browser tests and docs (U10).** `e2e/booking.spec.ts` books from the home page as a new visitor, books as a logged-in customer, double-taps Confirm, retries after a lost answer, and checks the page with JavaScript off.

## Decisions worth knowing

- **The wizard keeps its own state across the login and isn't keyed by user id.** A login made inside a Server Action can't be read until the next request ([the lesson](../solutions/conventions/server-action-login-invisible-until-next-request.md)). So after the code check, the page's props still say "logged out". If the island were keyed by user id, the key would flip later and remount it, losing every choice. It takes saved vehicles and "needs a name" from Confirm's answers instead.
- **`confirmBooking` catches only `AccessDeniedError` and answers "needs login".** It never calls `requireUser`: its redirect to `/login` would throw away the wizard.
- **`verifyLoginCode` now returns `needsName`.** It reads it from the user Better Auth just returned (no session read). Without it, a new customer's first Confirm answered "Enter your name". The U10 browser tests found this (`ffeb9ac`).
- **Size: one pull request, trimmed.** The plan's stop line was 2,500 lines. Task 47 passed it after U8: the wizard alone was about 1,900 lines. The owner chose "trim, then finish in one PR". A simplification pass (`a707a9d`) removed about 150 lines. The final diff adds about 3,900 lines, about 1,600 of them tests.

## New ideas in this task

- **Route group:** a folder in brackets, `(book)`, that shares a layout but adds nothing to the URL. Like two rooms with different furniture behind the same street address.
- **`:has()`:** a CSS selector that matches a parent by what it contains. "The page, if it has an action bar."
- **Wizard:** a long form split into steps, with Back and Continue. Like a checkout.
- **Inline login:** logging in inside the page you're on, without being sent to `/login` and back.
- **Request token:** a random id sent with each Confirm. The same token twice means "the same tap again", so the server returns the first booking.

## What went wrong

- **A build helper timed out.** One U7 helper hit an API timeout before it wrote anything. It was restarted.
- **U8 went twice its budget, unnoticed.** The wizard was planned at about 850 lines. Nobody checked the count until it was done, which is why the trim pass came after.
- **The new-customer name bug** (above) passed the unit tests. Only the browser test, with a real login, showed it.

## Check that it works

The task's unit tests (they don't build the site or use a port):
```bash
npx vitest run src/server/actions/booking.test.ts src/components/booking/booking-wizard.test.tsx "src/app/[locale]/(book)"
```
```
 Test Files  5 passed (5)
      Tests  59 passed (59)
```
The quotes stop zsh from reading the brackets in the path as a pattern.

By hand: run `npm run dev`, open `http://localhost:3000/book` with the browser narrowed to a phone, book a visit, and read the login code on `/dev/outbox`.

## Reviews

- **`ce-code-review`** (full, 8 reviewers): "Ready with fixes". Two confirmed P2 findings, both fixed in `865a828`:
  - After a login ended mid-booking, a customer with a saved vehicle got an empty confirm screen on logging in again (four reviewers found it on their own). The wizard now keeps the model and fuel and asks only for the number again.
  - A retry after a lost answer, with a changed time, said "already booked for this time" with no details. The `duplicate` answer now carries the earlier booking, and the page shows it.
  - Also applied: a shared `loginFormLabels()` and `ids()` (`ddaa52d`), booking-online wording on the home, services, packages and about texts, and the terms' date.
- **Known risk left (not checked in a browser):** Next.js can keep a hidden `(site)` page in the background (`<Activity>`) after a click. Its action bar could still match `:has([data-action-bar])` on `/book`, which only adds extra scroll padding.
- **`code-reviewer`:** first "Needs changes", for one must-fix in `CLAUDE.md`: its `/book` notes still quoted the old duplicate message and the old "needs a name" rule. Fixed in `498ae7d`. Its suggestion to check the shared-phone case in a real browser found a real leak:
  - Customer A opened `/book`, logged out on `/account`, and followed "Book a service" again. The `/book` page Next.js had kept hidden showed A's saved vehicle and number plate to the next person. The unit tests had passed: `FreshOnEachVisit` remounts the wizard while hidden, but with the props it has then, which are still A's.
  - Fixed in `c1eb0f6`: `FollowPageLogin` starts the wizard over, before the page paints, when the page's login changes under it. A login change the wizard made itself (its inline login, "Not you?") doesn't count, so the choices survive. Two browser tests now cover the shared phone after a log-out and "Not you?" with real cookies.
- **Compound step:** the shared-phone leak was added to the existing lesson [react-19-form-islands-hydration-action-activity.md](../solutions/conventions/react-19-form-islands-hydration-action-activity.md) (section 3b), since it completes that lesson's "hidden pages" rule.
- **Tests:** after the shared-phone fix, `npm run check` passed with 1,953 tests and `npm run test:e2e` with 125. `npm run test:design` passed with 50 on 2026-11-19, before that fix (which changes no `site/` component).
- **Who built what:** the `ui-engineer` agent built U6, U8 and U9 (the shell, the wizard and the page); general-purpose helpers built U7 and U10; each unit was checked and committed by the main session.

## Common mistakes

- **Calling `requireUser` in a booking action.** Its redirect drops the wizard. Catch `AccessDeniedError` instead.
- **Trusting the page's session props after an inline login.** They're from the old request. Use what the action returned.
- **Keying the wizard by user id.** The remount loses every choice.
- **Styling for the action bar without `:has([data-action-bar])`.** `/book` would get a gap with nothing in it.

## Try it yourself

1. In `src/server/actions/booking.ts`, change the `catch` to rethrow every error (remove the `AccessDeniedError` branch).
2. Run `npx vitest run src/server/actions/booking.test.ts`. Which test fails, and what would a logged-out visitor see on Confirm?
3. Undo the edit and run it again: all green.

## Learn more

- [Next.js: route groups](https://nextjs.org/docs/app/api-reference/file-conventions/route-groups): folders in brackets.
- [MDN: `:has()`](https://developer.mozilla.org/en-US/docs/Web/CSS/:has): the parent selector.
- [React: `useActionState`](https://react.dev/reference/react/useActionState): how the wizard calls its actions.
