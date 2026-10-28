---
title: Database Setup - Plan
type: feat
date: 2026-10-27
origin: document/plans/2026-10-24-gomechanic-master-plan.md
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-plan-bootstrap
execution: code
---

# Database Setup - Plan

## Goal Capsule

- **Objective:** Visitors keep seeing the owner's exact phone, WhatsApp, address and hours on pages that are still prebuilt. Those details now come from a database that later tasks build on: logins, bookings, and the owner editing details without a code change. A fresh clone still runs with `npm ci && npm run dev`, with no account, Docker or extra step.
- **Means:** Drizzle ORM over PGlite locally and postgres.js for a real Postgres from task 20 (KTD2–KTD4). `readGarage()` becomes a cached database read (KTD7).
- **Authority:**
  1. The master plan (see origin): Architecture, Data rules, Cache Components rules.
  2. The task 14 steps in `document/task/task.md`.
  3. `CLAUDE.md`, which governs workflow, languages, design-system, site-shell and secrets rules.
  4. This plan.

  These lessons in `document/solutions/` apply:
  - read the bundled Next.js docs before using an API;
  - after `unstable_rethrow`, catch only the error you expect;
  - prove a guard by watching it fail without the fix;
  - document only output you actually ran.
- **Execution profile:**
  - U2 and U3 are written test-first.
  - Database tests run on in-memory PGlite in Vitest's node project.
  - U4 starts with a spike that proves PGlite runs inside `next dev` and `next build` before anything is built on it.
  - The full `npm run check`, `npm run test:e2e` and `npm run test:design` runs come at the end.
- **Stop conditions:** stop and ask the owner when:
  - PGlite can't run inside `next dev` or `next build`, even with `serverExternalPackages`;
  - keeping `/` at `○ /en` would mean dropping a requirement;
  - `npm install` fails with ERESOLVE, or something only works once an install script is approved;
  - a step needs a global install, Docker, a cloud account, or `npx playwright install`;
  - a step would let anything outside the server call `saveGarage`: a Server Action, a Route Handler, a form (R7).
- **Who finishes:** the main session on branch `14_database_setup`. Commit there and stop. The push and the pull request happen only at `CLAUDE.md` Task workflow step 11, after the owner says so.

---

## Product Contract

### Summary

Add the database layer every later task builds on: a Drizzle schema with committed migrations, and one database module. Locally it uses PGlite, Postgres compiled to WebAssembly that runs inside Node. Deployed environments use a Postgres URL. Around it come a checked server environment, an injectable clock and a data-access layer. Only the garage's details and weekly hours move in, seeded with the owner's real details. `readGarage()` becomes a cached read that keeps every public page prebuilt. A tested save function, with validation and cache refresh, waits for the admin screens of tasks 28 and 40.

### Problem Frame

Task 12 put the owner's details in a typed file, `src/content/garage.ts`, and sent every read through `readGarage()` so that this task would only swap one function. The master plan has the owner edit hours (task 28) and garage info (task 40) without code. Tasks 15 to 27 need tables for users, vehicles, slots and bookings. None of that can start without a database, migrations and one agreed place for queries.

Visitors must notice nothing. The details stay the same, `/` stays prebuilt (`○ /en`, `ensureStatic = "navigation"`), and no database code reaches phones. The owner is learning, so the setup has to be explainable: where the data lives, how a schema change ships, and why one folder must never be opened twice.

### Requirements

**Data and storage**

- R1. The garage's phone, WhatsApp, address text (`LocalizedText`), PIN code and weekly hours are stored in Postgres: `garage_settings` (one row) and `opening_hours` (one row per weekday), with UTC timestamps. They come back in today's `Garage` shape.
- R2. Every new database starts with the owner's details given on 2026-10-26 (task 12 in `task.md`): +91 97647 50567 for calls and WhatsApp; "Mukai Chowk, Kiwale, Pune, Maharashtra", PIN 412101; 10:00 to 19:00 India time every day except Monday (closed). `src/content/garage.ts` is removed.
- R3. Schema changes ship as drizzle-kit migrations with their SQL committed. A merged migration is never edited.
- R4. On a fresh clone, `npm ci && npm run dev` works with no account, no Docker and no extra command. Local data survives restarts, in a git-ignored folder.

**Reading and saving**

- R5. `readGarage()` reads the database through `'use cache'` with the `garage` tag. `/` stays `○ /en`, and both 404 pages and `/dev/design` keep working.
- R6. A save function checks the whole garage before writing: any Indian number for calls, an Indian mobile for WhatsApp, a 6-digit PIN, an English address, and hours that pass `checkWeeklyHours`. Bad input returns problem codes instead of throwing. The write is atomic, and it refreshes the `garage` tag with `updateTag`.
- R7. Nothing in this task lets a visitor reach the save function: no Server Action, no Route Handler. Task 16 adds its role check before tasks 28 and 40 expose it.

