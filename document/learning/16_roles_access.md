# 16_roles_access: who may do what, and real redirects for login pages

> **Branch:** `16_roles_access` · **Date:** 2026-10-28 · **Status:** In progress

## In one minute

Task 15 answered "who are you?" (a login by SMS code). This task answers "what may you do?". One table now says what each role (customer, mechanic, manager, owner) may do. Whoever logs in with the garage's own number is the owner. Saving the garage's details now refuses anyone but the owner or a manager, before it touches the database.

The proxy also sends real 307 redirects: a logged-out `/account` goes to `/login`, and a logged-in `/login` goes to `/account`. Nothing visible changed on the pages.

Full details: [the plan](../plans/2026-10-28-1836-feat-roles-access-plan.md) and the "Roles and access" block in `CLAUDE.md`.

## Why: the problem we solved

- **Every user was a customer, and nothing said what a role may do.** The staff tasks (26–41) need checks to build on. Without one shared rule, each task would write its own `role === "owner"` checks, and one forgotten check would let a customer reach staff data.
- **There was no owner.** The owner must log in like everyone else (by code) and then hold the owner role. No browser request may ever choose a role.
- **`saveGarage` had no guard.** It changes what every visitor sees, so its file simply said "nobody may call this yet".
- **Redirects came with status 200.** `/account` reads the session inside `<Suspense>`. By the time it finds nobody logged in, the page has already started answering 200, so it can only redirect in the browser.

The master plan names the main risk: users reaching other people's data by changing an id in a URL.

## What: what changed

| File | Change | Why it exists |
| --- | --- | --- |
| `src/domain/permissions.ts` + test | Added | The permission table and `can(role, permission)`. The test holds a hand-written copy |
| `src/domain/roles.ts` + test | Changed | `effectiveRole`: the owner rule |
| `src/server/env.ts` + test, `.env.example` | Changed | The `OWNER_PHONE_NUMBER` setting |
| `src/server/dal/users.ts` + test | Added | `syncOwnerRole`: writes the owner rule into `users.role` at each login |
| `src/server/auth/login.ts`, `instance.ts` + test | Changed | `onVerifiedLogin`: consents first, then the owner role |
| `src/server/auth/session.ts` + test | Changed | `getCurrentUser()` returns the effective role |
| `src/server/auth/access.ts` + test | Added | `requireUser`, `requirePermission`, `authorize`, `authorizeUser`, `AccessDeniedError` |
| `src/server/dal/garage.ts` + test | Changed | `saveGarage` calls `authorize("garage.edit")` first |
| `src/lib/access-routes.ts` + test | Added | The proxy's decision (`accessRedirect`), `hasSessionCookie`, the `?session=ended` marker |
| `src/proxy.ts` + test | Changed | Runs that decision before next-intl |
| `src/components/account/account-details.tsx`, `login/redirect-if-signed-in.tsx` | Changed | `/account` uses `requireUser`; comments say what the proxy now does |
| `e2e/access.spec.ts`, `e2e/helpers.ts` | Added, Changed | 5 browser tests; `logInThroughTheForm` |
| `CLAUDE.md`, `readme.md`, `task.md` | Changed | The rules for later tasks; how to log in as the owner; follow-ups |

The branch's first commit, `c418507 docs(15): mark task 15 done`, is task 15's bookkeeping. That's why `15_auth_otp_login.md` also differs from `main`. No schema change and no migration: `users.role` exists since task 15.

## How: step by step

1. **Plan, in two tries.** The first `ce-plan` run ended without a plan. `claude -p` stops background helpers still running 10 minutes after its last turn ("Background tasks still running 10m after the last turn ... stopping them. Set CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0"). Its lessons review had already flagged three risks, which went into the second run's brief: a redirect loop with a leftover cookie, keeping the proxy away from form posts, and checking the role before a transaction. The second run, with `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0`, wrote the plan and then hung ([the known hang](../solutions/workflow-issues/ce-plan-child-session-hangs-use-idle-watcher.md)). The idle watcher stopped it after 10 idle minutes. It killed only that run's processes, by PID (matching "Task 16_roles_access"), because other sessions may run `ce-plan` too. Whether its document review finished is unknown.

   **The owner's decision (2026-10-28):** the owner's login number is the garage's own number, +91 97647 50567 ("The garage number").

