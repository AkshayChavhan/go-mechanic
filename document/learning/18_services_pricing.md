# 18_services_pricing: service pages, packages, and prices that stay off the live site

> **Branch:** `18_services_pricing` · **Date:** 2026-10-29 · **Status:** In progress

## In one minute

Visitors can now see what each of the garage's 11 services includes (`/services` and `/services/<id>`). They can also compare the Basic, Standard and Comprehensive packages for cars and for two-wheelers (`/packages`).

- **The data:** the services moved from a code file into the database. A new `service_prices` table is for real prices only, and it stays empty until the owner gives them.
- **The pricing:** one pure function, `priceFor()`, works out what a vehicle pays.
- **What the live site shows:** "Call or WhatsApp us for a price". Only `npm run dev` shows sample prices, each marked Sample, plus a price finder on `/packages`.
- **Also new:** the home page's tiles link to their pages, the menu marks the page you're on, and the phone menu's code downloads only when someone opens it.

Full details: [the plan](../plans/2026-10-29-1346-feat-services-pricing-plan.md) (KTD1–KTD10, units U1–U12) and the "Services and prices" block in `CLAUDE.md`.

## Why: the problem we solved

The home page listed the services (from `src/content/services.ts`), but a visitor couldn't find out what a service includes, how the packages differ, or what their vehicle would cost. Two things were missing:

- **Real prices.** The owner hasn't given them yet.
- **Checked models.** Task 17's vehicle models are a draft the owner hasn't checked.

So neither prices nor models may reach the live site. A customer who sees a price expects to pay it. But the owner still needs to *see* the whole price experience before deciding on numbers. Booking (task 23) and estimates (task 34) also need one trusted way to work out a price. Without it, each task would invent its own rule.

The owner decided six things on 2026-10-29:

1. Sample prices show only under `npm run dev` (`showSamples()`). The live site says "Call or WhatsApp us for a price".
2. The vehicle picker on `/packages` (the price finder) is dev-only until the owner checks task 17's draft models.
3. Claude drafts the package checklists and service details, and they show publicly: they describe the work and promise nothing.
4. No "time taken" anywhere: a turnaround time is a promise only the owner gives.
5. The menu item says "Packages" until real prices exist.
6. It stays one task.

## What: what changed

The commits up to `bc4c228`: `54 files changed, 5348 insertions(+), 352 deletions(-)` (`git diff --stat origin/main...HEAD`). 1,434 of those lines are the generated migration snapshot, and 444 are the plan. The browser tests and the `/dev/design` samples came after that commit.

