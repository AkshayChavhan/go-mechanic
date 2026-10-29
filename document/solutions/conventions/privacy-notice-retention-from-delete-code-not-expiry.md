---
title: "Privacy notice: \"how long we keep it\" comes from the code that deletes rows, ours and the library's, not from an expiry setting"
date: 2026-10-29
category: conventions
module: "src/app/[locale]/(site)/privacy"
problem_type: convention
component: authentication
severity: high
applies_when:
  - Writing or changing the privacy notice (messages/en.json PrivacyPage.items) for any personal data
  - A task adds a table, a column, a cookie or a provider that stores personal data (tasks 21, 23, 30, 35, 37, 43)
  - A task starts filling a column that already exists but is empty today (users.name, users.image)
  - A setting such as LOGIN_RULES, a session length or a code lifetime changes
  - Better Auth is upgraded past 1.7.14
symptoms:
  - "The notice said a login code is deleted after 5 minutes: the 5 minutes is when it stops working"
  - "The notice said sessions are kept 30 days: an expired session is never deleted"
  - "The notice said login attempts are deleted after 48 hours: they are deleted only when someone next asks for a code"
  - "The session's IP address and user agent were described as needed to stay logged in: no code reads them"
- "The notice said the site sets one cookie: next-intl also sets NEXT_LOCALE for a request with no Accept-Language"
related_components: [documentation, database]
tags: [privacy-notice, dpdp, retention, better-auth, personal-data, consent, fingerprint, coverage-test]
---

# Privacy notice: "how long we keep it" comes from the code that deletes rows

## Context

Task 19 wrote `/privacy`, the draft privacy notice. People agree to it at login (`LOGIN_NOTICE_VERSION`), and India's DPDP Rules ask it to say, for each kind of personal data, what is kept, why and for how long.

The same mistake happened three times in one task: a setting that says when something **expires** was written down as when it is **deleted**.

- Plan research caught two of them. The session's IP address and browser type were described as kept 48 hours (they stay until logout), and old login attempts as deleted on a timer.
- `ce-code-review` caught three more: codes, expired sessions, and "we keep it only when you log in".
- `code-reviewer` caught a sixth. The session's IP address and user agent were explained as "to keep you logged in", but nothing reads them.

Each one read well and was wrong. Only reading the delete statements, in our code and in Better Auth's, showed the truth.

## Guidance

### 1. For each table, find the statement that deletes its rows

An expiry column (`expires_at`), a lifetime constant (`codeLifetimeSeconds`) or a limit (`keepRecordsHours`) says when a row stops counting. It doesn't say when the row is gone. Search for the `delete` that removes the row, and note what triggers it:

| Data | Expiry setting | What really deletes it (2026-10-29) |
| --- | --- | --- |
| `login_attempts` | `LOGIN_RULES.keepRecordsHours` (48) | `decideAndRecordAttempt` in `src/server/dal/login-codes.ts` deletes rows older than 48 hours **when someone next asks for a code**. No timer. |
| `verifications` (codes) | `codeLifetimeSeconds` (5 minutes) | Better Auth's `consumeVerificationValue` on use. `findVerificationValue` (`node_modules/better-auth/dist/db/internal-adapter.mjs`) deletes **every** expired code whenever anyone's code is checked. A new code doesn't delete the old one. Our `forgetFailedSend` deletes a number's codes after a failed SMS. |
| `sessions` | `sessionDays` (30) | Only logging out. Better Auth filters out expired sessions only in its secondary-storage lists (we don't use secondary storage). **An expired session row stays in the database.** |
| `sessions.ip_address`, `user_agent` | none | Written by Better Auth at session creation (`internal-adapter.mjs`, around line 275). No code in `src/` reads them. `advanced.ipAddress.disableIpTracking` (`node_modules/@better-auth/core/dist/utils/ip.mjs`, `getIP`) blanks **only the IP**. The user agent is always written. |

Cookies work the same way: list them from real responses' `Set-Cookie` headers, not from what you expect. In task 19 the notice said "one cookie", but a browser test showed next-intl's proxy also sets `NEXT_LOCALE=en` on any page request with no `Accept-Language` header (`syncCookie` in `node_modules/next-intl/dist/esm/development/middleware/syncCookie.js`). Browsers always send one; Playwright's API requests don't. `e2e/info-pages.spec.ts` now checks both cases.

Write "how long" as that trigger, in plain words. For example: "We delete these records once they're more than 48 hours old, the next time anyone asks for a code. They aren't yet deleted on a timer." Write "why" from the code that reads the data. If nothing reads it, say so: "recorded by the login software with every login; we don't use them for anything yet".

### 2. Take the numbers from the rules, and pin them with the wording

The notice's hours, minutes, days and the code's length come from `PRIVACY_NOTICE_VALUES` (`src/domain/consent.ts`), which reads `LOGIN_RULES`. They're never typed into `messages/en.json`. `consent.test.ts` hashes the wording **and** those values. So changing a rule the notice mentions fails the test until `LOGIN_NOTICE_VERSION` moves. A fingerprint of the wording alone missed this: `ce-code-review` showed that a rule change silently changed what people agree to.

### 3. Know what the coverage test can't see

`src/app/[locale]/(site)/privacy/coverage.test.ts` lists every table, and every column of the personal-data tables. A new table or a new column fails it. But a task that starts **filling a column that already exists** changes nothing it can see. `users.name` is "Empty for now: the profile (task 21) asks for a name", and it's already in the list. Such a task must update the notice on its own. The first version of the test's comment promised the opposite, and `code-reviewer` caught it.

### 4. Version and fingerprint

A change to the notice's wording or values moves `LOGIN_NOTICE_VERSION` and re-pins the fingerprint in `consent.test.ts`. A second change on the same day uses a suffix (`2026-10-29.2`); `/privacy` shows `noticeDate()`, the date part. A wording that never reached `main` may be re-pinned under its own version, as task 19 did twice.

## Why This Matters

People agree to the notice, and the consent record keeps the version they saw. A notice that says "deleted after 5 minutes" while the row stays for days misleads them about exactly what they agreed to. The DPDP Rules require the real purpose and retention. These mistakes look right to a reviewer who hasn't opened the library's code, which is why they got past the first draft three times.

## When to Apply

- Before writing any `PrivacyPage.items` entry, or changing one.
- When a task adds or starts using personal data. The coverage test catches new tables and columns, but not newly filled ones.
- After a Better Auth upgrade: re-read `internal-adapter.mjs` (session create, `findVerificationValue`, `consumeVerificationValue`) and `getIP`. The facts in the table above are for 1.7.14.
- When task 43 adds scheduled deletion: update the "how long" lines to the new trigger in the same change.

## Examples

Before (from expiry settings):

> A code works for 5 minutes, then it's deleted.

After (from the delete code):

> A code works for {minutes} minutes. We delete it once it's used, or after too many wrong tries. A code that has stopped working is deleted the next time anyone types a code on the website; until then it stays in our records, even after a new code is sent.

## Related

- `document/learning/19_info_pages.md`: How step 2 and Reviews.
- `document/solutions/conventions/better-auth-phone-login-only-from-server-actions.md`: what Better Auth does and doesn't do in this app.
- Backlog in `document/task/task.md`: the task 21 line (`users.name`) and the task 43 line (scheduled deletion, `disableIpTracking`).
