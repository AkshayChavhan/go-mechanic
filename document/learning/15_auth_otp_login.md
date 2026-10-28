# 15_auth_otp_login: log in with a mobile number and an SMS code

> **Branch:** `15_auth_otp_login` · **Date:** 2026-10-28 · **Status:** In progress

## In one minute

Customers can now log in at `/login` with an Indian mobile number and a 6-digit code sent by SMS. There's no password. Before a code is sent, they tick two boxes (18 or older, and agreement to be contacted), and the garage keeps a record of that. `/account` shows the number they're logged in with and a Log out button.

No real SMS leaves the computer yet: a fake sender stores each message, and `/dev/outbox` shows it under `npm run dev`. The home page is still built ahead of time (`○ /en`).

Full details: [the plan](../plans/2026-10-28-1155-feat-otp-login-plan.md) (read its "Review changes" C1–C10 first: they win over the rest) and the "Login and sessions" block in `CLAUDE.md`.

## Why: the problem we solved

Bookings (task 23) and repair tracking (task 25) need to know who the customer is. The product plan (features list, item 11) sets the rules: mobile number and a one-time code, +91 only, no passwords, and 18+ and consent boxes. A garage customer already gives their phone number at the counter. A code sent to it proves they hold that phone right now, and there's no password to forget or reuse.

Three things make it harder than "a form that sends a code":

- **SMS costs money and attracts abuse.** A script could ask for codes all day, to flood a victim's phone or run up the SMS bill ("SMS pumping"). Limits, and one guarded way in, have to exist from day one, even while the sender is fake.
- **The law.** Under India's Digital Personal Data Protection Act 2023 (the DPDP Act), the garage must be able to show what each person agreed to, and when.
- **Public pages stay prebuilt.** Reading the login cookie makes a page wait for each request. The home page sets `ensureStatic`, which fails the build if anything in its route reads cookies. So session reads must live in small, separate places.

## What: what changed

| File or folder | Change | Why it exists |
| --- | --- | --- |
| `package.json`, `package-lock.json` | Changed | `better-auth` 1.7.14, pinned exactly |
| `src/server/db/schema.ts`, `migrations/0001_auth_login.sql` + `meta/` | Changed, Added | Better Auth's tables (`users`, `sessions`, `accounts`, `verifications`), written by hand, plus ours: `consents`, `login_attempts`, `dev_messages` |
| `src/server/env.ts` + test, `.env.example` | Changed | Three settings: `BETTER_AUTH_SECRET`, `SMS_PROVIDER`, `E2E_OUTBOX_FILE`, and when each is refused |
| `src/domain/login.ts` + test | Added | `LOGIN_RULES` (every number in one place), `parseLoginCode`, `decideSend` (may a code be sent now?), `ipLimitKey` |
| `src/domain/consent.ts` + test | Added | The two consent purposes and `LOGIN_NOTICE_VERSION`. The test pins the wording |
| `src/domain/roles.ts` | Added | `ROLES`: customer, mechanic, manager, owner |
| `src/lib/contact-links.ts` + test | Changed | `parseIndianMobile`: turns what people type into `+91…` |
| `src/lib/login-state.ts` | Added | The form's state, shared by the Server Action and the form |
| `src/server/providers/sms/` | Added | The `SmsProvider` interface, the fake, and `smsProvider()`, which picks one from the settings |
| `src/server/dal/login-codes.ts`, `consents.ts`, `dev-messages.ts` + tests | Added | The queries: attempts decided under a lock, the live code, consent rows, stored messages |
| `src/server/auth/auth.ts` + test | Added | `createAuth`: Better Auth set up on our database. The test file is the spike |
| `src/server/auth/instance.ts` + test | Added | `getAuth()`: one Better Auth per process |
| `src/server/auth/login.ts` + test | Added | The login service: `requestLoginCode`, `verifyLoginCode`, the two callbacks, `clientIpKey`, errors without details |
| `src/server/auth/session.ts`, `login-code-text.ts` + tests | Added | `getCurrentUser()` for pages; the SMS text from messages |
| `src/server/actions/login.ts` + test | Added | The Server Actions `loginStep` and `logOut`: the only way in |
| `src/app/[locale]/login/` | Added | `/login`: outside the shell, `noindex`, with `RedirectIfSignedIn` |
| `src/app/[locale]/(site)/account/`, `src/components/account/` | Added | `/account` (inside the shell), `AccountDetails`, and the `LoginForm` island |
| `src/components/site/checkbox-field.tsx` + test, `dev/design/page.tsx` | Added, Changed | `CheckboxField` and its sample on `/dev/design` |
| `src/app/[locale]/dev/outbox/` | Added | `/dev/outbox`: what the fake SMS provider "sent" |
| `messages/en.json` | Changed | The `Login`, `Sms` and `Account` texts |
| `playwright.config.ts`, `e2e/helpers.ts`, `e2e/login.spec.ts` | Changed, Added | Browser tests that log in with codes read from the fake's file |
| `e2e/server-boundary.spec.ts`, `e2e/dev/*` | Changed, Added | Login markers in the boundary scan; the outbox and checkbox checks under `next dev` |
| `CLAUDE.md`, `readme.md`, `MASTER.md`, `task.md` | Changed | The "Login and sessions" rules, how to log in locally, the checkbox, and follow-ups for tasks 16, 19, 20, 21, 23, 35, 42, 43 and 44 |

