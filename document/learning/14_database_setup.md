# 14_database_setup: the garage's details move into a database

> **Branch:** `14_database_setup` · **Date:** 2026-10-28 · **Status:** In progress

## In one minute

The garage's phone, WhatsApp, address and opening hours now live in a Postgres database, not in a TypeScript file. Visitors see no change: the details are the same, and `/` is still built ahead of time (`○ /en`). Underneath, every later task now has something to build on:

- tables written in TypeScript with Drizzle, plus committed SQL migrations;
- a seed with the owner's real details;
- one data-access layer that runs every query;
- checked server settings, and a clock that tests can stop.

Locally the database is PGlite, Postgres running inside Node, so a fresh clone still needs only `npm ci && npm run dev`. Full details: [the plan](../plans/2026-10-27-2221-feat-database-setup-plan.md) (R1–R12, KTD1–KTD13, units U1–U8) and the "Database" block in `CLAUDE.md`.

## Why: the problem we solved

Task 12 put the garage's details in `src/content/garage.ts` and sent every read through one function, `readGarage()`, so this task would only have to swap that function. But only a developer can change a file. The master plan has the owner edit the hours (task 28) and the garage info (task 40) from admin screens. Tasks 15 to 27 need tables for users, vehicles, slots and bookings. None of that can start without a database, migrations and one agreed place for queries.

Three constraints shaped the work:

- **Visitors must notice nothing.** Same details, the page still prebuilt, and no database code in what phones download.
- **No Docker, no cloud account.** Supabase comes in task 20. Until then, cloning the repo and running it must just work.
- **The owner is learning.** The setup has to be explainable: where the data lives, how a schema change ships, and why one folder must never be opened twice.

## What: what changed

| File or folder | Change | Why it exists |
| --- | --- | --- |
| `package.json`, `package-lock.json` | Changed | Four packages pinned exactly; the `db:generate` and `db:reset` scripts |
| `next.config.ts` | Changed | `serverExternalPackages` and `outputFileTracingExcludes` for PGlite (step 8) |
| `vitest.config.mts` | Changed | Points `server-only` at Next.js's empty file, so server code loads in tests |
| `drizzle.config.ts` | Added | drizzle-kit settings: the schema file and the migrations folder. No credentials |
| `.gitignore`, `.env.example` | Changed, Added | Ignore `.pglite/` and `.pglite.lock`; list `APP_ENV` and `DATABASE_URL` with fake values |
| `src/server/env.ts` + test | Added | `serverEnv()`: the server's settings, read and checked in one place |
| `src/lib/clock.ts` + test | Added | `Clock`, `systemClock`, `fixedClock()`: where code gets "now" |
| `src/domain/garage.ts` + test | Added | The `Garage` type (moved here) and `checkGarage()`, the rules a save must pass |
| `src/domain/opening-hours.test.ts` | Changed | A comment that pointed at `src/content/garage.ts` |
| `src/server/db/schema.ts` | Added | The two tables and the `weekday` enum, in TypeScript |
| `src/server/db/migrations/` | Added | `0000_garage_settings.sql` and `meta/`: the SQL drizzle-kit wrote from the schema |
| `src/server/db/seed-data.ts` + test | Added | `ownerGarage`: the owner's real details, plain data |
| `src/server/db/seed.ts` | Added | `seedGarage()`: puts the owner's garage into a new database, never over an existing one |
| `src/server/db/index.ts`, `database.test.ts` | Added | `getDatabase()`: picks, opens, migrates and seeds the right database, once per process; Next.js helper processes never open the folder |
| `src/server/db/folder-lock.ts` | Added | The `.pglite.lock` file: one process at a time opens `.pglite/`. A lock left by a process that has stopped is taken over. Added after the code review (see "Checks and reviews") |
| `src/server/dal/garage.ts` + test | Added | `readGarage()` (cached) and `saveGarage()`: the only code that queries the garage |
| `src/content/garage.ts` + test | Removed | Replaced by the database and `seed-data.ts` |
| `src/components/site/site-chrome.tsx` + test | Changed | Gets `garage` as a prop instead of reading it |
| `site-header`, `site-footer`, `action-bar`, `not-found-content` (+ tests) | Changed | Import `Garage` from the domain; tests use `ownerGarage` |
| `src/app/[locale]/(site)/layout.tsx`, `src/app/global-not-found.tsx` | Changed | Read the garage and pass it to `SiteChrome` |
| `(site)/page.tsx`, `[locale]/not-found.tsx`, `dev/design/page.tsx` (+ tests) | Changed | Async now: they `await readGarage()` and use `getTranslations` |
| `e2e/server-boundary.spec.ts` | Added | Fails if database code reaches the browser's files |
| `e2e/home.spec.ts`, `e2e/layout-shell.spec.ts` | Changed | Expect `ownerGarage`'s values |
| `CLAUDE.md`, `readme.md`, `MASTER.md`, `.claude/agents/seo-reviewer.md`, `task.md` | Changed | The new rules, commands and follow-ups for tasks 15, 16, 18, 20, 22, 23, 28, 40 and 41 |