**Environment and safety**

- R8. Server configuration is read and checked in one server-only module. A staging or production deployment refuses to run without a Postgres URL, and no error message prints the URL.
- R9. No database, driver or server-only module reaches the browser's JavaScript. A production build proves it.
- R10. Code that needs the current time gets it from an injectable clock; tests use a fixed one.

**Continuity**

- R11. The existing unit, e2e and design suites keep passing with the same expectations: the header, footer, phone bar and home page show the owner's details, now read from the database.
- R12. The docs explain the database for a junior engineer: `CLAUDE.md` (repo map, commands, conventions), `readme.md`, `MASTER.md`, the seo-reviewer's garage reference, `task.md` follow-ups and the learning doc.

### Success Criteria

- After `npm run db:reset` and `npm run dev`, the home page, the 404 page and `/dev/design` show the owner's details on the first load.
- `npm run build` lists `○ /en`. The e2e scan finds no database marker in any browser file, and finds every marker in the server output.

### Scope Boundaries

- Only the garage and its hours move. Services stay in `src/content/services.ts` until task 18, the offer in `offer.ts` until task 38, stats and reviews in `home.ts` until task 37.
- No users or auth tables (task 15), no roles (16), no admin screens or Server Actions (28, 40), no Supabase or Vercel (20).
- Considered and not built:
  - **A PGlite socket server** (`@electric-sql/pglite-socket`, one process owns the folder and others connect over TCP). Its peer dependencies are exact pins and would install 7 extension packages, and KTD2 already removes the need. Revisit if two local processes ever have to share live data.
  - **Phone-format CHECK constraints in SQL.** The save path checks numbers. Copying the regex into SQL would need a migration for every rule change. Revisit if people start editing rows outside the app (task 20's Supabase console).
  - **A stored `countryCode` column.** It's always "IN" for one garage in India, so the read adds it.
  - **A schema-drift check** (schema.ts against the migrations). The integration tests query every column the app uses on a freshly migrated database, so a missing migration fails them.
  - **A test that every `src/server/` file imports `server-only`.** U7's scan of the browser files catches a leak whatever caused it.
  - **`db:migrate`, `db:seed` or `db:setup` scripts now.** Local databases migrate and seed themselves (KTD4), and a second process on the PGlite folder would corrupt it (KTD3). Task 20 adds the Supabase commands.
  - **A browser test that a save refreshes the page.** It needs a Server Action, which arrives with tasks 28 and 40.

#### Deferred to Follow-Up Work

- **Task 15:** Better Auth's tables go into the same schema and migrations (`npm run db:generate`). Its Drizzle adapter gets the database from `getDatabase()`.
- **Task 16:** `saveGarage` first checks that the signed-in user is the owner or a manager.
- **Task 18:** services move to the database the same way: a typed seed made from `src/content/services.ts`, and a cached read with its own tag.
- **Task 20 (Supabase and Vercel):**
  - Set `APP_ENV` and `DATABASE_URL`: the transaction pooler (port 6543) with `prepare: false`.
  - Run `drizzle-kit migrate` over the direct connection before `next build`, because prerendering reads the database during the build.
  - Seed the garage row, with `db:migrate` and `db:seed` scripts that load env through `loadEnvConfig(process.cwd(), true)` from `@next/env`.
  - Size the connection pool for the build's worker processes, and check whether postgres.js needs `serverExternalPackages`.
  - Rows changed in the Supabase console reach the site only after a redeploy or a revalidation (`cacheLife("max")`, KTD7).
- **Task 22:** the slot engine reads hours through the data-access layer and the time through the clock.
- **Tasks 28 and 40:** Server Actions call `saveGarage` after task 16's check, and turn problem codes into messages. An e2e test proves the page changes after a save.
- **Task 23 and later e2e tests:** a local production server keeps its data in memory (KTD2), so whatever a test run creates is gone after a restart.
- **Task 41:** reports that group by day convert to India time in SQL (`AT TIME ZONE 'Asia/Kolkata'`), because the database session runs in UTC (KTD13).

---

## Planning Contract

### Key Technical Decisions

- KTD1. **Exact pins:**
  - `drizzle-orm` 0.45.4, `@electric-sql/pglite` 0.5.9 and `postgres` 3.4.9 as dependencies;
  - `drizzle-kit` 0.31.11 as a devDependency.

  Each is the newest stable version published at least 14 days ago. Drizzle 1.0 is still a release candidate with breaking changes. drizzle-kit brings esbuild and tsx, which have postinstall scripts: leave them unapproved, because esbuild's JavaScript API still works from its `@esbuild/*` optional dependency. Don't install the `server-only` package either. Next.js aliases it itself (`node_modules/next/dist/build/create-compiler-aliases.js`), and Vitest gets the same alias to `next/dist/compiled/server-only/empty.js`.
- KTD2. **Which database each way of running uses:**

  | How the app runs | Database |
  | --- | --- |
  | `npm run dev` | PGlite in `.pglite/` (git-ignored), kept between restarts |
  | `npm run build`, `npm start`, `npm run test:e2e` (`APP_ENV` local) | PGlite in memory, one per process, set up on first use |
  | Vitest | An in-memory PGlite each test file creates for itself |
  | `APP_ENV` staging or production (task 20) | `DATABASE_URL` through postgres.js; required |
  | `DATABASE_URL` set, in any mode | postgres.js |

  In-memory production builds are what make the build safe (KTD3). They also give every e2e run the same fresh seed.
- KTD3. **Never two processes on one PGlite folder.** PGlite has one connection. Two processes opening the same data folder corrupt it, and nothing locks it (PGlite issue #327).
  - *Corrected in review (2026-10-28): `next dev` is not always one process. Next.js 16.4.3's dev use-cache probe can re-run a slow `'use cache'` read in a jest-worker child, which opened `.pglite/` a second time. The folder now has a lock file, and Next.js helper processes never open it (see `src/server/db/index.ts` and the learning doc).*
  - `next build` loads routes in "CPU count − 1" worker processes. Builds therefore use memory (KTD2).
  - `next dev` is one process, and Next.js locks the dev folder against a second one.
  - The client opens on the first query, never when a module loads, and is kept on `globalThis`, so a hot reload reuses it.
  - `npm run db:reset`, and any drizzle-kit command that opens the folder, run only while dev is stopped.
- KTD4. **PGlite migrates and seeds itself on first use.** The first `getDatabase()` call in a process applies the committed migrations (Drizzle's migrator skips the ones already applied). It then inserts the owner's garage if the row is missing, and never overwrites one that exists. The app never migrates or seeds a real Postgres; task 20 runs those steps on purpose. Chosen over `predev`/`prebuild` scripts: it needs no script runner (tsx) and starts no second process on the folder.
- KTD5. **The seed is typed TypeScript.** `ownerGarage` (the owner's details, `satisfies Garage`) lives in a pure data file, `src/server/db/seed-data.ts`. Tests and e2e import the same object as their expected values. The seed function checks it with `checkGarage` before inserting. Chosen over an SQL data migration because it's typed and checked, and it's the pattern tasks 17 and 18 reuse for their catalogues.
- KTD6. **The schema** (snake_case names):
  - `garage_settings`: a single row, enforced by an integer `id` with default 1 and `CHECK (id = 1)`. Columns: `phone`, `whatsapp`, `address_text` (jsonb typed as `LocalizedText`), `postal_code`, and `created_at`/`updated_at` (`timestamp with time zone`).
  - A `weekday` Postgres enum.
  - `opening_hours`: primary key `weekday`, nullable `opens` and `closes` (`time`), and a CHECK that both are null (closed) or both are set with `opens < closes`.

  `schema.ts` imports app code only with `import type`. drizzle-kit loads it outside Next.js and may not resolve `@/` at runtime. A test checks that its weekday list equals `WEEKDAYS`. Migrations live in `src/server/db/migrations/`.
- KTD7. **`readGarage()` lives in `src/server/dal/garage.ts`.** It uses `'use cache'`, `cacheTag("garage")` and `cacheLife("max")`. `max` revalidates after 30 days and expires after a year; the docs suggest it for data that changes only when an admin saves. The `default` profile would rebuild `/en` every 15 minutes. A missing row throws a clear error, so the build fails loudly.
- KTD8. **`SiteChrome` takes the garage as a prop and stays synchronous.** The `(site)` layout and `global-not-found.tsx` read the garage and pass it in. The pages that read it become async and use `getTranslations`: the home page, `[locale]/not-found.tsx` and `/dev/design`. Their tests render `await Page()` with `readGarage` and `next-intl/server` mocked, as `not-found.test.tsx` already does for `generateMetadata`. Chosen over an async `SiteChrome` because the component tests stay plain renders, and "components get their values as props" still holds.
- KTD9. **`saveGarage(garage, clock = systemClock)`:**
  1. Check with `checkGarage`; on problems, return `{ ok: false, problems }`.
  2. In one transaction, update the row (`updated_at` from the clock) and replace all seven hours rows.
  3. Call `updateTag("garage")`.

  It catches no errors (lesson: catch only expected errors). `updateTag` works only inside Server Actions, so tests mock `next/cache`. Nothing calls it in this task (R7).
- KTD10. **`src/server/env.ts` (server-only)** has a pure `parseServerEnv(vars)` and a reader that remembers its result.
  - Variables: `APP_ENV` (`local` by default, `staging` or `production`) and `DATABASE_URL` (`postgres://` or `postgresql://`).
  - Rules: staging and production need `DATABASE_URL`. On Vercel (`VERCEL` set), `APP_ENV` must not be `local`.
  - Messages name the variable, never its value.
  - Tests pass plain objects. It's written by hand, with no zod, because there are only three variables.

  It sits in `src/server/` rather than the master plan's `lib/env.ts` because it's server-only.
- KTD11. **`src/lib/clock.ts`:** a `Clock` type with `now()`, plus `systemClock` and `fixedClock(instant)`. Never call `now()` while a prerendered page renders. Cache Components rejects it, and the shell already works out "open now" in the browser.
- KTD12. **Keeping the database out of the browser:**
  - Every `src/server/` module starts with `import "server-only"`, except `schema.ts` and `seed-data.ts`, which drizzle-kit and Playwright read outside Next.js.
  - `serverExternalPackages: ["@electric-sql/pglite"]`, because PGlite reads its `.wasm` and `.data` files from next to its own code, and bundling breaks that path (PGlite issues #204 and #322).
  - Proof: an e2e scan of every file in `.next/static/` for database markers, with a positive control that finds the same markers in `.next/server/`.
- KTD13. **The database session runs in UTC.** Otherwise PGlite 0.5.9 takes the computer's time zone when it creates a folder (+05:30 on the owner's machine), and SQL date maths would differ from Supabase.

Why this wasn't a bake-off: three ways to run PGlite during the build survived research (one build worker, a socket server, a database in memory per process). Memory per process wins on the evidence alone. It's safe whatever the worker count, needs no new package, and gives deterministic e2e data.

### High-Level Technical Design

How a page gets the garage, and how a save reaches it:

```mermaid
flowchart TB
  L["(site) layout"] --> R
  H["home page"] --> R
  N["[locale]/not-found"] --> R
  G["global-not-found"] --> R
  D["/dev/design"] --> R
  R["readGarage()<br/>use cache, tag garage, life max"] --> DB["getDatabase()<br/>once per process, on globalThis"]
  S["saveGarage() (tasks 28 and 40, after task 16)"] --> C["checkGarage()"]
  C -->|ok| T["transaction: row + 7 hours"] --> DB
  T --> U["updateTag(garage)"]
  U -.->|next request re-reads| R
  L --> SC["SiteChrome (garage prop)"]
  G --> SC
```

How `getDatabase()` picks and prepares a database (KTD2, KTD4):

```mermaid
flowchart TB
  A["serverEnv() checks APP_ENV and DATABASE_URL"] --> B{"DATABASE_URL set?"}
  B -->|yes| P["postgres.js<br/>no migrate, no seed"]
  B -->|no| E{"NODE_ENV"}
  E -->|development| F["PGlite in .pglite/"]
  E -->|production or test| M["PGlite in memory"]
  F --> Z["timezone UTC, then migrate, then seed if the row is missing"]
  M --> Z
```

`serverEnv()` refuses staging or production without `DATABASE_URL` before any of this runs (KTD10).

### Assumptions

These bets were not confirmed with the owner (scoping confirmation was off). Each is cheap to change.

- A1. A local production build and `npm start` show the seed data and lose runtime changes on restart. Nobody keeps real data in a local production build.
- A2. `APP_ENV` is the switch for deployed environments, and task 20 sets it on Vercel.
- A3. Pages that read data may become async. `CLAUDE.md`'s "pages stay non-async" becomes "unless they read data".
- A4. `readGarage()` moves out of `site-chrome.tsx` into the data-access layer, and task 14's step in `task.md` that names `site-chrome.tsx` is reworded.
- A5. Hours are a seven-row table (the master plan's `opening_hours`), not a jsonb column.
- A6. postgres.js is installed now with only a construction test. Its first real connection is in task 20.
- A7. A missing weekday row reads as closed. A wrong "Closed" beats a crash (as in `openMinutes` in `src/domain/opening-hours.ts`), and seeding and saving always write all seven.
- A8. The only new `db:` commands are `db:generate` and `db:reset`.

### Deferred to Implementation

- The exact shared `Database` type both drivers satisfy (Drizzle's Postgres base type).
- How PGlite gets UTC: a startup setting or `SET TIME ZONE` right after opening.
- Whether drizzle-kit loads `schema.ts` with its `import type ... from "@/..."` lines (types are erased, so it should). U4 runs `db:generate` and finds out.
- Drizzle's `casing` option, or explicit snake_case column names.

### Risks

| Risk | Mitigation |
| --- | --- |
| PGlite under Turbopack (`next dev`, `next build`) is unconfirmed (PGlite issue #632) | U4's spike runs before anything builds on it; stop condition |
| npm ERESOLVE on esbuild peers (Vite 8 lists an optional esbuild peer) | Check `npm ls esbuild` after installing; stop condition |
| `npm audit` flags esbuild 0.18.20 (a dev-server advisory; drizzle-kit doesn't use that server) | Note it in the learning doc; no action |
| Each build worker starts its own PGlite (a cold start plus migrations) | Measure the build time in U4. Acceptable unless it's large |
| PGlite adds about 25 MB to `node_modules` | Server only; U7 proves none of it ships to browsers |

### Sources and Research

- Next.js 16.4.3 bundled docs (`node_modules/next/dist/docs/01-app/`):
  - `03-api-reference/01-directives/use-cache.md` (serializable returns, in-memory store per process, 50 s prerender fill limit);
  - `04-functions/cacheLife.md` (profiles; `max` for admin-edited data);
  - `04-functions/cacheTag.md` and `updateTag.md` (Server Actions only; `cacheTag` throws outside Next.js);
  - `03-file-conventions/02-route-segment-config/ensureStatic.md` (cached reads are allowed);
  - `05-config/01-next-config-js/staticGeneration.md` and `serverExternalPackages.md` (only `pg` is built in);
  - `02-guides/environment-variables.md` and `02-guides/data-security.md` (data-access layer: server only, minimal return values, the only code that reads `process.env`).
- `node_modules/next/dist/build/create-compiler-aliases.js` (line 232): Next.js's own `server-only` alias.
- PGlite: README ("single user/connection"), issue #327 (folder corruption with two openers), #204 and #322 (`serverExternalPackages`), #632 (Turbopack).
- Drizzle 0.45 type definitions: `drizzle-orm/pglite` and `drizzle-orm/pglite/migrator` (`migrate(db, { migrationsFolder })`; 0.45 needs the config object). CHECK constraints are generated since drizzle-kit 0.26.
- Supabase: the transaction pooler (port 6543) doesn't support prepared statements; run migrations over the direct connection.

---

## Implementation Units

```mermaid
flowchart TB
  U1 --> U2
  U1 --> U3
  U2 --> U4
  U3 --> U4
  U4 --> U5 --> U6 --> U7 --> U8
```

### U1. Packages and tooling config

- **Goal:** install the pinned packages and wire up Next.js, Vitest, drizzle-kit, git and the env example.
- **Requirements:** R3, R4, R9 (KTD1, KTD12)
- **Dependencies:** none
- **Files:** `package.json`, `package-lock.json`, `next.config.ts`, `vitest.config.mts`, `drizzle.config.ts` (new), `.gitignore`, `.env.example` (new)
- **Approach:**
  1. Install the KTD1 versions with exact pins. Read the `install-scripts` warning, approve nothing, and check `npm ls esbuild`.
  2. Add the scripts `db:generate` (`drizzle-kit generate`) and `db:reset` (deletes `.pglite/` through Node's `fs`, so it also works on Windows).
  3. `next.config.ts`: `serverExternalPackages: ["@electric-sql/pglite"]`.
  4. `vitest.config.mts`: a top-level `resolve.alias` from `server-only` to `next/dist/compiled/server-only/empty.js`, so both projects get it.
  5. `drizzle.config.ts`: dialect `postgresql`, the schema file, and `src/server/db/migrations` as the output folder. No credentials: `generate` doesn't need a database.
  6. `.gitignore`: `.pglite/`. `.env.example`: `APP_ENV` and a fake `DATABASE_URL`, both commented out, with a note that local development needs neither.
- **Test expectation:** none. This unit is config; U2 to U8 and `npm run check` prove it.
- **Verification:** `npm run check` passes unchanged, no install script is approved, and every new version in `package.json` has no `^`.

### U2. Environment and clock helpers

- **Goal:** one checked, typed source of server configuration, and an injectable clock.
- **Requirements:** R8, R10 (KTD10, KTD11)
- **Dependencies:** U1
- **Files:** `src/server/env.ts`, `src/server/env.test.ts`, `src/lib/clock.ts`, `src/lib/clock.test.ts`
- **Approach:** `parseServerEnv(vars)` returns `{ appEnv, databaseUrl }` or throws one error that lists every problem. `serverEnv()` reads `process.env` once and remembers the result. Choosing the database stays in U4.
- **Execution note:** write the tests first.
- **Patterns to follow:** codes, not sentences, as in `HoursProblem` (`src/domain/opening-hours.ts`).
- **Test scenarios:**
  - No variables: `appEnv` is `local` and there's no URL.
  - `APP_ENV=staging` without `DATABASE_URL` throws and names `DATABASE_URL`. `APP_ENV=production` with a `postgresql://` URL passes.
  - `DATABASE_URL=mysql://user:s3cret@host/db` throws, and the message contains neither `s3cret` nor the URL.
  - `APP_ENV=prod` throws and lists the allowed values.
  - `VERCEL=1` with `APP_ENV` unset throws.
  - Two problems at once are both listed in one error.
  - `fixedClock(instant).now()` equals the instant on every call and returns a new `Date` each time, so changing one result doesn't change the next.
  - `systemClock.now()` is within a second of `Date.now()`.
- **Verification:** the tests pass, and neither file needs `@/server/db`.

### U3. Garage type and validation in the domain

- **Goal:** the `Garage` type and the rules a saved garage must pass, as pure logic.
- **Requirements:** R1, R6 (KTD9)
- **Dependencies:** U1
- **Files:** `src/domain/garage.ts` (new), `src/domain/garage.test.ts` (new), `src/content/garage.ts` (imports the type from the domain until U6 deletes it)
- **Approach:**
  - The `Garage` type moves here unchanged.
  - `checkGarage(garage)` returns a list of problems, empty when all is fine: `phone`, `whatsapp`, `postalCode`, `address`, and `hours` with its weekday and `HoursProblem`.
  - It reuses `isIndianPhoneNumber`, `isIndianMobileNumber` and `checkWeeklyHours`, and adds `isIndianPinCode` (`^[1-9]\d{5}$`), which task 24 can reuse.
- **Execution note:** write the tests first.
- **Patterns to follow:** `checkWeeklyHours` (`src/domain/opening-hours.ts`): codes a form can translate later.
- **Test scenarios:**
  - The owner's details give an empty list.
  - A landline, `+912012345678`, is accepted as `phone`. The same number as `whatsapp` gives a `whatsapp` problem.
  - `+91 97647 50567` (with spaces) gives a `phone` problem: only E.164 is stored.
  - PIN `012345`, `41210` and `4121011` each give a `postalCode` problem; `412101` passes.
  - An empty or blank English address gives an `address` problem. A missing Hindi text is fine.
  - Tuesday 10:00 to 09:00 gives `{ field: "hours", weekday: "tuesday", problem: "closes-before-opening" }`. Several problems come back together.
- **Verification:** the tests pass, and `src/domain/garage.ts` imports no Next.js, React or database code.

### U4. Schema, first migration, seed and the database module

- **Goal:** a migrated, seeded database that any server code can ask for, the right kind for how the app runs.
- **Requirements:** R1, R2, R3, R4 (KTD2 to KTD6, KTD13)
- **Dependencies:** U2, U3
- **Files:**
  - `src/server/db/schema.ts`
  - `src/server/db/migrations/` (generated SQL and `meta/`)
  - `src/server/db/seed-data.ts`, `src/server/db/seed-data.test.ts`
  - `src/server/db/seed.ts`
  - `src/server/db/index.ts`
  - `src/server/db/database.test.ts`
- **Approach:**
  1. Write the schema (KTD6), run `npm run db:generate`, and commit the SQL and `meta/`.
  2. `seed-data.ts`: `ownerGarage`, with the values from `src/content/garage.ts`. It imports only `type Garage`.
  3. `seed.ts`: `seedGarage(db)` checks `ownerGarage` and then, in one transaction, inserts the row if it's missing (`on conflict do nothing`) and the seven hours rows only when the row was new.
  4. `index.ts`: `createDatabase(config)` builds a postgres.js client, or a PGlite one (in memory or in a folder) that is then set to UTC, migrated (folder from `process.cwd()`) and seeded. `getDatabase()` picks the config (KTD2) from `serverEnv()` and `NODE_ENV`, and keeps the one promise on `globalThis`. Nothing runs at import time.
  5. Move the owner's-value assertions from `src/content/garage.test.ts` into `seed-data.test.ts`.
- **Execution note:** before U5, prove PGlite runs inside Next.js. Call `getDatabase()` from a temporary probe, run `next dev`, then run `next build`. Confirm `○ /en` and write down the build time. Then remove the probe.
- **Patterns to follow:** `satisfies Garage` in `src/content/garage.ts`; the owner's-value tests in `src/content/garage.test.ts`.
- **Test scenarios:**
  - A fresh in-memory database migrates and holds exactly one garage row equal to `ownerGarage`, and seven hours rows with Monday closed.
  - Seeding twice adds nothing. After the phone is changed, seeding again keeps the change.
  - The CHECK rejects a second `garage_settings` row (`id` 2).
  - `opening_hours` rejects `opens` 19:00 with `closes` 10:00, and a row with only `opens` set.
  - `SHOW TimeZone` returns `UTC`.
  - A folder database in a temporary directory: open it, change the phone, close it, open it again. The change is still there, and the migrations table lists each migration once.
  - A postgres.js config builds a client without connecting, so no server is needed.
  - Two concurrent `getDatabase()` calls resolve to the same instance.
  - Seeding a copy of `ownerGarage` with a landline WhatsApp number throws and inserts nothing.
  - The schema's weekday values equal `WEEKDAYS`, in order.
  - `seed-data.test.ts`: the owner's exact phone, WhatsApp, address, PIN and hours, and `checkGarage(ownerGarage)` is empty.
- **Verification:** the tests pass, `npm run db:generate` reports no changes on a second run, and the probe showed PGlite working under `next dev` and `next build`.

### U5. Garage data access: readGarage and saveGarage

- **Goal:** the only code that queries the garage: a cached public read and a checked save.
- **Requirements:** R1, R5, R6, R7, R10 (KTD7, KTD9)
- **Dependencies:** U4
- **Files:** `src/server/dal/garage.ts`, `src/server/dal/garage.test.ts`
- **Approach:**
  - The header comment says three things. The data-access layer is the only code that queries the database. Public reads need no check. Writes get a role check from task 16 on, so nothing may call `saveGarage` from a Server Action before then.
  - Mapping: a `time` value comes back as `10:00:00` and is read as `10:00`; a missing weekday reads as closed (A7); `countryCode` is `"IN"`.
- **Patterns to follow:** `document/solutions/conventions/nextjs-16-catch-only-expected-request-api-errors.md` (no catch-all); the `vi.mock` style in `src/app/[locale]/not-found.test.tsx`.
- **Test scenarios** (`@/server/db`'s `getDatabase` mocked to return an in-memory test database; `next/cache` mocked with spies):
  - `readGarage()` returns `ownerGarage` from a seeded database, and calls `cacheTag("garage")` and `cacheLife("max")`.
  - A stored `10:00:00` reads as `"10:00"`. A deleted Sunday row reads as `"closed"`.
  - With no garage row, `readGarage()` throws an error that names the missing garage details.
  - A valid save (new phone, Monday open 10:00 to 14:00, `fixedClock`) returns `{ ok: true }`. A fresh read returns the new values, there are still seven hours rows, `updated_at` equals the fixed instant, and `updateTag` was called once, with `"garage"`.
  - A landline as WhatsApp returns `{ ok: false }` with a `whatsapp` problem. The database is unchanged and `updateTag` is not called.
  - A save to a closed database rejects with the database error, and `updateTag` is not called.
- **Verification:** the tests pass, and no file under `src/app/` or `src/components/` imports `saveGarage`.

### U6. Read the garage from the database everywhere

- **Goal:** every caller uses the database read, in one commit, and the old content file is gone.
- **Requirements:** R2, R5, R11 (KTD8)
- **Dependencies:** U5
- **Files:**
  - Modify: `src/components/site/site-chrome.tsx` and its test, `src/app/[locale]/(site)/layout.tsx`, `src/app/[locale]/(site)/page.tsx` and `page.test.tsx`, `src/app/[locale]/not-found.tsx` and `not-found.test.tsx`, `src/app/global-not-found.tsx`, `src/app/[locale]/dev/design/page.tsx`.
  - Modify: the `Garage` type import in `src/components/site/site-header.tsx`, `site-footer.tsx`, `action-bar.tsx` and `not-found-content.tsx`.
  - Modify: the fixture import in `action-bar.test.tsx`, `site-footer.test.tsx`, `site-header.test.tsx` and `not-found-content.test.tsx` (now `ownerGarage`).
  - Modify: the comment in `src/domain/opening-hours.test.ts`, and `e2e/layout-shell.spec.ts` and `e2e/home.spec.ts` (import `ownerGarage`).
  - Delete: `src/content/garage.ts`, `src/content/garage.test.ts`.
- **Approach:** KTD8. The synchronous `readGarage()` disappears, so all five callers change together. Afterwards, a search for `content/garage` in `src/` and `e2e/` finds nothing.
- **Execution note:** run `npm run build` straight after the switch, before fixing the tests. The route list must show `○ /en`, and the global 404 must build.
- **Patterns to follow:** the `next-intl/server` mock in `src/app/[locale]/not-found.test.tsx`.
- **Test scenarios:**
  - The `SiteChrome` tests pass unchanged, given `garage={ownerGarage}`.
  - The home page tests pass against `await Home()` with `readGarage` mocked to `ownerGarage`.
  - New: when the mocked garage has phone `+912012345678`, the hero's Call link becomes `tel:+912012345678`, so the page uses the database value.
  - The `[locale]/not-found.tsx` tests pass against `await NotFound()`, and its Call and WhatsApp links use the mocked numbers.
  - The `(site)` layout and the global 404 have no unit test. The e2e suites cover them.
- **Verification:** the build shows `○ /en`, `npm run check` passes, and `npm run dev` after `npm run db:reset` shows the owner's details on `/`, on an unknown URL and on `/dev/design`.

### U7. Browser-boundary check on a production build

- **Goal:** prove no database code reaches the browser.
- **Requirements:** R9, R11 (KTD12)
- **Dependencies:** U6
- **Files:** `e2e/server-boundary.spec.ts` (new)
- **Approach:**
  - After the e2e build, read every file under `.next/static/`, the build's browser output: every chunk, not only the home page's.
  - Markers: `garage_settings`, `opening_hours`, `pglite`, `DATABASE_URL`.
  - Positive control: each marker must appear somewhere under `.next/server/`, or the scan proves nothing.
- **Execution note:** prove the guard. Put a marker string in a `"use client"` file for a moment, watch the scan fail, then revert it. Write the real output in the learning doc.
- **Test scenarios:**
  - No file under `.next/static/` contains any marker.
  - Each marker is found under `.next/server/`.
  - The existing `layout-shell.spec.ts` footer and hours tests pass with the database values.
- **Verification:** `npm run test:e2e` passes, and the guard went red with the planted marker.

### U8. Docs and tracker

- **Goal:** a junior engineer can find, run and change the database from the docs.
- **Requirements:** R12
- **Dependencies:** U7
- **Files:** `CLAUDE.md`, `readme.md`, `design-system/go-mechanic/MASTER.md`, `.claude/agents/seo-reviewer.md`, `document/task/task.md`. The learning doc, `document/learning/14_database_setup.md`, follows at `CLAUDE.md` workflow step 8.
- **Approach:**
  - `CLAUDE.md`:
    - Stack: Drizzle and PGlite are installed.
    - Repo map: `src/server/` (db, dal, env), `src/server/db/migrations/`, `drizzle.config.ts`, `.pglite/`, `.env.example`, `src/lib/clock.ts`; `src/content/` without the garage.
    - Commands: `db:generate`, `db:reset`.
    - New "Database" conventions:
      - queries only in `src/server/dal/`, with `server-only`;
      - public reads use `'use cache'` with `cacheTag` and `cacheLife("max")`; saves call `updateTag`;
      - schema change, then `npm run db:generate`, then commit the SQL; never edit a merged migration; restart dev to apply one;
      - never two processes on `.pglite/`;
      - `timestamptz` in UTC; money in integer paise; `LocalizedText` as jsonb;
      - the clock rule (KTD11) and `APP_ENV`;
      - pages that read data are async with `getTranslations`.
    - npm install scripts: add drizzle-kit's esbuild and tsx to the unapproved list.
  - `readme.md`: the first `npm run dev` creates `.pglite/`; when to use `db:reset`. No new prerequisite.
  - `MASTER.md`: the `SiteChrome` row and the "Server components fed by props" bullet (it now gets the garage as a prop).
  - `seo-reviewer.md`: the garage details now live in `garage_settings`, seeded from `src/server/db/seed-data.ts`.
  - `task.md`: link the plan, reword task 14's steps (A4), and add the "Deferred to Follow-Up Work" items to tasks 15, 16, 18, 20, 22, 23, 28, 40 and 41.
- **Test expectation:** none. Docs only.
- **Verification:** every path the docs name exists, and `grep -rn "content/garage" CLAUDE.md readme.md design-system .claude/agents` finds nothing.

---

## Verification Contract

| Command | When | Proves |
| --- | --- | --- |
| `npm run check` | After every unit | Lint, `next typegen` and `tsc`, and Vitest, including the in-memory PGlite tests |
| `npm run build` | U4 spike, U6 | `○ /en` in the route list, the global 404 builds, PGlite runs in the build workers |
| `npm run db:reset`, then `npm run dev` | U6 | A fresh clone works (R4): `/`, an unknown URL and `/dev/design` show the owner's details |
| `npm run test:e2e` | U7, before the pull request | Shell, home, i18n and the boundary scan on a production build |
| `npm run test:design` | Before the pull request | `/dev/design` and the home page under `next dev`, reading `.pglite/`. Required because `SiteChrome`'s props changed |

---

## Definition of Done

- R1 to R12 hold, and each unit's verification passed.
- `src/` and `e2e/` contain no `content/garage`, and nothing outside `src/server/dal/` queries the database.
- `.pglite/` and any `.env` file are untracked. The migrations and their `meta/` are committed.
- Each new package is pinned exactly, and no install script was approved.
- No Server Action, Route Handler or component calls `saveGarage`.
- U4's probe and any other trial code are removed.
- The `CLAUDE.md` workflow finishes it: learning doc, `ce-code-review`, `code-reviewer`, the compound question, then the "ready" message before any push.