| File or folder | Change | Why it exists |
| --- | --- | --- |
| `src/domain/services.ts` + test | Added | Pure rules: the `Service` and `ServicePrice` types, `priceFor`, `fromPrice`, `checkServices` (problem codes) and `servicePath` |
| `src/domain/vehicles.ts` | Changed | `isTextId` is now shared, so services and vehicles check ids the same way |
| `src/server/db/schema.ts`, `migrations/0004_services_pricing.sql` + `meta/` | Changed, Added | The `service_kind` enum and two tables: `services` and `service_prices` |
| `src/server/db/services-tables.test.ts` | Added | Proves the database refuses what the rules forbid, and tests the seed |
| `src/server/db/service-seed-data.ts` + test | Added | 11 services (the owner's names and summaries, Claude's drafted details) and 6 packages, with no prices. Plain data, so Playwright can import it |
| `src/server/db/seed.ts`, `index.ts` | Changed | `seedServices`, called last in `createDatabase` |
| `src/content/services.ts` + test | Removed | The services live in the database now |
| `src/content/sample-prices.ts` + test | Added | The sample prices, and `selectPrices()`: real prices, else the samples under `npm run dev`, else `null` |
| `src/server/dal/services.ts` + test | Added | `readServices()` and `readServicePrices()`: cached reads with their own tags |
| `src/app/[locale]/(site)/services/`, `(site)/packages/` + tests | Added | The three pages |
| `src/components/site/service-prices.tsx`, `package-card.tsx`, `check-list.tsx`, `price-finder.tsx` + test | Added | A service's price block, a package card, a ticked list, and the dev-only price finder |
| `src/components/site/service-tile.tsx` + test | Changed | A link version of the tile, an optional "From ₹…" line, and a wrench for a service with no icon of its own |
| `(site)/_components/home-services.tsx`, `home-hero.tsx`, `(site)/page.tsx` + test | Changed | The tiles link to their pages. "All services" under the grid, and "See packages" in the hero |
| `src/components/site/nav-links.tsx` + test | Added | Menu links that mark the current page (`aria-current`) |
| `mobile-menu.tsx`, `mobile-menu-panel.tsx` + tests, `site-header.tsx` + test, `site-chrome.test.tsx` | Changed, Added | The phone menu's panel loads lazily |
| `src/components/site/navigation.ts` | Changed | `services` and `prices` are now live pages |
| `messages/en.json` | Changed | The `Services` and `Packages` namespaces. `Nav.prices` now says "Packages". No `₹` anywhere |
| `src/app/[locale]/dev/design/page.tsx` | Changed | Samples of the new blocks |
| `e2e/services.spec.ts`, `e2e/dev/services-preview.spec.ts`, `e2e/home.spec.ts`, `server-boundary.spec.ts`, `dev/design-preview.spec.ts`, `dev/warm-up.ts` | Added, Changed | The live build shows no price or model, unknown ids answer 404, and the home → service → back trip works. `service_prices` is now a text that must never reach the browser. The dev samples work |
| `CLAUDE.md`, `features.md`, `MASTER.md`, `task.md` | Changed | The rules, what the live site shows, the new blocks, and notes for later tasks |

## How: step by step

1. **Plan.** `ce-plan` turned the owner's decisions into ten technical decisions (KTD1–KTD10) and twelve units (U1–U12). The rules and the sample gating were written test-first.

2. **The rules** (`src/domain/services.ts`). `priceFor(service, prices, vehicle)` gives one of four answers:
   - `price`, with the amount in paise;
   - `on-inspection`: the garage prices it after seeing the vehicle (denting and painting, engine, electricals, clutch and suspension, insurance claim help);
   - `no-price`: offered, but there's no price yet. That's every service on the live site today;
   - `not-offered`: the service doesn't cover this kind of vehicle or this fuel.

   A price row has a fuel, or `null` for "every fuel". A row for the vehicle's own fuel wins over the every-fuel row.

   `fromPrice()` gives the "From ₹…" amount. It doesn't just take the lowest row. It goes through every priced group and every fuel the service covers, using the same rule. So an every-fuel row that the fuels' own rows all replace never counts, because no vehicle would ever pay it (see "Try it yourself").

3. **The tables** (`src/server/db/schema.ts`). `services` holds services and packages, told apart by `kind`. Two of its rules are worth knowing:
   - **`UNIQUE NULLS NOT DISTINCT`** on `service_prices (service_id, category_id, fuel)`. Normally Postgres treats `NULL` as "unknown", and two unknowns are never equal, so a plain `UNIQUE` would let in two "every fuel" rows for the same service and group. `NULLS NOT DISTINCT` counts the two `NULL`s as equal, so the second row is refused (`23505`, unique_violation; a test checks it).
   - **The CHECK on `included`** is `jsonb_typeof(included) = 'array' and included <> '[]'::jsonb`. The obvious version, `jsonb_array_length(included) > 0`, raises an error when the value isn't a list. Postgres doesn't promise to work through `AND` from left to right, so a type test in front of it wouldn't protect it. Both parts used here can't fail on any value.

   Task 21 (Session 1) also adds a table and could also generate a migration numbered `0004`. So `main` was merged right before generating:
   ```bash
   git fetch origin && git merge origin/main
   npm run db:generate -- --name=services_pricing
   ```
   `--` passes `--name=...` through npm to drizzle-kit. `main` had no new commits, so the merge changed nothing, and the file became `0004_services_pricing.sql`.