2. **One permission table** (`src/domain/permissions.ts`). Code asks about a *permission*, never a *role*:

   | Permission | Customer | Mechanic | Manager | Owner | First used by |
   | --- | --- | --- | --- | --- | --- |
   | `admin.open` | – | yes | yes | yes | 26 |
   | `bookings.manage` | – | – | yes | yes | 26, 27 |
   | `jobs.update` | – | yes (own jobs) | yes | yes | 31 |
   | `customers.contact` | – | – | yes | yes | 26, 29, 31 |
   | `estimates.manage` | – | – | yes | yes | 33 |
   | `garage.edit` | – | – | yes | yes | 16 (`saveGarage`), 28, 40 |
   | `content.edit` | – | – | yes | yes | 37–40 |
   | `team.manage` | – | – | – | yes | 29 |
   | `reports.view` | – | – | yes | yes | 41 |

   Why not `if (role === "owner" || role === "manager")`? Spread over every staff page and save (tasks 26–41), that's many places to review, and many chances to forget one. With the table, "may a manager see reports?" is one row, and `permissions.test.ts` pins every cell. A customer's own data (their vehicles, their bookings) isn't a permission: the rule there is "logged in, and the row is yours".

3. **The owner is a setting, `OWNER_PHONE_NUMBER`.** `serverEnv()` reads it and checks it's an Indian mobile in `+91…` form. Locally it defaults to the garage's number. Staging and production refuse to start without it. The plan rejected four other ways (its KTD2):
   - **the garage's phone in the database:** managers may edit the garage's details, so a manager could make their own number the owner;
   - **a seeded owner user:** the seed runs only on a fresh local database, and changing the number would need SQL;
   - **a constant in code:** every number change would need a pull request;
   - **Better Auth hooks:** they would work, but they hide role logic in Better Auth's settings and don't cut off an old owner's session that is still open.

4. **The effective role on every read, the stored role at each login.**
   - `effectiveRole(storedRole, phoneNumber, ownerPhoneNumber)`: the owner's number is `owner`; a stored `owner` on any other number is `customer` (the SIM may be lost); any other stored role stands.
   - `getCurrentUser()` applies it on **every** session read. Change the setting, **then redeploy** (or restart the server: `serverEnv()` reads settings once per process), and the new number is the owner from then on, even inside a 30-day login. If the garage SIM is ever lost or stolen: change `OWNER_PHONE_NUMBER` on Vercel and redeploy at once. Until the redeploy, the old SIM keeps owner access. (The first version of this doc said "on its next request"; `ce-code-review` caught it.)
   - `syncOwnerRole` writes the same rule into `users.role` at each login, after the consents. It runs inside Better Auth's `callbackOnVerification`, so a failure means no session. The stored role is only a hint: it goes stale for anyone who doesn't log in again, so code that reads another user's role (the team list in task 29, reports in task 41) must pass it through `effectiveRole`, never filter on `role = 'owner'` in SQL.

5. **Four checks** (`src/server/auth/access.ts`). All read the session; three of them ask the table:

   | Helper | Where | Logged out | Logged in, not allowed |
   | --- | --- | --- | --- |
   | `requireUser(locale)` | pages, Server Actions | redirect to `/login?session=ended` | (no permission asked) |
   | `requirePermission(locale, p)` | pages, Server Actions | the same redirect | `notFound()`: the 404 page |
   | `authorize(p)` | `src/server/dal/`, first line, staff work | `AccessDeniedError` (`signedOut`) | `AccessDeniedError` (`notAllowed`) |
   | `authorizeUser()` | `src/server/dal/`, first line, a customer's own data | `AccessDeniedError` (`signedOut`) | (no permission asked: customers hold none) |

   - **Why a 404 and not a 403?** A 404 doesn't even admit a staff page exists. Next.js's `forbidden()` (403) is still experimental in 16.4.3: it needs `experimental.authInterrupts` (bundled `04-functions/forbidden.md`). Task 26 revisits it. One catch: these checks read the session, so in a page they sit inside `<Suspense>`, and by then the page has started answering 200. So the 404 page shows with status 200 and `noindex`, just as the redirect happens in the browser (bundled `02-guides/streaming.md`, "Status codes"). A browser test checks the page shown, not the status.
   - **Why does the data-access layer read the session itself?** So no caller can hand it a made-up user, and a check forgotten in a page can't open a save. The same goes for user ids: a function over a user's own data takes the user from `authorizeUser()` (staff work: `authorize`), never a `userId` argument, and filters by it in the query's `WHERE`. Three kinds of function don't check, by design: public reads (cached or live), writes made during a login (before a session exists), and functions that take the caller's transaction (task 22's slot functions: the caller checks before it opens the transaction).

