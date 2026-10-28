---
title: "Better Auth 1.7 phone login, called only from Next.js 16 Server Actions: what the library doesn't do for you"
date: 2026-10-28
category: conventions
module: src/server/auth
problem_type: convention
component: authentication
related_components: [database, frontend]
severity: high
applies_when:
  - Task 16 (roles) reads the session or adds a role check or a Better Auth setting
  - Task 23 (booking) logs someone in with a code inside the booking form
  - Task 35 (notifications) or task 44 (real SMS) changes how a code is sent, or adds a provider that can fail
  - Adding a Better Auth Route Handler, a browser client, a plugin or a new callback
  - Upgrading better-auth or @better-auth/drizzle-adapter
symptoms:
  - The 3rd wrong code still answers INVALID_OTP; only the 4th call answers TOO_MANY_ATTEMPTS
  - A failed SMS leaves the code stored, so the number would wait 5 minutes for a code that never arrived
  - Better Auth's error log lines pass the caught database error, whose message holds phone numbers, codes and session tokens
  - "A hot reload of the login service under `npm run dev` would leave the kept auth instance reading an old request store, so every login fails until a restart"
retire_when: "A better-auth release changes one of these behaviours (rate limiting or the origin check inside auth.api calls, the phone-number plugin's '<code>:<tries>' value or its store-then-send order, the logger's extra arguments). Check after each upgrade by re-reading node_modules/better-auth/dist/plugins/phone-number/routes.mjs and dist/api/index.mjs, and by running src/server/auth/auth.test.ts unchanged."
tags: [better-auth, phone-otp, server-actions, rate-limiting, async-local-storage, logging-pii, drizzle-adapter, nextjs-16]
---

# Better Auth 1.7 phone login, called only from Server Actions

## Context

Task 15 added login with a code sent by SMS. It uses Better Auth 1.7.14 and its phone-number plugin, with the Drizzle adapter on our own tables. Our server code is the only caller: the Server Actions in `src/server/actions/login.ts` call the login service (`src/server/auth/login.ts`), which calls `auth.api.sendPhoneNumberOTP` and `auth.api.verifyPhoneNumber`. There is no Route Handler and no Better Auth code in the browser.

Used this way, Better Auth skips some of its own protections, and some of its behaviour is surprising. Each point below was read in Better Auth's built code under `node_modules/` (line numbers are for 1.7.14; `@better-auth/core` and `@better-auth/drizzle-adapter` are 1.7.14 too). Most are pinned by a test, mostly in `src/server/auth/*.test.ts`. `auth.test.ts` is the spike: it runs the real library against an in-memory PGlite with our migrations. It fails if an upgrade changes what we rely on.

## Guidance

**1. `auth.api.*` calls get no rate limiter and no origin check. Those run only in Better Auth's HTTP router.**

- The router adds `originCheckMiddleware` (`node_modules/better-auth/dist/api/index.mjs:160-163`) and calls `onRequestRateLimit` in its `onRequest` (line 173). `node_modules/better-auth/dist/api/to-auth-endpoints.mjs`, which builds `auth.api`, has neither.
- So keep `rateLimit: { enabled: false }` in `src/server/auth/auth.ts` and enforce limits ourselves. `decideSend` (`src/domain/login.ts`) makes the decision. `decideAndRecordAttempt` (`src/server/dal/login-codes.ts`) runs it in one transaction that first takes `pg_advisory_xact_lock` on the number, then on the IP, so a burst of requests is decided one at a time.
- The SMS goes out **after** that transaction ends. PGlite has one connection, and a query made while the transaction holds it would wait forever.
- Never add `toNextJsHandler` or `better-auth/react`. That would publish `/api/auth/phone-number/send-otp` as an address with only Better Auth's limiter, which is off. `e2e/login.spec.ts` checks that a POST there stays a 404. Next.js checks the Origin of every Server Action on its own.

**2. A stored code is `"<code>:<wrongTries>"`, and the 3rd wrong try doesn't kill it.**

