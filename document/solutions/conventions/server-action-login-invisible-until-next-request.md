---
title: "A login made inside a Server Action can't be read until the next request, and Better Auth keeps the old login alive"
date: 2026-11-13
category: conventions
module: src/server/auth
problem_type: convention
component: authentication
related_components: [database, frontend]
severity: high
applies_when:
  - "A Server Action checks a login code (verifyLoginCode) and then wants to save something for the new user in the same call: task 47's /book confirm, any later inline login"
  - A page re-renders after an action that logged someone in, and a session read inside it seems to say "logged out" or names the previous user
  - A different phone number logs in on a device that already has a login (a shared phone)
  - Upgrading next or better-auth
retire_when: "Next.js updates headers() when a Server Action sets a cookie (the TODO at node_modules/next/dist/server/async-storage/request-store.js line ~198 is gone), or a better-auth release revokes the previous session in verifyPhoneNumber (re-read node_modules/better-auth/dist/plugins/phone-number/routes.mjs around createSession). Check after each upgrade of either package."
tags: [better-auth, server-actions, session-cookie, headers, react-cache, inline-login, shared-phone, nextjs-16]
---

# A login made inside a Server Action can't be read until the next request

## Context

Task 23 planned a booking page whose last step logs the visitor in with an SMS code and then saves the booking. Research before building found two things the code doesn't show (Next.js 16.4.3, Better Auth 1.7.14):

1. **The new login is invisible for the rest of that request.** `verifyLoginCode` (`src/server/auth/login.ts`) calls `auth.api.verifyPhoneNumber`, which creates the session and sets its cookie through `nextCookies()`. But `getCurrentUser()` (`src/server/auth/session.ts`) reads the session from `await headers()`, and Next.js updates only `cookies()` when an action sets a cookie, not the request headers (`node_modules/next/dist/server/async-storage/request-store.js`: "TODO: does this need to update headers as well?"). `getCurrentUser` is also wrapped in React `cache()`. So for the rest of that action, and for the page re-render Next.js sends in the same response, `authorizeUser()` still sees "logged out", or the *previous* user when one was logged in. A redirect does show the new user, which is why `/login` → `/account` works.
2. **Better Auth never ends the previous login.** `verifyPhoneNumber` (without `updatePhoneNumber`) finds or creates the number's user, calls `createSession`, and overwrites the cookie (`routes.mjs`, around line 384). The old session row stays valid: anyone holding the old token is still logged in.

## Guidance

- **Save anything that needs the new user in the next request.** The code-check action only answers "verified"; the following submit (task 47's "Confirm booking") carries the new cookie, so `authorizeUser()` and every customer data-access function work normally there. Never pass a user id from `verifyPhoneNumber`'s return into the data-access layer to get around this: data-access functions take the user only from the session (`CLAUDE.md`, "Customer data").
- **A client island must not trust the page's session props after an inline login.** The re-render in the same response still says "logged out". Keep the island's own "verified" state, don't key it by user id (a flipping key remounts it and loses every choice), and let the next action's answer carry the new user's data (saved vehicles). What the login call itself returns is fine to use: `verifyLoginCode` reports `needsName` from the user Better Auth just verified, so `/book` shows the name field before the first Confirm (no session read needed).
- **End the old login yourself, in this order** (what `verifyLoginCode` does since task 23):
  1. Before the code check, read the device's current login with `auth.api.getSession({ headers, query: { disableRefresh: true } })`. Only a correctly signed cookie counts.
  2. Check the code with `verifyPhoneNumber`. Never pass `updatePhoneNumber`: it would move the new number onto the user already logged in.
  3. Only after a correct code, if the old session's token differs from the new one, delete it (`deleteSessionByToken`, `src/server/dal/sessions.ts`), inside `withoutDetails` so the token never reaches a log.

  Reading *before* the code check matters: per the comment in `verifyLoginCode`, a stale cookie read afterwards would make Better Auth clear the cookie it just set. That claim has no automated test yet (unit tests can't see the order of `Set-Cookie` headers); an e2e test that logs in, deletes the session row, then logs in again would cover it.

## Why This Matters

Without (1), a booking or a name saved right after the code check fails with "logged out", or, worse, lands on the previous customer's account on a shared phone. Without (2), "log in as someone else" on a shared phone leaves the first customer's login working for anyone with the token, for up to 30 days.

## When to Apply

- Any Server Action that both checks a login code and acts for the user.
- Any page that renders session-dependent parts after such an action.
- Before trusting a Better Auth call to log the previous user out.

## Examples

Tests that pin the behaviour: `src/server/auth/login.test.ts`, "a phone that is already logged in (plan KTD8)": another number logs in and the old token no longer reads a session (the new session belongs to the new user); a wrong code keeps the old login; a forged cookie ends nothing; the same number again leaves one working session.

## Related

- `document/solutions/conventions/better-auth-phone-login-only-from-server-actions.md` (what else Better Auth doesn't do for you)
- `document/solutions/conventions/react-19-form-islands-hydration-action-activity.md` (keeping a form island's state across re-renders)
- Plan `document/plans/2026-11-11-2016-feat-booking-flow-plan.md`, KTD2, KTD8 and KTD10