The branch's first commit, `f5a45ee docs(14): mark task 14 done`, is task 14's bookkeeping. That's why `document/learning/14_database_setup.md` also differs from `main`.

## How: step by step

1. **Plan, with a review that only partly ran.** `ce-plan` wrote the plan, then hung in its own document review ([the known hang](../solutions/workflow-issues/ce-plan-child-session-hangs-use-idle-watcher.md)). The idle watcher stopped it after 10 idle minutes. Two of its six reviewers hadn't reported, and some findings it had printed never reached the plan: "Send a new code" would never send while the old code was valid, and Drizzle errors carry phone numbers and codes. The main session applied those. A separate subagent then did the missing feasibility, security and adversarial review by reading Better Auth 1.7.14's published files. It found no blockers, but it found these gaps:
   - "Send a new code" didn't carry the consent (C3);
   - a burst of requests could slip past the limits (C4);
   - after the 3rd wrong try a code still looked "live" (C5);
   - a failed SMS would lock the number for 5 minutes (C6);
   - the form's error wrapper would swallow the success redirect (C7);
   - Log out inside `<Suspense>` wouldn't work without JavaScript (C8);
   - Better Auth's own logger prints session tokens (part of C2).

   **The owner's decisions (2026-10-28):**
   - no "Log in" link in the header until task 21;
   - the consent wording as drafted (now `Login.ageLabel`, `consentLabel` and `notice` in `messages/en.json`);
   - logins last 30 days and are never extended;
   - both boxes are ticked at every login. Showing them only to new numbers would reveal which numbers have accounts.

2. **Install, pinned.**
   ```bash
   npm install better-auth@1.7.14 --save-exact
   ```
   `--save-exact` writes `"1.7.14"` into `package.json`, not `"^1.7.14"`, so a later `npm install` can't pick a newer version. Comparing the two lockfiles as data (re-checked for this doc):
   - 19 packages were added, 0 removed or changed.
   - All come from `registry.npmjs.org`, and none has an install script. npm still printed 7 install-script warnings: the ones `CLAUDE.md` already lists.
   - `npm audit` stayed at 7 findings (3 low, 4 moderate), in the work session.
   - There's still one copy of `drizzle-orm` (the plan said to stop if there were two: Better Auth's adapter and our schema must use the same one). Re-run for this doc, `npm ls drizzle-orm`:
   ```
   ├─┬ better-auth@1.7.14
   │ ├─┬ @better-auth/drizzle-adapter@1.7.14
   │ │ └── drizzle-orm@0.45.4 deduped
   │ └── drizzle-orm@0.45.4 deduped
   └── drizzle-orm@0.45.4
   ```

