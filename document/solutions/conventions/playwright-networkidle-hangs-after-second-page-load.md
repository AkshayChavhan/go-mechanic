---
title: "Playwright on the Next.js 16 production build: 'networkidle' never comes once a page has loaded a second time, so check errors without it"
date: 2026-10-28
category: conventions
module: e2e/helpers.ts
problem_type: convention
component: testing_framework
related_components: [frontend]
severity: medium
applies_when:
  - A spec in e2e/ (production build) reloads a page, opens a URL again, or is redirected back to a page it has already seen, all in one test
  - A spec calls expectNoErrors (e2e/helpers.ts) anywhere after its first page load
  - A spec in e2e/ or e2e/dev/ reads rows the app wrote (codes, users, messages) while other specs run in parallel
symptoms:
  - Every step of a spec passes, then its last expectNoErrors times out (30 s) waiting for networkidle
  - "Prefetches of / (GET /?_rsc=..., with the rsc and next-router-prefetch headers) answer 200 but Playwright never sees them finish"
resolution_type: test_fix
retire_when: "A Next.js (16.4.3), @playwright/test (1.64.1) or Chrome upgrade after which waitForLoadState('networkidle') settles after goto('/') then reload() in one context on the production build. Check with a throwaway Node script, kept outside the repo, against npm run build && npm start"
tags: [playwright, networkidle, nextjs-16, prefetch, rsc, e2e, parallel-tests, test-isolation]
---

# Playwright on the Next.js 16 production build: 'networkidle' never comes once a page has loaded a second time, so check errors without it

## Context

Task 15 (branch `15_auth_otp_login`) added `e2e/login.spec.ts`. Its first test logs in, reloads `/account`, opens `/login` again (a logged-in visitor gets sent on to `/account`), logs out, and then opens `/account` once more. The first full `npm run test:e2e` passed every login step. It failed only on the last line, `expectNoErrors(page, errors)`. That helper (`e2e/helpers.ts`) begins with `await page.waitForLoadState("networkidle")`, which means "no network requests for 500 ms". The page never got there, and the test ran out of its 30 seconds.

Finding the cause took about an hour of probe scripts, request logs and variants. The task 15 session and `document/learning/15_auth_otp_login.md` record what it found:

- **The open requests:** Next.js prefetching `/`, which it does for the Wordmark's `<Link href="/">` (on `/login`, `/dev/outbox`, the 404 pages and the site header). Each one is a `GET /?_rsc=...` with the `rsc` and `next-router-prefetch` headers. Playwright sees a 200 response arrive, then never sees the request finish.
- **When it starts:** once a page has loaded a second time in the same browser context, through `page.reload()` or by opening the same URL again. It showed up on `/account` and `/login`, and also on the home page with nothing else changed (`goto("/")` then `reload()`). So the login pages don't cause it.
- **What didn't help:** a new tab in the same context hung too, and so did the context after `context.clearCookies()`. Only a fresh browser went idle.
- **The server is fine:** a Node `fetch` of the same request, with the same headers, got its answer in 5–47 ms.
- **Visitors are fine:** with the test stuck like this, a real click on the Wordmark still reached `/` in 79 ms.

Nobody found what inside Chrome or Playwright keeps those requests open. The fix below works without knowing.

## Guidance

1. **Call `expectNoErrors` only while the test is still on its first page load.** That is what the networkidle wait is for: a missing script, font or image fails, and gets logged, after the page itself has loaded.

2. **After a reload or a revisit, wait for something the page shows, then check the error list directly.** `watchErrors` keeps collecting through every navigation, so this still catches every console error and page error from the whole test:

   ```ts
   await page.goto("/account");
   await expect(page).toHaveURL(/\/login$/);
   await expect(page.getByRole("heading", { name: t.heading })).toBeVisible();
   // Not expectNoErrors here: it waits for the network to go quiet, which
   // never happens once a page has been loaded a second time in the same
   // browser. (Full comment in e2e/login.spec.ts.)
   expect(errors).toEqual([]);
   ```

   The only thing this skips is a late failure on the revisited page itself, one that comes after the heading shows. Step 1 already checks for that on the first load.