The first commit on the branch, `b353ea1 docs(13): mark task 13 done`, is task 13's bookkeeping. That's why `document/learning/13_home_page.md` also differs from `main`.

## How: step by step

1. **Plan.** `ce-plan` hung after its document review, for the fifth task running. The watcher from the [ce-plan hang lesson](../solutions/workflow-issues/ce-plan-child-session-hangs-use-idle-watcher.md) caught it, and the plan was saved.

2. **Packages, pinned exactly.** `drizzle-orm` 0.45.4, `@electric-sql/pglite` 0.5.9 and `postgres` 3.4.9 are dependencies; `drizzle-kit` 0.31.11 is a dev dependency. "Exactly" means `"0.45.4"` in `package.json`, not `"^0.45.4"`, so `npm install` can't quietly pick a newer version. Each is the newest stable release that had been out for at least 14 days. Drizzle 1.0 is still a release candidate.
   - drizzle-kit brings three copies of esbuild, and npm printed an `install-scripts` warning for each. None was approved: esbuild works through its `@esbuild/*` platform packages.
   - The lockfile diff looks huge, but only 87 entries were added, and most are esbuild's per-platform packages. npm lists every platform and installs only yours.
   - We don't install the `server-only` package. Next.js supplies it itself, and `vitest.config.mts` points tests at the same empty file.

3. **Settings and the clock** (written test-first).
   - `parseServerEnv(vars)` is pure: tests pass plain objects. `serverEnv()` reads `process.env` once and remembers the result.
   - The rules: `APP_ENV` is `local` (the default), `staging` or `production`. Staging and production need `DATABASE_URL`. On Vercel (`VERCEL` is set), `APP_ENV` can't be `local`. `DATABASE_URL` must start with `postgres://` or `postgresql://`.
   - **Errors name the variable, never its value.** A database URL holds a password, and errors end up in logs. A test passes `mysql://user:s3cret@host/db` and checks that neither `s3cret` nor the URL appears in the message.
   - `Clock` has one method, `now()`. Code that needs the time takes a clock as a parameter (`systemClock` by default), and tests pass `fixedClock(...)`.

4. **The garage's rules, in the domain.** The `Garage` type moved to `src/domain/garage.ts`. `checkGarage()` returns a list of problems, empty when all is well:
   - `phone`: any Indian number, a landline too;
   - `whatsapp`: a mobile (WhatsApp needs one);
   - `address`: English text, not blank (Hindi is optional);
   - `postalCode`: six digits, not starting with 0 (`isIndianPinCode`);
   - `hours`: the weekday and what's wrong, from `checkWeeklyHours`.

   They're codes, not sentences, so the admin forms (tasks 28 and 40) can show a translated message next to the right field.

5. **The schema and the first migration.**
   - `garage_settings` holds exactly one row: `id` defaults to 1, and `CHECK (id = 1)` makes a second row impossible. `address_text` is jsonb holding a `LocalizedText` (`{ en, hi? }`). Timestamps are `timestamp with time zone`.
   - `opening_hours` has one row per weekday (a Postgres enum). `opens` and `closes` are `time`. Its CHECK is spelled out: both empty (closed), or both set with `opens < closes`. The short version, `opens < closes`, would let a day with one time through (exercise 2 shows why).
   - `schema.ts` imports app code with `import type` only, and has no `server-only`. drizzle-kit loads it outside Next.js, where neither the `@/` alias nor `server-only` works.
   - `npm run db:generate` wrote `src/server/db/migrations/0000_garage_settings.sql` and `meta/`; both are committed. Run it again and it compares the schema with the last migration (real output, 2026-10-28, Node 24):
     ```
     2 tables
     garage_settings 7 columns 0 indexes 0 fks
     opening_hours 3 columns 0 indexes 0 fks

     No schema changes, nothing to migrate 😴
     ```