- A send stores `` `${code}:0` `` in `verifications` (`node_modules/better-auth/dist/plugins/phone-number/routes.mjs:156-160`; `routes.mjs` below). It doesn't delete older rows for the number.
- Verify reads only the newest row (`findVerificationValue`, `createdAt desc, limit 1`, `node_modules/better-auth/dist/db/internal-adapter.mjs:733-763`). It consumes that row and deletes **every** row for the number (`consumeVerificationValue`, `deleteMany` at line 859). On a wrong code it writes the row back with the try count + 1 and the same expiry (`routes.mjs:519-525`).
- After the 3rd wrong try the row is `code:3`, still unexpired, and the answer is still `INVALID_OTP`. Only the **4th** call sees `3 >= allowedAttempts`, deletes the row and answers `TOO_MANY_ATTEMPTS` (`routes.mjs:510-513`).
- So a "is there a usable code?" check must parse the try count: `readLiveCode` in `src/server/dal/login-codes.ts` returns `triesLeft`. And `verifyLoginCode` (`src/server/auth/login.ts:202-207`) turns an `INVALID_OTP` with `triesLeft === 0` into `tooManyTries`, so the person asks for a new code instead of typing a 4th one that can't work.

**3. `sendPhoneNumberOTP` stores the code before it waits for `sendOTP`.**