6. **`saveGarage` checks first.** `await authorize("garage.edit")` is its first line, before `checkGarage`, `getDatabase()` and the transaction. Two reasons for "first":
   - **PGlite has one connection.** A session read is a database query. Made inside a transaction, which holds that connection, it would wait forever.
   - **A refused user learns nothing.** A customer who sends broken details gets `AccessDeniedError`, not a list of what's wrong.

7. **The proxy's 307s** (`src/lib/access-routes.ts`, called by `src/proxy.ts`). The proxy runs before any page, so it can still choose the status code. It's an **optimistic** check: it only looks for the session cookie, with no database read and no signature check, as the Next.js auth guide advises. The pages still do the real check.
   - **GET and HEAD only.** Server Actions are POSTs to the page's own path: the login form posts to `/login`, and Log out posts to `/account`. Redirecting those would break logging in and out.
   - **Our own cookie check.** The plan said to import `getSessionCookie` from `better-auth/cookies`. That pulls Better Auth's JWT, crypto and database helpers into every request, so `hasSessionCookie` is ten lines of our own. A test compares it with Better Auth's `getSessionCookie` on six headers, so a renamed cookie still fails a test.

8. **The leftover-cookie loop, and its marker.** A cookie whose session is gone (after `npm run db:reset`, say) still passes the proxy. Without a marker: `/login` sends you to `/account`, the page sends you back to `/login`, and so on. The page's redirect adds `?session=ended`, and the proxy lets that through:

   | Step | Request | Cookie | What answers |
   | --- | --- | --- | --- |
   | 1 | GET `/login` | leftover | proxy: 307 to `/account` |
   | 2 | GET `/account` | leftover | proxy lets it through; the page finds no session and redirects in the browser |
   | 3 | GET `/login?session=ended` | leftover | proxy lets it through (marker); the login form shows |
   | 4 | POST `/login` (log in) | replaced | proxy lets it through (POST); the new cookie overwrites the old one |

9. **Browser tests** (`e2e/access.spec.ts`). They read the 307 itself with `page.request.get(path, { maxRedirects: 0 })`: `maxRedirects: 0` stops Playwright from following the redirect. The first run had `2 failed`, `67 passed (1.4m)`. The new helper `logInThroughTheForm` loaded the messages with `await import("../messages/en.json")`, and Playwright's loader refused it ("needs an import attribute of type: json"). A static `import messages from "../messages/en.json"` fixed it.

10. **Proving the guards can fail.** Each guard was broken on purpose, a test had to fail, and then the code was restored:
    - changing one cell of the table fails its test;
    - removing `syncOwnerRole` from the login fails 2 tests;
    - removing `effectiveRole` from the session read fails 2;
    - removing the `OWNER_PHONE_NUMBER` mobile check fails 3;
    - in `saveGarage`, removing `authorize` fails 4, and moving it after the validation fails 1.

    One of these was badly made at first. It moved `authorize` down one line, below `checkGarage` but still above the `return { ok: false, problems }`. `checkGarage` only computes a list, so nothing anyone could observe changed, and no test failed. Redone properly, the check moved below that `return`. Now a customer with broken details gets problem codes instead of `AccessDeniedError`, and 1 test fails. **The lesson:** a mutation must change what the code *does*, not just where a line sits. Ask first: "what would a caller see differently?"

11. **Working next to two other sessions.** Session 2 (tasks 17, then 18) and Session 3 (tasks 22, then 19, 20) worked in their own folders on one shared git repository. The rules: only this branch, files staged by name, no stash, rebase or force. In `task.md` this task edited only its own row and steps. So the follow-ups for tasks 20, 21, 23, 25, 26, 28, 29, 31 and 40 went to the end of the backlog, not into those tasks' steps. `git fetch origin` before the docs commit showed nothing new on `main`. But task 22 (Session 3) was merged into `main` while the reviews ran, and the final `code-reviewer` check found this branch no longer merged cleanly. `git merge origin/main` then gave two conflicts, both where each task had added text at the same spot: the `src/domain/` and `src/server/` rows of `CLAUDE.md`'s repo map with "Roles and access" next to task 22's "Booking slots", and the end of `task.md`'s backlog. Both were resolved by keeping both sides: one row each listing both tasks' files, both blocks, and both backlog lists (task 22's first). The rules also had to meet: task 22's slot functions take the caller's booking transaction and must never query outside it, so this task's "check on the first line" rule now names them as an exception (the function that opens the transaction checks before it opens it). Otherwise a later session might add `authorize()` to `reserveSlot`, and every booking would hang. `garage.ts` changed on both sides (task 22 exported `weeklyHours`), and merged by itself.

    The machine's load average reached 40+ at times (three sessions' tests and builds, plus Docker Desktop). Twice the full `npm run check` failed only by timeouts: first the lint-guard test (at 36 s), then 10 files. It passed when re-run after a background watcher saw the load fall below 15.