6. **Which database each way of running uses.** First, why PGlite at all? It's real Postgres, the same database Supabase runs, compiled to WebAssembly so it runs inside Node. There's no Docker, no account and no server to start. Because it's the same SQL dialect, the queries, enums, `jsonb` columns and date maths we test locally behave the same way on Supabase in task 20. A different local database, such as SQLite, would let differences slip through until deployment.

   `chooseDatabase()` in `src/server/db/index.ts` decides which one you get:

   | How the app runs | Database |
   | --- | --- |
   | `npm run dev` | PGlite in `.pglite/` (git-ignored), kept between restarts |
   | `npm run build`, `npm start`, `npm run test:e2e` | PGlite in memory, a fresh one per process |
   | Vitest | An in-memory PGlite that each test file opens |
   | `DATABASE_URL` set (any mode; staging and production from task 20) | A real Postgres through postgres.js |

   **Why builds use memory.** `next build` renders pages in several worker processes at once ("using 6 workers" in the build output). PGlite has a single connection, and two processes that open the same data folder corrupt it. Nothing locks the folder to stop them (PGlite issue #327). So each build worker gets its own database in memory. `next dev` uses the folder, but it turned out not to be one process (see "Checks and reviews"): the code review found a hidden helper process, so the folder now has a lock file, and Next.js helper processes never open it.

   `getDatabase()` opens the database on the first query, never when the file is imported. It keeps the open database on `globalThis`, so a hot reload in `next dev` reuses it instead of opening the folder a second time.

   The cost: a local `npm start` forgets changes when it restarts. Every e2e run starts from the same fresh seed, which is a plus for tests.

7. **Local databases migrate and seed themselves.** The first `getDatabase()` call in a process with PGlite does three things:
   1. It applies the committed migrations this database hasn't had yet. Drizzle records them in a `drizzle.__drizzle_migrations` table.
   2. It calls `seedGarage()`. That checks `ownerGarage` with `checkGarage` first, so a typo in `seed-data.ts` fails loudly.
   3. In one transaction, it inserts the garage row with `on conflict do nothing`, and inserts the seven hours rows only if the row was new.

   So the seed never overwrites an existing row, and the owner's later edits survive restarts. The app never migrates or seeds a real Postgres: task 20 does that on purpose. We chose this over a `predev` script because it needs no script runner (tsx) and starts no second process on the folder.

8. **The spike.** Before building anything on PGlite, a temporary probe called `getDatabase()` inside `next dev` and `next build`. From the work session's logs:
   - **`next dev`:** the first load took `ms=1775` (about 1.8 s) to open, migrate and seed a new `.pglite/`. After a hot reload it took `ms=18`: the copy on `globalThis` was reused.
   - **`next build`:** "Generating static pages" went from 471 ms to 2.1 s (1994 ms on a second try), because each worker starts its own PGlite. `○ /en` was unchanged.
   - **A surprise:** the build had traced 978 files from the owner's local `.pglite/` into the deployment file lists (`page.js.nft.json`). Turbopack follows `path.join(process.cwd(), ".pglite")`, so a deployment would have copied your local database. `outputFileTracingExcludes: { "/*": ["./.pglite/**"] }` took that from 978 to 0. (Not re-measured for this doc: there's no `.pglite/` on this machine now, and making one needs `npm run dev`.)
   - `serverExternalPackages: ["@electric-sql/pglite"]` makes Node load PGlite itself, unbundled. PGlite reads its `.wasm` and `.data` files from the folder next to its own code, and a bundled copy looks in the wrong folder.