4. **The seed** (`service-seed-data.ts`, `seedServices`). It works like task 17's catalogue seed. It checks the data first and throws on a problem, then inserts with `onConflictDoNothing`. So a new database gets everything, an existing one gets only the rows it lacks, and the owner's later edits survive restarts. It writes no prices. Periodic service, engine work and the six packages leave out electric vehicles until the owner says what those include.

5. **Sample prices** (`src/content/sample-prices.ts`). They live in code, never in the database. Pages read them only through `selectPrices(await readServicePrices())`. **A change from the plan:** the plan said to reuse `realOrSamples` from `src/content/home.ts`. That would have meant exporting it from `home.ts`, which task 19 (Session 3) may move. So `selectPrices` got its own three-line rule, and the file only imports the `Shown` type from `home.ts`. A test fails if any file other than `sample-prices.ts` mentions `samplePrices` (test files aside), or if a `"use client"` file imports it.

6. **Cached reads** (`src/server/dal/services.ts`). Both reads copy `readVehicleCatalogue()`: `'use cache'`, `cacheTag("services")` or `cacheTag("service-prices")`, and `cacheLife("max")`. The home page and `/dev/design` now read the services from the database, and `src/content/services.ts` is gone.

7. **The pages.** All three export `ensureStatic = "navigation"`, so a request-time read fails the build.
   - `/services/[slug]` gets its ids from `generateStaticParams()`. It returns the *seeded* ids through `serviceIdsToBuild()` (in `src/server/dal/services.ts`), not a database read. Why is step 13's first bump. Under Cache Components it must return at least one id; the seed has 11. A service the owner adds later is built on its first visit.
   - `notFound()` runs in `generateMetadata` *and* in the page, before any `<Suspense>`. So `/services/not-a-service` and `/services/car-basic` (a package: packages have no pages) answer a real 404.
   - The same page exports `instant = false`. Next.js 16 checks in dev that a navigation can show an "instant" shell, and reading `params` outside `<Suspense>` breaks that. Its suggested fix, reading `params` inside `<Suspense>`, would turn the 404 into a 200. So this page may wait for the server on a navigation instead; every known service is prebuilt, so the wait is for a static file.
   - The price block holds text only. Each page ends with one action group: Book (the only blue button) and Call.

8. **The price finder** (`price-finder.tsx`, dev only). It wraps the vehicle picker and prices the chosen kind's packages with `priceFor`. It reads no messages: the page passes every word, the catalogue and the prices as props. An electric vehicle gets "Not for this vehicle". **A change from the plan:** the plan's design review suggested writing the prices onto the package cards. Instead they show in the finder's own panel, beside the picker (under it on phones), under a polite live region (`role="status"`). This way the cards stay server-rendered and look the same in dev and on the live site.

9. **Home page links.**
   - Each tile's name is a link, and the link's `::after` stretches over the whole tile (a "stretched link"). The tile shows a hover colour (`bg-muted`) and a focus outline.
   - The grid lost `revealGroup`: a link may never sit inside a reveal target, or a hidden link could take keyboard focus while invisible. The heading still reveals.
   - An "All services" link sits under the grid. The hero gets a "See packages" text link under its two buttons. It sits outside `HomeActions`, which the page's last call to action also uses.

10. **The current page in the menu** (`nav-links.tsx`). A small client island reads `usePathname()` from `@/i18n/navigation` and marks the matching link with `aria-current="page"` and a visible style. The match is by prefix, so `/services/brakes` marks Services.

    While a page is prerendered, `usePathname()` suspends. So the island sits inside `<Suspense>`, with the same links, unmarked, as the fallback.

    The phone menu now closes on any link tap through one click listener on the panel, instead of a `SheetClose` around each link. So `site-header.tsx` no longer imports `ui/sheet`.