3. **The spike (U1): does Better Auth work on our database?** Before building on it, `src/server/auth/auth.test.ts` ran Better Auth's phone-number plugin against in-memory PGlite. All 11 tests passed on the first run. They pinned four things:
   - **Our hand-written tables work.** Better Auth compares the tables' property names with its own fields and throws on any mismatch. So the Drizzle property keys use its field names (`expiresAt`), and only the SQL columns are snake_case (`expires_at`).
   - **How it stores a code.** The row's value is `<code>:<tries>`. After the 3rd wrong try the row reads `code:3`, and the 4th call answers `TOO_MANY_ATTEMPTS` and deletes the row. `readLiveCode` relies on this format, so this test fails if an upgrade changes it.
   - **A failed SMS leaves the code stored.** That's why `forgetFailedSend` exists (step 6).
   - **The caller can't pick a role.** A `role` sent with the code is ignored, and everyone starts as `customer`.

   One test was removed later: it checked that an attempt id could ride along in the request body, and the service uses AsyncLocalStorage instead (step 7). So the file holds 10 tests today. One Better Auth warning, "Base URL is not set", is dropped on purpose in `logWithoutDetails`. It only matters for Better Auth's own web endpoints, which this site doesn't have.

4. **Settings** (`serverEnv()`, written test-first).
   - `BETTER_AUTH_SECRET` signs the session cookie. Staging and production require it, and it must be at least 32 characters. Locally a fixed placeholder is used. That's safe because a deployment can't run as `local` (task 14's rule).
   - `SMS_PROVIDER` is `fake` (the only choice). Production refuses the fake, so **production can't start before task 44**. That's on purpose: the launch is task 46, after real SMS.
   - `E2E_OUTBOX_FILE` is refused unless `APP_ENV` is `local` and `VERCEL` is unset (step 11).

5. **The rules, as pure code** (`src/domain/login.ts`). `LOGIN_RULES` holds every number so task 44 can tune them in one place:
   - a code has 6 digits, works for 5 minutes and allows 3 wrong tries;
   - "Send a new code" waits 30 seconds;
   - a number gets at most 5 SMS an hour and 10 a day, and an IP at most 30 an hour (deployments only: locally there's no trustworthy IP);
   - a login lasts 30 days, and records are kept 48 hours.

   `decideSend(history, intent, now)` answers `send`, `alreadySent`, `tooSoon` or `rateLimited`. It takes an `intent`:
   - `start` is the phone step. It never kills a code someone may be holding (after a reload or in a second tab): with a usable code it answers `alreadySent` and shows the code step, without sending an SMS.
   - `resend` is "Send a new code". After 30 seconds it sends a new code, which replaces the old one.

   It never asks whether the number has an account, so its answers can't reveal one.

6. **Decide under a lock, send after.** `decideAndRecordAttempt` (`src/server/dal/login-codes.ts`) runs one transaction:
   1. it takes `pg_advisory_xact_lock` on the number (then on the IP);
   2. it reads the send history and the live code;
   3. it calls `decideSend`;
   4. it writes a `login_attempts` row.

   **Why lock?** Without the lock, two requests at the same moment could both read "4 sends this hour" and both send. **Why send the SMS after the transaction?** PGlite has a single connection, and the transaction holds it until it ends. Better Auth's own queries, made inside it, would wait for that connection forever.

   If the SMS fails, `forgetFailedSend` deletes the number's stored codes and marks the attempt as not sent. Otherwise the number would wait 5 minutes for a code that never arrived. One honest limit: the test "ten requests at the same moment send one SMS" says in its own comment that PGlite runs one transaction at a time anyway. So the lock really matters only on a real Postgres (task 20).

7. **Consent travels with the attempt.**
   - Each phone-step submit writes a `login_attempts` row holding the notice version, the language and the moment the boxes were ticked.
   - The form keeps that row's id in a hidden field, and "Send a new code" and the code step post it back.
   - Better Auth calls our `callbackOnVerification` after the code checks out and **before** it creates the session. Ours copies that attempt's snapshot into `consents`, one row per purpose.
   - No attempt, or one for another number, means it throws: no session. That's "failing closed".
   - `consents.user_id` is `ON DELETE RESTRICT`, so deleting a user can't silently erase the proof. Task 43 decides what deletion does.

   **How do the callbacks know their request?** Better Auth calls `sendOTP` with only the number and the code. The service wraps its call to Better Auth in `loginRequest.run({ locale, attempt }, …)`, an `AsyncLocalStorage`. Anywhere inside that chain of async calls, `loginRequest.getStore()` returns that object. Outside it, it returns `undefined`, and both callbacks refuse to run. So nothing but the service can send a code or sign someone in.

8. **Errors without details.** Logs are read by more people than the database is, and Next.js logs every error a request throws. Two sources would put personal data in the logs:
   - Drizzle's error messages include the query's values: phone numbers, codes, session tokens.
   - Better Auth's logger passes the caught error along with its message.

   So the service throws `LoginServiceError` instead, with a fixed message like `requestLoginCode failed (DrizzleQueryError 23505)`: the step, the error's name and its Postgres code (SQLSTATE), with no original message and no `cause`. Better Auth's log lines print only their message (`logWithoutDetails`). Tests check that `util.inspect` of such an error holds no number.

9. **Server Actions only.** There's no Route Handler and no Better Auth browser client.
   - **Why:** Better Auth's rate limiter and origin check run only in its own web handler. Our direct `auth.api.*` calls skip them. So a handler at `/api/auth/...` would be an unguarded "send a code" address that skips our consent check and limits. That's also why Better Auth's limiter is switched off (`rateLimit: { enabled: false }`): ours is the one that counts.
   - **What protects the actions:** Next.js compares each action call's `Origin` with the site's `Host` itself. `e2e/login.spec.ts` checks that a POST to `/api/auth/phone-number/send-otp` gets a 404.
   - **Three rules about action files.** A `"use server"` file may only export async functions, so the form's state and starting value live in `src/lib/login-state.ts`. The page binds the locale as the first argument (`loginStep.bind(null, locale)`), and the action checks it with `hasLocale`. Redirects are written `return redirect(...)`: TypeScript can't see that next-intl's `redirect` never returns.

10. **Sessions and cookies.**
    - **Never extended.** A login lasts 30 days from the moment the code was typed (`disableSessionRefresh`). `getCurrentUser()` also passes `disableRefresh`, because a page can't write cookies.
    - **The cookie flags.** The cookie, `better-auth.session_token`, is `HttpOnly` and `SameSite=Lax`, and its value is signed.
    - **`Secure` only on deployments.** We set it ourselves: `useSecureCookies` is true on staging and production and false locally. Left unset, Better Auth (with no site URL) turns it on whenever `NODE_ENV=production`, and renames the cookie `__Secure-better-auth.session_token` (read in `node_modules/better-auth/dist/cookies/index.mjs`). That includes the production build `test:e2e` serves on `http://localhost:3210`. The plan's reason for the switch is that this cookie wouldn't work there. This doc didn't try it.

11. **The pages.**
    - **`/login`** sits outside the shell, has `noindex`, and shows a slim Wordmark bar like the 404. The `LoginForm` island gets every label as a prop from the server page, so the `Login` namespace never joins the messages every page sends to the browser (`src/i18n/client-messages.ts`).
    - **`RedirectIfSignedIn`** reads the session inside `<Suspense>`, so the rest of the page is still prebuilt.
    - **`/account`** sits inside the shell. Only `AccountDetails` reads the session, inside `<Suspense>`.
    - **Log out works without JavaScript.** The Log out form sits *outside* `<Suspense>`: content that streams in needs JavaScript to appear, and a plain form posting to `logOut` doesn't.
    - **A logged-out `/account` redirects with status 200.** Once a page has started streaming, the status is already sent, so a `redirect()` inside `<Suspense>` happens in the browser (bundled docs: `01-app/02-guides/streaming.md`, "Status codes"). Task 16 adds a real 307 in the proxy.

    The `ui-engineer` agent built the UI:
    - `CheckboxField` uses a native checkbox, which can be ticked before JavaScript loads. shadcn's Checkbox is a 16px Radix button and can't be.
    - `LoginForm` handles both steps with one `useActionState`.
    - `/dev/outbox` shows each code in large type, so it's easy to read on a phone.

    The agent also found a bug in the main session's e2e spec: `getByLabel("Mobile number")` matched by substring, so it also matched the consent label ("…use my mobile number…"). It's now `{ exact: true }`.

    The form's wrapper turns a failed call into a "couldn't reach the server" message. But a correct code makes the action redirect, and in the browser that redirect also arrives as a failed (rejected) call. So the wrapper calls `unstable_rethrow(error)` first, which passes Next.js's own redirect signal on.

12. **How the browser tests read codes safely.** `test:e2e` runs a production build, where `/dev/outbox` is a 404.
    - `playwright.config.ts` sets `E2E_OUTBOX_FILE` (a file in the system's temp folder) for its server, and the fake adds each SMS to it as one JSON line.
    - `latestCodeFor(number, since)` reads a test's own code from it.
    - `freshNumber()` gives every test its own number (`60000` plus 5 random digits), so parallel tests never share one.

    Two guards keep this off deployments: `serverEnv()` refuses the variable outside local runs, and production refuses the fake altogether. A test-only web endpoint or a fixed test code would be a backdoor if it were ever switched on, so neither exists.

13. **Proving the guards can fail.** For each guard, the code was broken on purpose, a test had to fail, and then the code was restored:
    - the env refusals: the fake in production, `E2E_OUTBOX_FILE` outside local, a short secret;
    - `decideSend`'s start/resend difference and its tries rule;
    - in the service: removing `forgetFailedSend`, removing the "3rd wrong try → `tooManyTries`" mapping, and removing the error scrubbing;
    - in the form: removing `unstable_rethrow` made the redirect test fail.

14. **Bumps along the way.**
    - **Three wrong expectations in my own tests (the service was fine):**
      - Postgres sorts an enum by the order it was declared in, so `age_18_plus` comes before `account_and_booking_contact`, not alphabetically.
      - With `Date` faked, two SMS sent without moving the time share a timestamp, so "the newest" was ambiguous. The tests now look codes up by recipient.
      - `ON DELETE RESTRICT` reports SQLSTATE `23001` (restrict_violation), not `23503`.
    - **The commit gate caught a typecheck failure once.** Old tests built `ServerEnv` objects by hand and lacked the new fields. `chooseDatabase` now takes only `databaseUrl`.
    - **A Playwright surprise.** The first full `test:e2e` run had 1 failure (`1 failed`, `63 passed (1.1m)`):
      - Every login step worked. The final `expectNoErrors` waits for the network to go quiet ("networkidle"), and after 30 seconds it still hadn't.
      - After a page loads a second time in the same browser (a reload, or opening it again), Chrome keeps Next.js's background prefetches of `/` open in Playwright's view.
      - It wasn't the server: a Node replay of the same request got its answer in 5–47 ms, and a fresh browser went idle.
      - It wasn't the login pages either: reloading the unchanged home page alone showed it too. And a real visitor's Wordmark click still reached the home page in 79 ms.

      The spec now runs `expectNoErrors` on the first load and a plain `expect(errors).toEqual([])` at the end.
    - **A dev test that wasn't safe in parallel.** The outbox test read the newest message, which a parallel test could have sent. It now finds its own number's card.

## Decisions worth knowing

| Choice | Why | What it costs |
| --- | --- | --- |
| A code by SMS, no passwords | Nothing to forget or reuse; the product plan asks for it | Each login costs an SMS (from task 44) |
| Server Actions only, no Better Auth web address | Its limiter and origin check guard only that address | Better Auth's ready-made browser client can't be used |
| Our own limits, decided under a lock | One place for the rules; a burst can't slip through | More code than Better Auth's built-in limiter |
| Both boxes at every login | Showing them only to new numbers would reveal who has an account | Returning customers tick them again |
| 30 days, never extended | Predictable; the owner's choice | Regular visitors log in again each month |
| No header link until task 21 | `/account` only shows a number so far | People reach `/login` only by its address |
| Native checkbox | Works before JavaScript loads; 44px row | Not shadcn's look |
| Session read inside `<Suspense>` | Pages stay mostly prebuilt | A logged-out `/account` redirects with 200 until task 16 |
| Production refuses the fake SMS | Production must never fake SMS | Production can't start before task 44 |
| Codes stored as plain text for 5 minutes | Better Auth's design; its hashing option would hash only the number | Someone reading the database could see live codes |
| No reset for a locked-out number (C10) | Turnstile and tuned limits come in task 44 | Someone could lock a victim's number for up to a day |

## New ideas in this task

- **OTP (one-time password):** a short code that works once, for a few minutes. Like a token at a counter: it proves you were just handed it.
- **Session and session cookie:** after a correct code, the server stores a session (a row in `sessions`) and gives the browser a cookie holding its token. The browser sends the cookie with every request, so the server knows who's asking.
- **Cookie flags:** `HttpOnly` means JavaScript in the page can't read the cookie, so injected scripts can't steal it. `SameSite=Lax` means the browser doesn't send the cookie with requests started by other websites (except plain link clicks). `Secure` means the cookie travels only over HTTPS.
- **Better Auth, plugin:** a login library. Its phone-number plugin adds the "send a code, check a code" part.
- **Server Action:** a server function a form can call. Next.js turns it into a POST to the page and checks where the request came from.
- **Route Handler:** a file that answers web requests at an address, like an API. This task deliberately has none for login.
- **Rate limit:** a cap on how often something can happen, like "5 SMS per number per hour".
- **Advisory lock (`pg_advisory_xact_lock`):** a lock on a name you choose, held until the transaction ends. Others asking for the same name wait in line, like one key for a shared room.
- **AsyncLocalStorage:** a Node feature that carries a value along one chain of async calls, like a name tag that follows a customer through every desk in the garage.
- **Consent record, notice version:** proof of what someone agreed to, under which wording, and when. If the wording changes, the version changes, so old records still show what each person actually saw.
- **Fail closed:** when something needed is missing, refuse instead of carrying on. No consent record means no login.
- **SQLSTATE:** Postgres's five-character error code, such as `23505` (duplicate) or `23001` (delete refused by `RESTRICT`). It's safe to log because it contains no data.
- **Client island:** a small `"use client"` part of an otherwise server-rendered page. Here that's `LoginForm`.
- **`useActionState`:** a React hook that runs a form's action and keeps its latest answer, which here is the form's state.
- **`unstable_rethrow`:** a Next.js function that throws its own signals (redirect, not found) on, so a `catch` doesn't swallow them.
- **◐ (Partial Prerender):** in the build's route list, a page "prerendered as static HTML with dynamic server-streamed content" (Next.js's own legend). Here those pages are `/en/login` and `/en/account`. `○` is fully static.
- **Mutation check:** break the code on purpose and make sure a test fails. A test that can't fail proves nothing.
- **networkidle:** Playwright's "no network requests for half a second".

## Check that it works

Real output on 2026-10-28 with Node 24 (`fnm exec --using=24 -- …`; trimmed), run for this doc:

```bash
npm run check
```
```
 Test Files  71 passed (71)
      Tests  1052 passed (1052)
```

Only the server and domain tests (rules, settings, database, login service, actions):
```bash
npx vitest run src/server src/domain
```
```
 Test Files  19 passed (19)
      Tests  249 passed (249)
```

From the work session's final runs:
- `npm run test:e2e`: `64 passed (38.6s)`, after the fix in step 14 (the first run was `1 failed`, `63 passed (1.1m)`).
- `npm run test:design`: `41 passed (1.7m)`.
- `npm run build`: `/en` is still `○`. `/en/login` and `/en/account` are `◐`: a prebuilt shell, plus the session read streamed in. `/en/dev/outbox` is `○` in the list, but `devOnly()` answers 404 in production.
  ```
  Route (app)                 Revalidate  Expire
  ┌ ○ /_not-found                    30d      1y
  ├   /[locale]                      30d      1y
  │ ├ ◐ /[locale]                    30d      1y
  │ └ ○ /en                          30d      1y
  ├   /[locale]/account              30d      1y
  │ ├ ◐ /[locale]/account            30d      1y
  │ └ ◐ /en/account                  30d      1y
  ├   /[locale]/dev/design
  │ ├ ◐ /[locale]/dev/design
  │ └ ○ /en/dev/design               30d      1y
  ├   /[locale]/dev/outbox
  │ ├ ◐ /[locale]/dev/outbox
  │ └ ○ /en/dev/outbox               30d      1y
  ├   /[locale]/login
  │ ├ ◐ /[locale]/login
  │ └ ◐ /en/login                    30d      1y
  └ ○ /icon.svg
  ```

To try it yourself (not done for this doc: a dev server would open `.pglite/` while other checks were running):
1. Run `npm run dev` and open http://localhost:3000/login.
2. Type any Indian mobile number, tick both boxes, and press "Send code".
3. Open http://localhost:3000/dev/outbox in another tab. The newest message holds the code.
4. Type the code on `/login`. You land on `/account`, which shows your number. Press "Log out" to go back to the home page.

## Checks and reviews

- **`ce-code-review`: "Ready with fixes".** No P0 or P1. Ten reviewers (correctness, security, data migration, reliability, testing, adversarial, form races and others); all 8 findings were confirmed, and all 8 are fixed, one commit each:
  1. **Tests that couldn't fail (#1, #2).** The "too many tries" tests started from a `resendAt` already in the past, so they passed even with the fix removed. The `/account` test stood in a details component that never waited, so it couldn't tell whether Log out had moved inside `<Suspense>`. Both now fail when the rule they guard breaks (checked by removing the fix once each).
  2. **A wrong screen after an error (#3).** "Change number", then a Send code that failed (no network), showed the *old* number's code step. The form's error path now keeps the step the visitor pressed the button on.
  3. **Two copies of the "no details" rule (#6), and no proof of it (#4).** `getCurrentUser` had a hand-copied version that dropped the Postgres code. Both now use `withoutDetails` in `src/server/auth/errors.ts`. New tests: details never survive, Next.js's redirect and 404 signals pass through, a broken database during a session read prints no token, and a scan of everything the login service tests print finds no number, code or token. Adding one log line that printed the code made 18 of those tests fail.
  4. **A hot reload broke login until a restart (#5).** Under `npm run dev`, editing the login service made a new request store, while the kept Better Auth instance still read the old one. The store now lives on `globalThis` too. A test loads the service twice and logs in.
  5. **A limit that lifts tomorrow (#7).** At the daily limit the message said "Try again after 10:00 am" (tomorrow's 10:00) and the countdown read "1260:00". It now names the date, and the countdown shows hours.
  6. **The fake SMS provider read the time itself (#8).** It now takes a `Clock`, like the rest of the code.

  It also listed residual risks for later tasks (a real SMS provider needs a time limit, IPv6 /48 rotation, no site-wide SMS cap, verify takes no lock on the number) and test gaps; the cheap ones were filled (the cross-number test now expects `wrongCode` exactly; "Send a new code" keeps the first consent's time). While re-running the tests, the machine's load average reached about 30 (Docker Desktop and the editor's TypeScript server): database tests timed out, as in task 14, and one test that allowed only 1 second of slack failed. It now measures the time on both sides of the send.
- **`code-reviewer` agent:** Pending.
- **SEO check:** the `seo-reviewer` agent served the production build and fetched each page (also as Googlebot). All 5 pass: `/login` and `/account` say `noindex, nofollow` in their prebuilt part (the metadata reads no session), `/dev/outbox` and `/dev/design` are 404 with `noindex` in production, and `/` is unchanged (`○ /en`, no login text or link). One nice-to-have, added to task 42 with the owner's OK: the new titles already end in "| GoMechanic", so a title template would double it.
- **Compound:** Pending.
- **Pull request:** Pending.

## Common mistakes

- **Reading the session in the shell, a layout or the home page.** The build fails (`ensureStatic`). Read it only inside `<Suspense>`, through `getCurrentUser()`.
- **Adding a Route Handler or `better-auth/react`.** That opens an unguarded "send a code" address. Go through the Server Actions.
- **Changing the consent wording without bumping `LOGIN_NOTICE_VERSION`.** `consent.test.ts` fails (exercise 3). Change the version and the pinned copy in the same commit.
- **Catching around a redirect.** A `try`/`catch` around `redirect()`, or a browser wrapper without `unstable_rethrow`, turns a successful login into an error message.
- **Exporting a type or a constant from a `"use server"` file.** Only async functions are allowed. Put shared things in `src/lib/`.
- **Logging an error object from the database.** It carries numbers, codes and tokens. Let the service's `LoginServiceError` do the talking.
- **Expecting a change to `auth.ts` to hot-reload.** `getAuth()` keeps one instance on `globalThis`, so restart `npm run dev`.
- **Faking timers in a PGlite test.** PGlite needs real timers. Fake only `Date` (`vi.useFakeTimers({ toFake: ["Date"] })`), and don't trust "the newest row" when the faked time didn't move.
- **`getByLabel("Mobile number")` without `{ exact: true }`.** It matches the consent label too.
- **`expectNoErrors` after a second page load in one browser.** It can wait forever for "networkidle". Use a plain `expect(errors).toEqual([])` there.
- **Leftovers in your local database.** Dev and test runs leave users with `60000…` numbers and outbox messages in `.pglite/`. Stop `npm run dev`, then run `npm run db:reset`.
- **A leftover `.pglite.lock`.** Playwright stops `next dev` abruptly, so the lock stays behind with a dead process id. The next `npm run dev` takes it over. That's by design, not an error.

## Try it yourself

About 10 minutes. Predict each answer first, and finish with `git status` showing a clean tree.

1. Which of these does `parseIndianMobile` accept: `98765 43210`, `098765-43210`, `+91 58765 43210`, `९८७६५ ४३२१०`, `91 98765 4321`? Then check (Node 24 runs the `.ts` file directly):
   ```bash
   node --no-warnings -e 'import("./src/lib/contact-links.ts").then(({ parseIndianMobile }) => { for (const typed of ["98765 43210", "098765-43210", "+91 58765 43210", "९८७६५ ४३२१०", "91 98765 4321"]) console.log(JSON.stringify(typed), "->", parseIndianMobile(typed)); })'
   ```
2. You ask for a code. 10 seconds later you reload `/login` and press "Send code" again. What does `decideSend` answer? And if, on the code step, you press "Send a new code" at 20 seconds? At 40 seconds? Check your answers against the test names in `src/domain/login.test.ts`.
3. In `messages/en.json`, change "only" to "mostly" in `Login.notice`. Run `npx vitest run src/domain/consent.test.ts`. What fails, and what does the message tell you to do? Then undo the edit.

Answers.

(1) Real output:
```
"98765 43210" -> +919876543210
"098765-43210" -> +919876543210
"+91 58765 43210" -> null
"९८७६५ ४३२१०" -> +919876543210
"91 98765 4321" -> null
```
The third starts with 5 (Indian mobiles start with 6 to 9). The last is 11 digits: 91 and then only 9 digits, one short. Spaces, a dash, a leading 0 and Devanagari digits are all fine.

(2) `alreadySent`: the code is still usable, so no SMS goes out and the code step comes back (the phone step never kills a code you may be holding). At 20 seconds, `tooSoon`. At 40 seconds, `send`: a new code goes out and the old one stops working.

(3) Real output from a throwaway copy outside the repo, so nothing in the repo was edited:
```
 FAIL  |node| src/domain/consent.test.ts > the login notice version > the English wording is the one pinned for the current version
AssertionError: The consent wording changed: bump LOGIN_NOTICE_VERSION in src/domain/consent.ts and add the new words here: …
-   "notice": "We keep your mobile number and when you agreed. We use it only to log you in …",
+   "notice": "We keep your mobile number and when you agreed. We use it mostly to log you in …",
      Tests  1 failed | 1 passed (2)
```

## Learn more

- Better Auth: [phone-number plugin](https://better-auth.com/docs/plugins/phone-number), [Drizzle adapter](https://better-auth.com/docs/adapters/drizzle), [session management](https://better-auth.com/docs/concepts/session-management), [cookies](https://better-auth.com/docs/concepts/cookies).
- Next.js, the bundled copy in `node_modules/next/dist/docs/01-app/`:
  - `02-guides/server-actions.md` (its "Security" part: the Origin check);
  - `02-guides/forms.md`;
  - `02-guides/authentication.md`;
  - `02-guides/streaming.md` ("Status codes": why a redirect inside `<Suspense>` is a 200);
  - `03-api-reference/01-directives/use-server.md`;
  - `03-api-reference/04-functions/cookies.md` and `redirect.md`.
- React: [`useActionState`](https://react.dev/reference/react/useActionState).
- Node.js: [AsyncLocalStorage](https://nodejs.org/api/async_context.html).
- PostgreSQL: [advisory locks](https://www.postgresql.org/docs/current/explicit-locking.html), [error codes (SQLSTATE)](https://www.postgresql.org/docs/current/errcodes-appendix.html).
- MDN: [`Set-Cookie`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie): `HttpOnly`, `SameSite`, `Secure` and the `__Secure-` prefix.
- India's DPDP Act 2023: [MeitY's data protection page](https://www.meity.gov.in/data-protection-framework).
- Playwright: [`waitForLoadState`](https://playwright.dev/docs/api/class-page#page-wait-for-load-state), and what "networkidle" means.