3. **Don't try to reset the browser in the middle of the test.** A new tab and `clearCookies()` both still hung, and a new context would also drop the login the test is checking.

4. **Specs under `e2e/dev/` probably don't hit this.** Next.js prefetches links only in production: `node_modules/next/dist/docs/01-app/02-guides/prefetching.md` says "Automatic prefetching runs only in production". `e2e/dev/outbox-preview.spec.ts` opens two pages and ends with `expectNoErrors`, and `npm run test:design` passed in task 15. That is a conclusion from the docs, not a test: task 15 records no reload under `next dev`.

5. **Parallel specs share one server and one database, so a spec looks up only its own rows.** Both configs set `fullyParallel: true` and start a single server. `playwright.config.ts` runs one `npm run start` with one in-memory PGlite for the whole run. `playwright.dev.config.ts` runs two test workers against one `next dev` on `.pglite/`, which also keeps rows from earlier runs. "The newest code" or "the first message" may belong to another test:

   - Every test makes its own number with `freshNumber()` (`e2e/helpers.ts`): `60000` and 5 random digits.
   - In `e2e/`, codes come from `latestCodeFor(e164, since)`. The outbox file (`OUTBOX_FILE`, in the system temp folder) is kept between runs, which is why `since` is needed as well.
   - On `/dev/outbox`, ``page.locator("[data-message]", { hasText: `To ${shown}` })`` finds the test's own message, not just the first one on the page (`e2e/dev/outbox-preview.spec.ts`).

## Why This Matters

The final spec shows the workaround and a short comment, but not the hour behind them. It doesn't record which requests hang, that the server and visitors are fine, or what was tried and failed. Upcoming tasks add specs that log in, reload, and return to pages: 16 (`16_roles_access`, protected areas and a real 307 in the proxy), 21 (`21_customer_vehicles`), 23 (`23_booking_flow`, OTP inside the booking wizard) and 25 (`25_my_bookings`). Without this lesson, the next spec that puts `expectNoErrors` after a reload will hang for 30 seconds, and someone will start investigating the server again. Playwright also warns against this wait in its own types (`node_modules/playwright-core/types/types.d.ts`): "'networkidle' - **DISCOURAGED** ... Don't use this method for testing, rely on web assertions to assess readiness instead". `expectNoErrors` uses it only on a first load, where it still works.

## When to Apply

- Writing or changing any spec in `e2e/` that reloads a page, opens one again, or follows a redirect back to a page it has already seen within one test. Each Playwright test gets a fresh context, so specs that load one page per test (`home.spec.ts`, `layout-shell.spec.ts`) can keep `expectNoErrors` at the end.
- Writing any spec that reads codes, users or messages the app wrote while other tests run.
- **Before removing the workaround:** after a Next.js, Playwright or Chrome upgrade, run a throwaway script that does `goto("/")`, `reload()` and `waitForLoadState("networkidle", { timeout: 10_000 })` against `npm run build && npm start`. If it settles, `login.spec.ts` can end with `expectNoErrors` again.

## Examples

Before (simplified): the first full run failed here, after every login step had passed:

```ts
await page.goto("/account");
await expect(page).toHaveURL(/\/login$/);
await expectNoErrors(page, errors); // waits for networkidle: never comes, 30 s timeout
```

After (`e2e/login.spec.ts`): `expectNoErrors` right after the first `page.goto("/login")`, then the last lines from step 2 above.

## Related

- `e2e/login.spec.ts`: the first test, where it calls `expectNoErrors`, and its closing comment
- `e2e/helpers.ts`: `watchErrors`, `expectNoErrors`, `freshNumber`, `latestCodeFor`, `OUTBOX_FILE`
- `e2e/dev/outbox-preview.spec.ts`: finding the test's own message on a shared page
- `document/learning/15_auth_otp_login.md`: the failure and the investigation, and "Common mistakes"
- `document/solutions/conventions/better-auth-phone-login-only-from-server-actions.md`: the login these specs test
- Playwright `waitForLoadState`: https://playwright.dev/docs/api/class-page#page-wait-for-load-state
- Next.js prefetching: `node_modules/next/dist/docs/01-app/02-guides/prefetching.md`