11. **The lazy phone menu, measured first.** Before this task, the phone menu's dialog code (Radix) loaded on every page, desktop too.
    - **The change:** `mobile-menu-panel.tsx` now holds the panel and loads on the menu button's first pointer-down or focus, so it's usually in before the tap ends. It loads with React's `lazy()` and `<Suspense>`, the same thing `next/dynamic` does inside the App Router (the plan had named `next/dynamic`).
    - **A change from the plan:** the plan wanted to keep a Radix `SheetTrigger` as the button. That would have kept the whole Radix dialog chunk in every page. So the button is a plain button that sets `aria-expanded` itself and gets focus back when the menu closes.
    - **The fallback:** while the panel loads, or if the download fails (an error boundary catches it), a plain panel shows the title, the page links and a close button.

    A throwaway script (not committed) added up the scripts each prerendered page's HTML loads, gzipped at level 9:

    | Page | Before | After |
    | --- | --- | --- |
    | `/` | 224.9 KB | 212.5 KB |
    | `/services` | 217.4 KB | 205.0 KB |
    | `/packages` | 222.2 KB | 210.0 KB |

    The dialog chunk itself is 14.4 KB gzipped. Task 12's note had estimated about 32 KB. Each page saves about 12.4 KB, a little less than the chunk; the new always-loaded code (the plain panel and the loading logic) probably makes up the difference, but that wasn't measured on its own.

12. **Browser tests.** `e2e/services.spec.ts` runs on the production build and scans everything it can find for text that only the samples or the finder hold: `₹`, the finder's words and the draft model names. It looks in each page's HTML, its page data, what a navigation fetches, and every script the pages load, the lazy menu panel included. The dev specs ran against this folder's `npm run dev -- --port 3001` through a scratch Playwright config, never `npm run test:design`: port 3000 belongs to Session 1.

13. **Bumps along the way.**
    - **A page that hung forever under `npm run dev`.** The first `generateStaticParams` read the services from the database. Production builds were fine, and so were the unit tests. Under `next dev`, though, `/services/brakes` sent nothing for minutes, with no error. The cause: `next dev` runs `generateStaticParams` in a helper process (`node_modules/next/dist/server/dev/static-paths-worker.js`, started through jest-worker). Since task 14, `getDatabase()` deliberately never settles in such a helper, so two processes never open `.pglite/` at once (`openForThisProcess` in `src/server/db/index.ts`). The fix: `serviceIdsToBuild()` returns the seed's ids without touching the database, and a unit test checks that `generateStaticParams` calls no read. `CLAUDE.md` ("Database") now says a `generateStaticParams` must never read the database. Only the dev specs caught this, when their warm-up timed out loading the page.
    - **Next.js's "instant shell" check** logged an error in the dev server for the same page (`params` read outside `<Suspense>`). Step 7 says why the page opts out with `instant = false`.
    - The price finder test first found the vehicle picker's own live region (also `role="status"`, hidden from sight with `sr-only`) instead of the finder's. The test now picks the visible one.
    - The menu tests call `vi.resetModules()` so each test loads the panel fresh. They must import `renderWithIntl` *after* that, too. Otherwise the provider comes from the old copy of next-intl and the menu's links from a new one, and the links can't find their provider.

## Built alongside other sessions

Session 2 built this task in its own git worktree (`go-mechanic-s2`, dev server on port 3001), alongside two other sessions:

- **Session 1, task 21 (customer vehicles),** which also adds a table. Its migration is also numbered `0004` (`0004_customer_vehicles`), so whichever branch merges second must generate its migration again.
- **Session 3, task 19 (info pages),** which may change `navigation.ts`, `samples.ts` and `messages/en.json`.

To stay out of each other's way, files were staged by name, `main` was merged right before `db:generate`, and only task 18's row and steps (plus new backlog lines at the end) were edited in `task.md`. Until this doc was written, `origin/main` had no new commits since the branch started, so there was no conflict yet. If task 21 lands first with its own `0004`, the fix is the task 17 lesson: delete this task's migration files and journal entry, take `main`'s, generate again, then `npm run db:reset`. Renaming the file is not enough.