9. **The database session runs in UTC.** Left alone, PGlite guesses a time zone from the computer's. A throwaway probe from the work session (not in the repo), re-run for this doc on the owner's laptop at 09:07 India time (trimmed):
   ```
   memory default               {"TimeZone":"Etc/GMT-5"} {"now":"2026-10-28 08:37:47.767+05", ...}
   memory startParams UTC       {"TimeZone":"UTC"} {"now":"2026-10-28 03:37:48.628+00", ...}
   folder default (new)         {"TimeZone":"Etc/GMT-5"} {"now":"2026-10-28 08:37:50.481+05", ...}
   conf timezone lines: [ "log_timezone = 'Etc/GMT-5'", "timezone = 'Etc/GMT-5'" ]
   ```
   - India is UTC+05:30, but PGlite picked `Etc/GMT-5`, which is UTC+05:00. (In `Etc/` names the sign is reversed: `Etc/GMT-5` means five hours *ahead* of UTC.)
   - The moment stored is still right. But its local time reads 08:37 instead of 09:07, so any SQL that thinks in local time ("bookings per day", "before 10:00") would be 30 minutes off.
   - A new folder also writes the guess into its `postgresql.conf`, so the folder keeps it.

   The fix is one start setting in `createDatabase`: `startParams: [...PGlite.defaultStartParams, "-c", "TimeZone=UTC"]`. Supabase runs in UTC too, so SQL date maths will match it in task 20. A test sets `TZ=Asia/Kolkata` and checks that the session says `UTC` and `+00:00`.

10. **`readGarage()`, a cached read.** In `src/server/dal/garage.ts`:
    ```ts
    export async function readGarage(): Promise<Garage> {
      "use cache";
      cacheTag(GARAGE_TAG);
      cacheLife("max");

      const db = await getDatabase();
    ```
    - `'use cache'` tells Next.js it may save the answer and reuse it. Because the answer is cached, it can be worked out at build time, and the pages that call it stay prebuilt.
    - `cacheTag("garage")` labels the saved answer, so a save can throw it away by name.
    - `cacheLife("max")`: check again after 30 days, expire after a year. The `default` profile would rebuild `/en` every 15 minutes, for details that change only when the owner saves them. The build's route list now shows this (`Revalidate 30d`, `Expire 1y`; see "Check that it works").
    - The database returns times as `10:00:00`; the read turns them into `10:00`. A missing weekday reads as closed, and `countryCode` is always `"IN"`.
    - With no garage row, it throws a clear error, so a build against an empty database fails loudly instead of showing a blank phone number.

11. **`saveGarage()`, ready but unused.** It works in three steps:
    1. `checkGarage`. On any problem it writes nothing and returns `{ ok: false, problems }`.
    2. One transaction updates the row (`updated_at` from the clock) and replaces all seven hours rows. Either everything is saved or nothing is.
    3. `updateTag("garage")`: the next page load reads the new details.

    It catches no errors. A database failure reaches the caller unchanged ([lesson: catch only what you expect](../solutions/conventions/nextjs-16-catch-only-expected-request-api-errors.md)). `updateTag` only works inside a Server Action, so the tests mock `next/cache` and check the calls. **Nothing calls `saveGarage` yet.** Task 16 adds the "is this the owner or a manager?" check first, then tasks 28 and 40 call it from Server Actions.

12. **Pages read from the database.**
    - `SiteChrome` now gets `garage` as a prop and stays a plain, synchronous component. Its callers, the `(site)` layout and `global-not-found.tsx`, `await readGarage()` and pass it in.
    - The home page, `[locale]/not-found.tsx` and `/dev/design` read the garage themselves, so they became `async`. Hooks like `useTranslations` don't work in async components, so they use `await getTranslations(...)`.
    - Their tests render `await Home()` with `readGarage` mocked. A new test gives the mock a landline, `+912012345678`, and checks the hero's Call link becomes `tel:+912012345678`. That proves the page uses the database's value, not a typed-in one.
    - `src/content/garage.ts` is gone. Unit tests and e2e tests import `ownerGarage` from `seed-data.ts`, the same object the database is seeded with.

13. **Proving no database code reaches the browser.** Every `src/server/` file starts with `import "server-only"`, so the build fails if a `"use client"` file imports it. Two files can't have that line: `schema.ts` and `seed-data.ts`. drizzle-kit and Playwright read them outside Next.js, where `server-only` doesn't exist. So nothing stops a client file from importing the schema, and **the scan is the real guard.**
    - `e2e/server-boundary.spec.ts` reads every file in `.next/static/` (all of the browser's files, not just the home page's) and looks for `garage_settings`, `opening_hours`, `pglite` and `DATABASE_URL`.
    - A **positive control** checks that each word does appear in `.next/server/` JavaScript. Without it, a renamed table would leave the scan passing while it checks nothing.
    - **The proof.** The work session planted a `schema.ts` import in `src/components/site/open-status.tsx` (a client file) and ran the spec:
      ```
        ✓  2 … the server's JavaScript (.next/server/) does contain every marker, so the scan can find them (34ms)
        ✘  1 … no file the browser downloads (.next/static/) contains database code (52ms)
      …
      +   "garage_settings": Array [
      +     "static/chunks/3nt2biolpkldo.js",
      +   ],
      +   "opening_hours": Array [
      +     "static/chunks/3nt2biolpkldo.js",
      +   ],
      ```
      Only the table names leaked: the schema holds table definitions, not the driver. That's why the scan uses several markers. The plant was then removed. (Chunk names change with each build.)