`routes.mjs:156-172`: create the row, then `await sendOTPResult`. If the SMS fails, the call rejects but the code stays stored for its 5 minutes. `decideSend` sees that live code and answers `alreadySent`, so the number would wait for a code that never arrived. The service catches the failure, calls `forgetFailedSend(attemptId, phoneNumber)` (deletes the number's `verifications` rows and marks the attempt `smsSent: false`), and throws again (`src/server/auth/login.ts:160-168`). Pinned by "a failing SMS sender fails the send, and leaves the code stored" in `auth.test.ts`.

**4. `callbackOnVerification` runs after the user is created and before the session.**

`routes.mjs:364-384`: `createUser` (line 368), then `callbackOnVerification` (line 379), then `createSession` (line 384). Throwing from the callback stops the session and the cookie. But the user row stays and the code is already used up. The Drizzle adapter's `transaction` option defaults to `false` (`node_modules/@better-auth/drizzle-adapter/dist/index.mjs:566`) and we leave it so: nothing is rolled back. That is why `recordConsentsForVerifiedLogin` can refuse a login with no matching consent: the leftover user row is harmless (the next login reuses it). But never put a step there that must be undone if it fails.

**5. Better Auth's logger receives caught errors as extra arguments. Database errors carry the query's values.**

Better Auth calls `options.log(level, message, ...args)` (`node_modules/@better-auth/core/dist/env/logger.mjs:69`). For example, `ctx.logger.error(e.status, e)` (`node_modules/better-auth/dist/api/index.mjs:217`) passes the whole error. A Drizzle or Postgres error's message includes the bound parameters: phone numbers, codes, session tokens. So:

- `logger: { log: logWithoutDetails }` in `src/server/auth/auth.ts` prints only `[Better Auth] <message>`, or `(details hidden)` when the message isn't text.
- Our own code runs each step through `withoutDetails` (`src/server/auth/errors.ts`). It calls `unstable_rethrow(error)` first, so `redirect()`, `notFound()` and prerender pauses pass through unchanged. Anything else becomes a `LoginServiceError` with the step, the error's name and the Postgres code (`kindOf`), and no message or `cause`. Both the login service and `getCurrentUser()` (`src/server/auth/session.ts`) use it.

**6. Request context for callbacks lives in an `AsyncLocalStorage` on `globalThis`.**

`sendLoginCodeSms` needs the page's language and `recordConsentsForVerifiedLogin` needs the login attempt. The service sets them with `loginRequest.run(...)` around the `auth.api` call. Both callbacks refuse to run without a store, so nothing else can send a code or sign someone in. The auth instance is kept on `globalThis` (`src/server/auth/instance.ts`), so its callbacks survive a hot reload. If `loginRequest` were a plain module constant, a reload of `login.ts` would make a new store: the service would write to the new one, and the kept instance's callbacks would read the old, empty one. Every login would fail until a restart. So the store is `globalThis.loginRequest ??= new AsyncLocalStorage()` (`src/server/auth/login.ts:94-95`). Pinned by "hot reloads under npm run dev" in `login.test.ts`.

**7. Set `advanced.useSecureCookies` yourself.**

Without it, Better Auth decides from the request's protocol, then `baseURL`, then `NODE_ENV === "production"` (`node_modules/better-auth/dist/cookies/index.mjs:23`). We have no `baseURL`, so `next start` on `http://localhost` (`test:e2e`) gets a `__Secure-` cookie that the browser never sends back over HTTP. `instance.ts` passes `secureCookies: env.appEnv !== "local"`.

**8. The Drizzle adapter reads the schema object, not the database.**

- Tables are found by the key you pass in `schema` (`{ user: users, session: sessions, account: accounts, verification: verifications }` in `auth.ts`; `schema[model]` at `node_modules/@better-auth/drizzle-adapter/dist/index.mjs:62`).
- Columns are found by their TypeScript property name, so snake_case SQL names (`phone_number`) are fine.
- The runtime schema check (`introspectDrizzleSchema` / `findDrizzleSchemaProblems`, in a hashed `schema-check-*.mjs` file) compares that object with what Better Auth expects. It never looks at the real tables. Only a test against the migrated database proves the tables match. `auth.test.ts` is that test.

**9. Server Actions and redirects.**

- A `"use server"` file may export only async functions. Shared types and the starting state live elsewhere (`src/lib/login-state.ts`).
- TypeScript can't see that next-intl's `redirect` never returns. In an action that returns a value, write `return redirect({ href, locale }, RedirectType.replace)`, outside any `try` (`src/server/actions/login.ts:81`).
- In the browser, an action that redirects arrives as a **rejected** call. A wrapper that turns rejections into a "couldn't reach the server" message must call `unstable_rethrow(error)` first (`loginSubmitter` in `src/components/account/login-form.tsx:93-100`). Otherwise every successful login shows that error. Pinned by "a correct code's redirect is passed on to Next.js" in `src/components/account/login-form.test.tsx`.

## Why This Matters

Each point fails quietly. Without our own limits, a public endpoint can send unlimited SMS (each costs money from task 44 on). Without the try parsing, people type a 4th code that can't work. Without `forgetFailedSend`, every number that asked for a code during an SMS outage waits up to 5 minutes after it ends. Without the logger, the first database error writes personal data to the logs. Without the `globalThis` store, development breaks after an edit, and it looks like a login bug. Reading the code alone won't tell you which of these are Better Auth's behaviour and which are our choices.

## When to Apply

- **Task 16 (roles):** read the session only through `getCurrentUser()` inside `<Suspense>`. The `role` field is `input: false` in `auth.ts`: a role sent at sign-up is ignored ("a role sent with the code is ignored" in `auth.test.ts`). Any new Better Auth option means a dev-server restart (point 6).
- **Task 23 (booking with an inline code):** reuse `requestLoginCode` and `verifyLoginCode` through a Server Action. Don't call `auth.api` directly, and don't add a Route Handler (point 1). The booking's own checks must not be inside `callbackOnVerification` if they need undoing (point 4).
- **Tasks 35 and 44 (notifications, real SMS):** a new provider runs inside `sendOTP`, after the code is stored (point 3). Keep `forgetFailedSend` on the failure path. Never log the message text or the number (point 5). A provider that needs request context reads it from `loginRequest` (point 6).
- **Any better-auth upgrade:** run `src/server/auth/auth.test.ts` unchanged first, then re-read the lines cited above.

## Examples

Mapping `INVALID_OTP` straight to "wrong code": on the 3rd wrong try the person is told to try again, and the 4th try fails with "too many tries", even with the right code.

Checking the tries left: `src/server/auth/login.ts:202-207` asks `readLiveCode`, and shows `tooManyTries` on the 3rd. `login.test.ts` pins it ("wrongCode twice, tooManyTries on the third, and then even the right code fails").

## Related

- `document/plans/2026-10-28-1155-feat-otp-login-plan.md`: the task 15 plan, "Review changes" first.
- `document/learning/15_auth_otp_login.md`: the task 15 learning doc.
- `document/solutions/conventions/nextjs-16-catch-only-expected-request-api-errors.md`: `unstable_rethrow` first, then catch only what you expect.
- `document/solutions/conventions/nextjs-16-dev-server-is-not-one-process-use-cache-probe.md`: why per-process state lives on `globalThis`, and PGlite's single connection.
- `CLAUDE.md`, "Login and sessions": the short form of these rules.