<!-- MERGE -->

## Decisions worth knowing

| Choice | Why | What it costs |
| --- | --- | --- |
| Services and packages in one table | Task 23's booking items point at one table | A `kind` column, and a CHECK that a package covers one vehicle kind |
| Sample prices in code, not the database | `service_prices` only ever holds real prices; the first real one turns every sample off | Two places a price can come from, joined only in `selectPrices()` |
| Price by group and fuel, not by model | A hidden model still gets a price; the list stays short | Two sedans of the same fuel cost the same |
| `selectPrices` has its own rule | Avoids touching `home.ts`, which task 19 may move | Three lines that repeat `realOrSamples` |
| Finder prices in their own panel | The cards stay server-rendered and the same everywhere | The prices aren't next to each package's checklist |
| A plain menu button, not a Radix trigger | Keeps the dialog chunk out of every page | This file now sets `aria-expanded` and returns focus itself |
| Tiles no longer reveal on scroll | A link must never sit inside a reveal target | A little less motion on the home page |
| Electric left out of periodic service, engine and packages | Their checklists are about oil and filters | Electric owners see "Not for this vehicle" until the owner decides |

## New ideas in this task

- **NULL and `NULLS NOT DISTINCT`:** in SQL, `NULL` means "unknown", and `NULL = NULL` is not true, it's unknown again. So a plain `UNIQUE` lets in any number of rows that differ only by a `NULL`. It's like two forms with "unknown" in the name box: SQL won't say they're the same person. `NULLS NOT DISTINCT` (PostgreSQL 15 and later) tells the constraint to count them as equal.
- **No left-to-right promise:** Postgres may run the parts of `a AND b` in any order. So a CHECK must not rely on `a` to keep `b` from failing.
- **Discriminated union:** a TypeScript type that is one of several shapes, told apart by one field (`status`). `PriceResult` forces every caller to handle all four answers.
- **Dynamic route and `generateStaticParams`:** `[slug]` in a folder name matches any one path segment. `generateStaticParams` lists the values to build ahead of time.
- **`notFound()`:** stops rendering and sends the 404 page with status 404.
- **Live region:** a part of the page a screen reader reads aloud when its text changes, without moving focus. `role="status"` is a polite one: it waits until the reader has finished speaking.
- **`aria-current="page"`:** tells a screen reader "this link is the page you're on".
- **Stretched link:** a link whose `::after` pseudo-element covers its whole card, so the card is one big target while a screen reader hears only the link's name.
- **Code splitting and lazy loading:** cutting the JavaScript into chunks and downloading a chunk only when it's needed. Like a restaurant that cooks a dish when you order it instead of putting every dish on every table.
- **Error boundary:** a React component that shows something else when a component inside it fails, here a failed chunk download.
- **Gzip:** the compression browsers and servers use on the way. Sizes "gzipped" are close to what a visitor downloads.

## Check that it works

Re-run for this doc (`npx vitest run <file>`):

| File | Result |
| --- | --- |
| `src/domain/services.test.ts` | `Tests  36 passed (36)` |
| `src/content/sample-prices.test.ts` | `Tests  12 passed (12)` |
| `src/server/db/service-seed-data.test.ts` | `Tests  8 passed (8)` |
| `src/server/db/services-tables.test.ts` | `Tests  21 passed (21)` |
| `src/server/dal/services.test.ts` | `Tests  7 passed (7)` |
| `src/components/site/price-finder.test.tsx` | `Tests  5 passed (5)` |
| `src/components/site/nav-links.test.tsx` | `Tests  8 passed (8)` |
| `src/components/site/mobile-menu.test.tsx` | `Tests  8 passed (8)` |

From the work session:

- **Unit tests:** at one point the whole component, page, i18n, content and lib suites passed together (839 tests).
- **`npm run check`:** <!-- VERIFY: check -->
- **`npm run build`:** the route list shows `○ /en`, `○ /en/services`, `○ /en/packages` and the service pages as prerendered.
- **`npm run test:e2e -- --workers=2`:** `--workers=2` runs two tests at a time, because the other sessions kept the machine busy. <!-- VERIFY: e2e -->
- **The 404 without JavaScript:** `curl -s -o /dev/null -w "%{http_code}"` on `/services/not-a-service` against the production build. `-s` hides the progress bar, `-o /dev/null` throws the page away, and `-w "%{http_code}"` prints only the status code. <!-- VERIFY: curl -->
- **The dev specs** (`e2e/dev/`, scratch config, port 3001): <!-- VERIFY: dev specs -->

## Checks and reviews

- **ce-code-review:** <!-- REVIEW: ce-code-review -->
- **code-reviewer:** <!-- REVIEW: code-reviewer -->
- **Compound:** <!-- COMPOUND -->
- **Left for later, in `task.md`'s backlog:**
  - **Task 20:** seed the services on staging before its first build: the build prebuilds the seeded ids, and against an unseeded database each of those pages would be a cached 404.
  - **Tasks 23 and 34:** price with `priceFor()` over `readServicePrices()` only, never `selectPrices()`; ask the owner whether a booking may pick a package.
  - **Task 39:** real prices, a "time taken" per service, and a "models approved" switch that lets the finder go live. When the first real price is saved, rename "Packages" back to "Prices" and "See packages" to "See prices".
  - **Task 42:** canonical and Open Graph tags, and `Service` JSON-LD only once real prices exist.
  - **The owner:** check the drafted details and the sample price levels, say what an electric vehicle's service includes, and say whether the six price groups fit the real list.
  - **The scroll effects' `try`/`catch` fix (from task 13):** moved to the backlog, because this task didn't change the scroll effects.

## Common mistakes

- **A plain `UNIQUE` on a column that may be `NULL`.** Two `NULL` rows both get in. Add `NULLS NOT DISTINCT` (`.nullsNotDistinct()` in Drizzle).
- **A CHECK that can raise an error,** such as `jsonb_array_length` on a value that may not be a list. Use parts that can't fail.
- **Pricing a booking with `selectPrices()`.** Under `npm run dev` it gives the samples. Bookings and estimates use real rows only.
- **Importing `sample-prices.ts` from a client component, or typing `₹` into `messages/en.json`.** The samples or the sign would ship to every visitor. Tests catch both.
- **`notFound()` only in the page.** `generateMetadata` runs too, with no service to name. Call `notFound()` in both, before any `<Suspense>`, so the status is 404 and the title comes from the 404 page.
- **`getByRole("status")` on a page with two live regions.** It throws when two elements match. Pick the one you mean.
- **Importing a test helper before `vi.resetModules()`.** The helper and the code under test then use different copies of a library.
- **Wrapping a list of links in a reveal target.** A link hidden by the animation can still take keyboard focus.

## Try it yourself

About 10 minutes. Predict each answer first.

1. Create `src/content/try-prices.test.ts` with:
   ```ts
   import { test } from "vitest";
   import { samplePrices } from "@/content/sample-prices";
   import { fromPrice, priceFor } from "@/domain/services";
   import { draftServices } from "@/server/db/service-seed-data";

   const find = (id: string) => draftServices.find((s) => s.id === id)!;

   test("try", () => {
     const periodic = find("periodic-service");
     console.log("1", JSON.stringify(priceFor(periodic, samplePrices, { kind: "car", categoryId: "sedan", fuel: "diesel" })));
     console.log("2", JSON.stringify(priceFor(periodic, samplePrices, { kind: "car", categoryId: "sedan", fuel: "petrol" })));
     console.log("3", JSON.stringify(priceFor(periodic, samplePrices, { kind: "car", categoryId: "suv", fuel: "electric" })));
     console.log("4", JSON.stringify(priceFor(find("engine"), samplePrices, { kind: "car", categoryId: "sedan", fuel: "petrol" })));
     console.log("5", JSON.stringify(priceFor(find("brakes"), [], { kind: "car", categoryId: "sedan", fuel: "petrol" })));
     console.log("6", fromPrice(periodic, samplePrices));
     const oilOnly = { id: "oil", vehicleKinds: ["car"] as const, fuels: ["petrol", "diesel"] as const, pricedAfterInspection: false };
     const rows = [
       { serviceId: "oil", categoryId: "sedan", fuel: null, pricePaise: 100_000 },
       { serviceId: "oil", categoryId: "sedan", fuel: "petrol" as const, pricePaise: 200_000 },
       { serviceId: "oil", categoryId: "sedan", fuel: "diesel" as const, pricePaise: 300_000 },
     ];
     console.log("7", fromPrice(oilOnly, rows));
   });
   ```