14. **Bumps along the way.**
    - **The brand-name guard.** The `globalThis` key was first called `gomechanicDatabase`. `src/i18n/brand-name.test.ts` fails if the brand name appears in any non-test file under `src/`, ignoring case and spaces, so it caught it. It's `appDatabase` now.
    - **A clock test that couldn't fail.** The expected value was one shared `Date`. A `Date` can be changed in place. So a broken clock that hands back the caller's own `Date` changes the expected value too, and the comparison still passes. The tests now build a fresh `Date` each time (`tenAmIndia()`). Checked for this doc in a throwaway copy outside the repo: with a broken `fixedClock`, a shared-`Date` version of "keeps its own copy" printed `Tests 1 passed (1)`, while the real test file failed (see exercise 3).
    - **A scripted rename slip.** A script renaming the `garage` fixture to `ownerGarage` also changed two test titles. The main session noticed and fixed them.
    - **An expired session.** An agent's sign-in expired in the middle of U4. It was resumed, and no work was lost.
    - **A check that timed out.** The full `npm run check` failed: both PGlite test files hit Vitest's 10-second limit for setup hooks (`Hook timed out in 10000ms`). The owner's machine was very busy (load average about 14, Docker Desktop at about 99% CPU), and those two files take about 16 s even alone. **This time the commit gate worked** (task 13's lesson): the commit didn't happen. The two database test files now set 60-second limits with a comment saying why (`6982f04`), and two full runs passed before the commit. (An earlier run also had one unrelated jsdom test, `section.test.tsx`, time out at 5 s; the next run passed.)
    - **`npm audit`.** In the work session it reported 4 moderate findings, all one esbuild advisory: a website could talk to esbuild's development server. They come through drizzle-kit, which doesn't run that server. **Don't run `npm audit fix --force`:** it would "fix" this by downgrading drizzle-kit to 0.18.1. When this doc was written, `npm audit` also listed 3 low findings from a new deepmerge advisory, through the shadcn CLI. That isn't from this task (shadcn and deepmerge didn't change), and `--force` would install shadcn 1.0.0 there.

## Decisions worth knowing

| Choice | Why | What it costs |
| --- | --- | --- |
| PGlite locally | Real Postgres, same SQL as Supabase, no Docker or account | One process per folder; a slower first start (about 1.8 s) |
| Builds and `npm start` use memory | Several build workers can't share one folder safely | A local production server forgets changes on restart |
| Self-migrate and self-seed (local only) | `npm run dev` just works on a fresh clone | Task 20 must migrate and seed Supabase on purpose |
| Typed seed (`seed-data.ts`), not SQL | Checked by TypeScript and `checkGarage`; tests use the same object | None worth noting |
| `cacheLife("max")` | Pages stay prebuilt; no rebuild every 15 minutes | Rows changed directly in Supabase show only after a redeploy or a revalidation, which a save through the app does (task 20 note) |
| `SiteChrome` gets a prop | Its tests stay plain renders | The callers must read the garage |
| Session in UTC | Matches Supabase; fixes the +05:00 guess | Reports convert to India time in SQL (task 41) |
| No `server-only` in `schema.ts`, `seed-data.ts` | drizzle-kit and Playwright read them | The e2e scan is the only guard for those two |
| Hand-written env check, no zod | Only three variables | A bit more code |
| No phone-format CHECK in SQL | The save checks numbers; a rule change would need a migration | Someone editing rows in a console could store a bad number |

## New ideas in this task

- **Database, table, row, column:** a database stores data in tables, like spreadsheets. A row is one record, a column is one field.
- **Postgres:** a popular free database. Supabase, our planned host, runs it.
- **PGlite:** Postgres compiled to WebAssembly, so it runs inside Node with nothing else installed. It can keep its data in a folder or only in memory.
- **WebAssembly (WASM):** a compact program format that browsers and Node can run. It lets software written for other systems, like Postgres, run inside JavaScript programs.
- **ORM (Drizzle):** a library that lets you describe tables and write queries in TypeScript, with types checked, instead of writing SQL strings.
- **Driver:** the code that actually talks to a database. Here: PGlite locally, postgres.js for a real server.
- **Schema:** the description of the tables and their columns.
- **Migration:** a SQL file that changes the schema one step at a time. Like numbered renovation instructions for a house: every copy of the house gets them in order, and you never rewrite an old one.
- **Seed:** the starting data a new database gets.
- **Transaction:** a group of writes that all happen or none do. Like a bank transfer: the money never leaves one account without arriving in the other.
- **Constraint (CHECK, primary key):** a rule the database itself enforces on every write, whatever code sends it.
- **Enum:** a column that may only hold values from a fixed list (the seven weekdays).
- **jsonb:** a Postgres column that stores JSON. Here it holds the address in each language.
- **`timestamp with time zone` and UTC:** a column that stores an exact moment. UTC is the world's reference clock, India is UTC+05:30.
- **E.164:** the standard phone format, `+` then country code then number: `+919764750567`.
- **Data-access layer (DAL):** the one folder whose functions talk to the database. Everything else calls those functions.
- **`'use cache'`, `cacheTag`, `cacheLife`, `updateTag`:** Next.js lets a function's answer be saved and reused (`'use cache'`), labelled (`cacheTag`), kept for a set time (`cacheLife`), and thrown away by label after a save (`updateTag`).
- **Environment variable:** a setting given to a program from outside its code, such as `DATABASE_URL`. Secrets go there, never in git.
- **Injectable clock:** instead of reading the time itself, code is handed a clock. Tests hand it a stopped one, so the result doesn't depend on when they run.
- **`globalThis`:** the one object shared by all code in a process. It survives a hot reload, which re-runs changed files.
- **File tracing (`.nft.json`):** the build lists every file the server might read, so a deployment copies only those.
- **`server-only`:** an import that makes the build fail if a browser component imports the file.
- **Positive control:** a check that the test *can* find what it looks for, so a passing test means something.
- **`satisfies`:** a TypeScript keyword that checks an object against a type but keeps its exact values.

## Check that it works

Real output on 2026-10-28, with Node 24 (`fnm exec --using=24 -- ...`; trimmed). `npm run check` is from the final code, after the review fixes; the route list is from before them (no route changed).

```bash
npm run check
```
```
 Test Files  50 passed (50)
      Tests  856 passed (856)
```

Only the server tests (env, seed data, database, data-access layer):
```bash
npx vitest run src/server
```
```
 Test Files  4 passed (4)
      Tests  62 passed (62)
```

`npm run build` still lists `○ /en`, now with the cache lifetime from `cacheLife("max")`:
```
Route (app)                 Revalidate  Expire
┌ ○ /_not-found                    30d      1y
├   /[locale]                      30d      1y
│ ├ ◐ /[locale]                    30d      1y
│ └ ○ /en                          30d      1y
├   /[locale]/dev/design
│ ├ ◐ /[locale]/dev/design
│ └ ○ /en/dev/design               30d      1y
└ ○ /icon.svg
```

The browser suites, from the work session's final runs after the review fixes:
- `npm run test:e2e` (production build, including the boundary scan): `60 passed (50.2s)`.
- `npm run test:design` (under `next dev`, reading `.pglite/`): `39 passed (1.5m)`.

To look for yourself: run `npm run dev` and open http://localhost:3000. The header, footer and phone bar show the owner's details, and a `.pglite/` folder appears in the repo. To start over, stop the dev server, then run `npm run db:reset`. (Not done for this doc: a dev server would have opened the folder while another review was running.)

## Checks and reviews

- **SEO check:** the `seo-reviewer` agent compared `/`, the 404s (`/no-such-page`, `/index.html`, `/hi`) and `/dev/design` on the production build with task 13's copies. **All pass, and the HTML is identical** once scripts are removed. The name, address, PIN, phone, WhatsApp and hours all come from the seed. No database name or `DATABASE_URL` appears in anything a browser gets. One change it explained: `/` now sends `s-maxage=2592000, stale-while-revalidate=…` (30 days, from `cacheLife("max")`) instead of a year. Search engines ignore `s-maxage`, and the `garage` tag means an owner's save refreshes every page at once (tasks 28 and 40).
- **`ce-code-review`: "Ready with fixes".** Two P1s and two P2s, all fixed:
  - **A second process on `.pglite/` (P1).** Next.js 16.4.3's dev server has a *use-cache probe*: when a `'use cache'` read takes over 10 seconds (a cold first start on a busy machine), it runs the same function again in a helper process (a jest-worker child) to see whether it's stuck. That helper has its own memory, so `globalThis` was empty and it opened the folder too. The work session reproduced it, with two processes holding `.pglite/` at once. Two guards now:
    - a lock file (`.pglite.lock`, with the process id and a random token; a lock left by a process that has died is taken over);
    - a rule that Next.js helper processes never open the folder: their read never finishes, which the probe treats as "inconclusive".
    
    Why not just let the helper fail on the lock? The work session tested that, and the real page request then failed with a 500 "deadlock" error. The review had assumed an error would count as inconclusive; Next.js counts it as "finished".
  - **The database password in logs (P1).** A `DATABASE_URL` whose password has an unencoded `/`, `?` or `#` makes postgres.js throw a `TypeError` that carries the whole URL, and Next.js logs that error. The URL parse is now wrapped and replaced by a fixed message with no `cause`. A test checks the password never appears, even in `util.inspect` output.
  - **`next build --debug-prerender` (P2).** That flag builds with `NODE_ENV=development`, so every build worker would have opened the folder. Builds now always use memory (`NEXT_PHASE`).
  - **Rollback tests that couldn't fail (P2).** Both stopped before any write. They now make a write fail after the old hours are deleted (or after the garage insert). Removing the transaction made them fail: all seven hours rows were lost.
- **`code-reviewer` agent: "Needs changes", then fixed.** It re-ran `npm run check` (856 passed), compared the lockfile as data (87 packages added, none removed, all from the npm registry with hashes), and found no secrets and no `NEXT_PUBLIC_` values. Two must-fixes, both fixed:
  - **A stale test count.** This doc said `npx vitest run src/server` prints 49 tests. The review fixes added 13, so it prints 62 now. Re-run and corrected: the same slip as in `run-commands-before-documenting-output.md`.
  - **A comment that said the opposite of what happens.** The header of `src/server/db/folder-lock.ts` still said a probe that fails on the lock "counts as inconclusive". That was the review's first guess, which the work session disproved (it's the 500 above). Someone reading only that file might delete the helper-process guard. Rewritten, along with a test comment in `database.test.ts`.
  
  Also fixed: `folder-lock.ts` and `.pglite.lock` were missing from the "What" table, and `CLAUDE.md` now lists all 7 `npm audit` findings, not just the 4 moderate ones. One nice-to-have went to the backlog: two processes starting within milliseconds after a crash can both take over the same stale lock (rare; the fix is to rename the old lock aside instead of deleting it). The reviewer also noted that `e76ee8d` holds three separate fixes; next time each fix gets its own commit.
- **Compound: one lesson.** [`nextjs-16-dev-server-is-not-one-process-use-cache-probe.md`](../solutions/conventions/nextjs-16-dev-server-is-not-one-process-use-cache-probe.md). Without it, a future session would trust the "probe failures are inconclusive" comment in Next.js's source and repeat the 500, or open a new single-process resource (a fake provider writing to a file, task 15) in the helper.
- **Pull request:** [#13](https://github.com/AkshayChavhan/go-mechanic/pull/13), opened on 2026-10-28 after the owner's OK. The branch's first commit (`docs(14): start task 14`) was already on GitHub: the owner pushed it from VS Code on 2026-10-27, two seconds after it was made, so `git push` here was a plain fast-forward.

## Common mistakes

- **Two processes on `.pglite/`.** `npm run db:reset` or a drizzle-kit command that opens the database while `npm run dev` runs can corrupt it. Stop the dev server first.
- **Editing a merged migration.** Other copies of the database already ran it, and won't run it again. Write a new migration.
- **Forgetting the migration.** After changing `schema.ts`, run `npm run db:generate -- --name=<what_changed>` and commit the `.sql` file and `meta/` with it. Then restart `npm run dev` to apply it.
- **Querying outside `src/server/dal/`.** Pages and components call the DAL's functions; they never import `@/server/db`.
- **Adding `import "server-only"` to `schema.ts` or `seed-data.ts`.** drizzle-kit and Playwright break. Rely on the e2e scan instead.
- **Forgetting `cacheLife("max")`** on a public read. The default profile rebuilds the page every 15 minutes.
- **Calling `updateTag` outside a Server Action.** It throws. Calling `saveGarage` from anywhere before task 16's role check is a security hole.
- **`new Date()` inside logic.** Take a `Clock`. And never read the time while a prebuilt page renders.
- **Printing `DATABASE_URL`**, or giving it a `NEXT_PUBLIC_` prefix. Both leak the password.
- **A catch-all around a save.** It hides real database errors. Let them through.
- **Sharing one `Date` between a test and the code it tests.** The test can't fail. Make a new one each time.
- **`npm audit fix --force`.** It downgrades drizzle-kit to 0.18.1.
- **Expecting a local `npm start` to keep changes.** It runs in memory.

## Try it yourself

About 10 minutes. Predict each answer first, and finish with `git status` showing a clean tree.

1. Which database does each of these use: `npm run dev`; `npm run build`; `npx vitest`; `npm run dev` with `DATABASE_URL=postgresql://...` in `.env.local`? Check your answers against `chooseDatabase()` in `src/server/db/index.ts` and its tests in `database.test.ts`.
2. `opening_hours`' CHECK is long. Suppose it were only `opens < closes`. Would Postgres accept a row with `opens` 10:00 and `closes` empty? Why?
3. In `src/lib/clock.ts`, replace the body of `fixedClock` with `return { now: () => instant };`. Which of the four tests in `src/lib/clock.test.ts` fail? Run `npx vitest run src/lib/clock.test.ts`, then undo the change.

Answers.

(1) Folder `.pglite/`; memory (one per build worker); memory (one per test file); the real Postgres, through postgres.js, in every mode.

(2) Yes. `'10:00' < NULL` is neither true nor false but NULL ("unknown"), and a CHECK only rejects *false*. Real output from a throwaway script on in-memory PGlite:
```
opens '10:00', closes '19:00': accepted
opens '19:00', closes '10:00': rejected (new row for relation "short_check" violates check constraint "short_check_check")
opens '10:00', closes null: accepted
```

(3) Real output from a throwaway copy outside the repo, so nothing in the repo was edited:
```
     × returns a new Date each time, so changing one result doesn't move the clock 8ms
     × keeps its own copy: changing the Date passed in doesn't move the clock 2ms
AssertionError: expected 2000-10-27T04:30:00.000Z to deeply equal 2026-10-27T04:30:00.000Z
      Tests  2 failed | 2 passed (4)
```
The two that pass only read the clock and never change a `Date`, so they can't tell the difference.

## Learn more

- Drizzle: [overview](https://orm.drizzle.team/docs/overview), [using it with PGlite](https://orm.drizzle.team/docs/connect-pglite), [migrations](https://orm.drizzle.team/docs/migrations), [`drizzle-kit generate`](https://orm.drizzle.team/docs/drizzle-kit-generate).
- [PGlite docs](https://pglite.dev/docs/): what it is, and its single-connection limits.
- Next.js (read the bundled copy first, in `node_modules/next/dist/docs/01-app/`): [`use cache`](https://nextjs.org/docs/app/api-reference/directives/use-cache), [`cacheLife`](https://nextjs.org/docs/app/api-reference/functions/cacheLife) (the profile table), [`updateTag`](https://nextjs.org/docs/app/api-reference/functions/updateTag), [data security](https://nextjs.org/docs/app/guides/data-security) (the data-access layer idea), [`serverExternalPackages`](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverExternalPackages), [`output` and file tracing](https://nextjs.org/docs/app/api-reference/config/next-config-js/output).
- PostgreSQL: [constraints](https://www.postgresql.org/docs/current/ddl-constraints.html) (why a NULL passes a CHECK), [dates, times and time zones](https://www.postgresql.org/docs/current/datatype-datetime.html), [transactions](https://www.postgresql.org/docs/current/tutorial-transactions.html).
- [postgres.js](https://github.com/porsager/postgres): the driver task 20 will connect to Supabase.
- npm: [`npm audit`](https://docs.npmjs.com/cli/commands/npm-audit).