## Decisions worth knowing

| Choice | Why | What it costs |
| --- | --- | --- |
| Ask a permission, never compare roles | One table to review and to pin | Every new permission needs a table row and a test row |
| The owner is a setting | Managers can't make themselves owner; a lost SIM is one settings change | Owner access rests on one SIM until a second factor (task 44 candidate) |
| `syncOwnerRole` reads, then reuses `effectiveRole` (plan: one SQL `UPDATE`) | The owner rule lives in one place | Two queries at login instead of one |
| Own `hasSessionCookie` (plan: import `better-auth/cookies`) | Keeps Better Auth's crypto out of every request | Must track Better Auth's cookie names: the comparison test does that |
| 404 for "not allowed", not 403 | `forbidden()` is experimental; 404 hides staff pages | No "you don't have access" page |
| The leftover cookie isn't cleared | Clearing it on a GET would let any website log you out with a link | The marker handles the loop instead |
| No role shown on `/account` | Nobody asked; task 26's navigation shows it first | You can't see your role in the UI yet |

## New ideas in this task

- **Authentication vs authorization:** authentication proves *who you are* (task 15's SMS code). Authorization decides *what you may do* (this task). At a garage, the gate guard checks your ID; the list on the parts-store door says who may go in.
- **Permission:** a named action, like `garage.edit`. Roles get permissions from the table; code asks only `can(role, permission)`.
- **Stored vs effective role:** the stored role is what `users.role` says. The effective role is that, with the owner rule applied, worked out on each request.
- **Optimistic check:** a quick check on data you can't fully trust (here: "is a cookie there?"). Good for redirects, never enough on its own.
- **307 Temporary Redirect:** "go there instead, with the same method". It works only before the page starts answering.
- **Leftover cookie:** a session cookie whose session no longer exists on the server.
- **IDOR (insecure direct object reference):** reaching someone else's data by changing an id, say `/account/vehicles/43` instead of `42`. The fix is in the query: `WHERE id = 43 AND user_id = <user from the session>`.
- **Mutation check:** break the code on purpose, and make sure a test fails.

## Check that it works

Real output, Node 24 (`fnm exec --using=24 -- …`, trimmed), from the final code: after the `ce-code-review` fixes and the merge of `main` (2026-10-29). The numbers include task 22's tests, which came in with the merge.

`npm run check`, at a load average near 8:
```
 Test Files  80 passed (80)
      Tests  1277 passed (1277)
```
(Before the merge: 77 files, 1154 tests. The first full run after the merge, at a load near 15, failed only by timeouts: seven database test files' setups hit the 60-second limit and the ESLint guard test took 46 seconds. The server tests alone passed, 19 files and 259 tests, and the full run passed once the load dropped.)

Only the new rules and the proxy:
```bash
npx vitest run src/domain/permissions.test.ts src/domain/roles.test.ts src/lib/access-routes.test.ts src/proxy.test.ts src/server/auth/access.test.ts
```
```
 Test Files  5 passed (5)
      Tests  75 passed (75)
```

From the work session's final runs:
- `npm run test:e2e`: `69 passed (1.8m)` on the merged code, 5 of them new in `e2e/access.spec.ts`. (After the review fixes, before the merge: `69 passed (2.1m)`; the very first run, `2 failed`, is in step 9.)
- `npm run build`, re-run after the review fixes because `saveGarage` now imports the checks (and so Better Auth) into the home page's import graph: the route list kept its shapes. `/` is still `○ /en`; `/en/login` and `/en/account` are still `◐` (a prebuilt shell plus a streamed part):
  ```
  ├   /[locale]                      30d      1y
  │ ├ ◐ /[locale]                    30d      1y
  │ └ ○ /en                          30d      1y
  ├   /[locale]/account              30d      1y
  │ ├ ◐ /[locale]/account            30d      1y
  │ └ ◐ /en/account                  30d      1y
  ...
  ├   /[locale]/login
  │ ├ ◐ /[locale]/login
  │ └ ◐ /en/login                    30d      1y
  ```
- `npm run test:design`: not needed. No design token, `type-*` style or `ui/`/`site/` component changed.

To try it yourself (not done for this doc, so as not to start a dev server on this session's port 3000 while checks were running):
1. Run `npm run dev`. In another terminal, run `curl -sI http://localhost:3000/account` (`-s` hides the progress bar; `-I` sends a HEAD request, which asks for the headers only, and the proxy redirects HEAD like GET). `e2e/access.spec.ts` checks the same request answers 307 with a `Location` of `/login`.
2. Open http://localhost:3000/login and log in with `97647 50567`. Read the code on http://localhost:3000/dev/outbox. You're the owner now, though `/account` doesn't show roles yet.

## Checks and reviews

- **`ce-code-review`: "Ready with fixes".** No P0 or P1: no reviewer found a way for a browser to set a role or reach `saveGarage`. Its first run didn't start (the account's usage limit); the second ran seven reviewers. All five findings were confirmed and fixed, one commit each:
  - **#3, the important one: a new owner's number needs a redeploy.** The docs promised a changed `OWNER_PHONE_NUMBER` works "on the next request". But `serverEnv()` reads the settings once per process, so on Vercel it takes effect only after a redeploy. On the day a SIM is stolen, an owner who trusted the old wording would leave the thief with owner access. Every place now says "change it, then redeploy", and step 4 above has the lost-SIM steps.
  - **#2: the stored role is only a hint.** `users.role` is brought in line at each login, so it goes stale for anyone who doesn't log in again. Code that reads another user's role (the team list, reports) must pass it through `effectiveRole`, never filter on `role = 'owner'` in SQL.
  - **#1 and #5: the rule didn't fit two kinds of code.** "Take the user from `authorize`" can't work for a customer's own data, because customers hold no permission. New: `authorizeUser()` (logged in is enough; the function filters by that user's id). And writes during a login, before a session exists, can't check at all; the rule now names that one exception, so nobody "fixes" `syncOwnerRole` by adding `authorize` and breaks every login. The rule also covers private reads now, not just writes.
  - **#4:** `CLAUDE.md` and `login.ts` still named the old callback; it's `onVerifiedLogin` now.
  - **Smaller notes, also done:** `requireUser` now *replaces* the history entry (inside a Server Action a redirect would otherwise add one); the proxy decodes the path first, so a logged-out `/%61ccount` gets the same 307; and three tests the review asked for: the `getAuth()` wiring, the cookie names read from our own Better Auth settings on http *and* https, and a role step that fails after the consents (no session, consents kept, a new code works).
  - **Left as notes for later tasks:** a later change of a user's phone number must go through a code (the number is the key to the owner role: task 21); once task 29 writes roles, `syncOwnerRole`'s read-then-write needs a compare-and-set; a leftover cookie keeps bouncing `/login` through `/account` until it expires (harmless, no loop).
- **`code-reviewer` agent: "Needs changes", then fixed.** It found no way to escalate a role, no secrets and nothing that logs a person. Its two must-fixes:
  - **The branch no longer merged with `main`.** Task 22 had landed there during the reviews. Merged and resolved (step 11). The rule now names task 22's exceptions, so nobody adds a session check inside a booking transaction.
  - **This doc still taught the replaced rule** ("take the user from `authorize`" for a customer's own data) and listed three checks. Now four checks, with `authorizeUser()`; the task 21 backlog line and the `CLAUDE.md` repo map say so too.

  Also done: "the 404 page" inside `<Suspense>` answers status 200 (said in `CLAUDE.md` and step 5), and "a Server Action *that needs a login* calls `requireUser` first". Noted, not changed: four early commit bodies were a single sentence, against the rule of two to four (history isn't rewritten; later commits follow it).
- **SEO check:** Pending, if the hook asks (`AccountDetails` and a login page comment changed).
- **Compound step: one lesson updated, one new**, because each would otherwise cost the next session the same investigation, and both matter to all three sessions:
  - [`ce-plan-child-session-hangs-use-idle-watcher.md`](../solutions/workflow-issues/ce-plan-child-session-hangs-use-idle-watcher.md), updated: `claude -p` can exit with no plan (its helpers stopped after 10 minutes; `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0`), and with parallel sessions the watcher and the stop command match only your own run.
  - [`full-check-times-out-under-parallel-session-load.md`](../solutions/workflow-issues/full-check-times-out-under-parallel-session-load.md), new: how to tell timeouts from real failures when sessions share the laptop, and how to wait for the load to drop instead of raising limits.
  - Not written: a lesson on the proxy's 307 with the `?session=ended` marker. The "Roles and access" rules in `CLAUDE.md` already say it, and task 26 will read them.
- **Pull request:** Pending, after the owner says yes.

## Common mistakes

- **`if (user.role === "owner")` in a page.** Ask `can(user.role, "…")` or call `requirePermission`. Only `permissions.ts` and `roles.ts` compare roles.
- **Checking only in the page or the layout.** The proxy and the page are shortcuts. The save itself must call `authorize` on its first line.
- **A `userId` parameter on a data-access function.** Take the user from `authorizeUser()` (or `authorize` for staff work), and filter by it in the query.
- **Calling `authorize` or `authorizeUser` inside a transaction** (or adding one to a slot function that takes the caller's transaction). Its session read waits forever on PGlite's one connection: check before the transaction opens.
- **Redirecting POSTs in the proxy.** Login and Log out are POSTs to `/login` and `/account`.
- **Forgetting `?session=ended`.** A redirect to `/login` from a page without it can loop when a leftover cookie is present. `requireUser` adds it for you.
- **Changing the table without the test copy.** `permissions.test.ts` fails until both agree, by design.
- **`await import()` of a JSON file in Playwright code.** Use a static `import`.

## Try it yourself

About 10 minutes. Predict each answer first, and finish with `git status` showing a clean tree.

1. What does `effectiveRole` return for each line? The owner's number is `+919764750567`.
   ```bash
   node --no-warnings -e 'import("./src/domain/roles.ts").then(({ effectiveRole }) => { const owner = "+919764750567"; for (const [stored, number] of [["customer", owner], ["owner", "+919876543210"], ["manager", "+919876543210"], ["mechanic", owner]]) console.log(stored, number, "->", effectiveRole(stored, number, owner)); })'
   ```
2. Add `"reports.export": ["owner"],` under `reports.view` in `src/domain/permissions.ts`. Run `npx vitest run src/domain/permissions.test.ts`, then `npm run typecheck`. What fails in each, and why? Undo it (`git restore src/domain/permissions.ts`). Next, give mechanics `customers.contact` (`["mechanic", "manager", "owner"]`) and run the test again. Which tests fail now? Undo it the same way.
3. In the 4-step table above, what happens if `accessRedirect` ignores `?session=ended`?

Answers.

(1) Real output:
```
customer +919764750567 -> owner
owner +919876543210 -> customer
manager +919876543210 -> manager
mechanic +919764750567 -> owner
```

(2) Real output from a throwaway copy outside the repo (the type error comes from `tsc` on that one file, not from `npm run typecheck`). The test sees a permission it doesn't know:
```
 FAIL  src/domain/permissions.test.ts > can (who may do what) > the table is exactly the agreed one, role by role
+   "reports.export",
      Tests  1 failed | 4 passed (5)
```
TypeScript also refuses, because the test's copy is typed `Record<Permission, …>`: `error TS2741: Property '"reports.export"' is missing in type …`. Giving mechanics `customers.contact` fails two tests: the table test (`mechanic customers.contact: expected true to be false`) and "a mechanic opens the admin and updates jobs, but never sees how to contact customers". The second one states the master plan's rule in words, so the failure explains itself.

(3) (Worked out from the code, not run.) Step 3 would get a 307 back to `/account`, and steps 2 and 3 would repeat forever: the visitor could never reach the login form to replace the cookie.

## Learn more

- Next.js, the bundled copy in `node_modules/next/dist/docs/01-app/`:
  - `02-guides/authentication.md`: "Optimistic checks with Proxy" and the data-access layer;
  - `02-guides/data-security.md`;
  - `03-api-reference/03-file-conventions/proxy.md`: Server Functions are POSTs to their own route;
  - `03-api-reference/04-functions/forbidden.md` (experimental), `not-found.md`, `redirect.md`;
  - `02-guides/streaming.md`, "Status codes": why a redirect inside `<Suspense>` is a 200.
- OWASP: [Insecure Direct Object Reference Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html) and [Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) cheat sheets.
- MDN: [307 Temporary Redirect](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/307).
- Better Auth: [cookies](https://better-auth.com/docs/concepts/cookies) (the cookie names the proxy looks for).
- Playwright: [`APIRequestContext.get`](https://playwright.dev/docs/api/class-apirequestcontext#api-request-context-get) and its `maxRedirects` option.