2. Run it. `--silent=false` shows what the test prints:
   ```bash
   npx vitest run src/content/try-prices.test.ts --silent=false
   ```
3. Delete the file, and check that `git status` no longer lists it.

**Answers** (real output, from the same code run through a scratch config outside the repo):

```
1 {"status":"price","paise":399900}
2 {"status":"price","paise":349900}
3 {"status":"not-offered"}
4 {"status":"on-inspection"}
5 {"status":"no-price"}
6 89900
7 200000
```

- **1 and 2:** a diesel sedan has its own row (₹3,999). A petrol sedan falls back to the every-fuel row (₹3,499).
- **3:** periodic service leaves out electric.
- **4:** engine work is priced after an inspection.
- **5:** with no price rows, which is the live site today, the answer is "no price".
- **6:** "From" looks across both kinds, so periodic service starts at a scooter's ₹899.
- **7:** the every-fuel ₹1,000 row is fully replaced by the petrol and diesel rows, so no car ever pays it. `fromPrice` says ₹2,000.

## Learn more

- PostgreSQL: [unique constraints and `NULLS NOT DISTINCT`](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-UNIQUE-CONSTRAINTS), [expression evaluation order](https://www.postgresql.org/docs/current/sql-expressions.html#SYNTAX-EXPRESS-EVAL), [JSON functions (`jsonb_typeof`)](https://www.postgresql.org/docs/current/functions-json.html).
- Drizzle: [indexes and constraints](https://orm.drizzle.team/docs/indexes-constraints).
- Next.js, the bundled copy in `node_modules/next/dist/docs/01-app/`:
  - `03-api-reference/04-functions/generate-static-params.md`: read its Cache Components note on empty lists;
  - `03-api-reference/04-functions/not-found.md`;
  - `03-api-reference/03-file-conventions/dynamic-routes.md`;
  - `02-guides/lazy-loading.md`: `next/dynamic` and `React.lazy()`;
  - `02-guides/keeping-pages-static.md`;
  - `03-api-reference/03-file-conventions/02-route-segment-config/instant.md` and `02-guides/adopting-partial-prefetching.md` ("Move URL data behind Suspense"): the instant shell check.
- React: [`lazy`](https://react.dev/reference/react/lazy), [`Suspense`](https://react.dev/reference/react/Suspense).
- MDN: [`aria-live`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-live), [`aria-current`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-current), [the `status` role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/status_role), [`::after`](https://developer.mozilla.org/en-US/docs/Web/CSS/::after).
- Testing: [Testing Library's `ByRole`](https://testing-library.com/docs/queries/byrole/), [Vitest `vi.resetModules`](https://vitest.dev/api/vi.html#vi-resetmodules).
- The saved lessons this task followed: [`parallel-branches-same-migration-number-regenerate-not-rename.md`](../solutions/workflow-issues/parallel-branches-same-migration-number-regenerate-not-rename.md), [`nextjs-16-test-lazy-islands-with-app-router-dynamic.md`](../solutions/conventions/nextjs-16-test-lazy-islands-with-app-router-dynamic.md).
