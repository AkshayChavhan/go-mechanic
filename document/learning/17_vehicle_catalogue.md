# 17_vehicle_catalogue: the brands and models the garage works on, and a picker for them

> **Branch:** `17_vehicle_catalogue` · **Date:** 2026-10-28 · **Status:** In progress

## In one minute

The database now knows which vehicles the garage repairs:

- two kinds (car, two-wheeler) and four fuels (petrol, diesel, CNG, electric);
- six price groups (hatchback, sedan, SUV or MUV, scooter, motorcycle, premium motorcycle);
- the owner's 22 brands, with a **draft** of 142 models written by Claude.

A new vehicle picker (type → brand → model → fuel) is ready for tasks 18, 21 and 23. For now it appears only on `/dev/design`. Visitors see one change: under the services on the home page, a quiet row lists the brands by name. `/` is still built ahead of time (`○ /en`).

Full details: [the plan](../plans/2026-10-28-1802-feat-vehicle-catalogue-plan.md) (KTD1–KTD10, units U1–U8) and the "Vehicle catalogue" block in `CLAUDE.md`.

## Why: the problem we solved

Prices (task 18), a customer's saved vehicles (task 21) and bookings (task 23) all start with "which vehicle is it?". Before this task the site only knew the words "car" and "two-wheeler" (`src/content/services.ts`). Each of those tasks needs:

- the same list of brands, models and fuels;
- the same way to pick one;
- an answer that still means the same vehicle when a form is sent to a different server process.

Without one shared catalogue, each task would invent its own list, and a price for "Honda City" might not match a booking for it. The owner also wanted visitors to see straight away which brands the garage works on.

## What: what changed

Against `main` after task 22's merge, leaving out this doc: `40 files changed, 4360 insertions(+), 38 deletions(-)` (`git diff --stat origin/main...HEAD`). 1,198 of those lines are the generated migration snapshot, and 463 are the plan.

| File or folder | Change | Why it exists |
| --- | --- | --- |
| `src/domain/vehicles.ts` + test | Added | Pure rules. `VEHICLE_KINDS` (moved here from `src/content/services.ts`), `FUELS` and the catalogue's types. `checkCatalogue` returns problem codes. The picker's rules: `vehicleOptions`, `changeSelection`, `normalizeSelection`, `resolveVehicle` |
| `src/content/services.ts`, `home.ts` + tests, `src/components/site/service-tile.tsx` | Changed | They now import `VEHICLE_KINDS` from the domain |
| `src/server/db/schema.ts`, `migrations/0003_vehicle_catalogue.sql` + `meta/` | Changed, Added | Two enums (`vehicle_kind`, `fuel`) and three tables: `vehicle_categories`, `vehicle_makes`, `vehicle_models` |
| `src/server/db/vehicle-catalogue.test.ts` | Added | Proves the database refuses what the rules forbid |
| `src/server/db/vehicle-seed-data.ts` + test | Added | The draft: 22 brands, 142 models (78 cars, 64 two-wheelers), 6 price groups. Plain data, so Playwright can import it |
| `src/server/db/seed.ts`, `index.ts` | Changed | `seedVehicleCatalogue`, called after `seedGarage` and `seedSlotRules` in `createDatabase` |
| `src/server/dal/vehicles.ts` + test | Added | `readVehicleCatalogue()`: one cached read, listed rows only |
| `src/components/ui/native-select.tsx`, `restyle.test.tsx` | Added, Changed | shadcn's native select, restyled to 44px like our other fields |
| `src/components/site/choice-group.tsx` + test | Added | `ChoiceGroup`: native radios drawn as 44px pills |
| `src/components/site/vehicle-picker.tsx`, `vehicle-picker-labels.ts` + test | Added | The picker (a client island) and the server function that builds its labels |
| `src/app/[locale]/(site)/page.tsx`, `_components/home-services.tsx`, `page.test.tsx` | Changed | The brands row under the services grid |
| `messages/en.json` | Changed | The `Vehicles` namespace and `HomePage.services.brands` |
| `src/app/[locale]/dev/design/page.tsx` | Changed | Samples of the select, the pills and the picker |
| `e2e/home.spec.ts`, `e2e/server-boundary.spec.ts`, `e2e/dev/design-preview.spec.ts`, `e2e/dev/vehicle-picker.spec.ts` | Changed, Added | Brands on the home page. `vehicle_models` as a marker that must never reach the browser. 44px checks. The picker with and without JavaScript |
| `CLAUDE.md`, `readme.md`, `features.md`, `MASTER.md`, `task.md` | Changed | The catalogue rules, the brands served, the two new controls, and hand-overs for tasks 18, 20, 21, 23 and 39 |

## How: step by step

1. **Three sessions, three folders.** Session 2 built this task while two other Claude sessions worked on tasks 16 (in `../go-mechanic`) and 22 (in `../go-mechanic-s3`).
   - Each session has its own **git worktree**, its own branches, its own dev-server port and its own local database folder. This one uses port 3001.
   - The first attempt stopped because the `go-mechanic-s2` folder didn't exist yet. The owner created the worktree, and then work began.
   - The branch was made with `git switch -c 17_vehicle_catalogue origin/main`. That records `origin/main` as the branch's **upstream**, so depending on your git settings a bare `git push` could have aimed at `main`. This removed the link:
     ```bash
     git branch --unset-upstream
     ```
     The push later names the branch: `git push -u origin 17_vehicle_catalogue`.
   - Files were staged by name, never with `git add -A`, so nothing from another session's work could slip into a commit.

2. **Plan, and what the review changed.** First the owner decided four things (2026-10-28):
   - **the car brands:** Maruti Suzuki, Hyundai, Tata, Mahindra, Kia, Toyota, Honda, MG, Renault, Skoda, Volkswagen, Nissan;
   - **the two-wheeler brands:** Hero, Honda, TVS, Bajaj, Royal Enfield, Yamaha, Suzuki, KTM, Ather, Ola Electric;
   - **the models:** Claude writes them as a draft for the owner to check later (task 39 lets the owner edit them);
   - **the home page:** a names-only brands row, with no logos, because logos are other companies' trademarks.

   `ce-plan` used three research agents (code patterns, saved lessons, flows and edge cases). Then `ce-doc-review` ran five reviewers (coherence, feasibility, scope, design, adversarial), which led to 9 fixes. The two biggest:
   - **Ids made from names, not random ones.** Every build worker and every `next start` opens its own in-memory PGlite and seeds it. A random uuid would differ between the process that renders a form and the one that receives it. So ids are text that never changes: `hatchback`, `car-honda`, `car-honda-city`.
   - **Full lists before JavaScript loads,** even when the picker starts from a saved choice. Otherwise a visitor without JavaScript couldn't switch brand.

3. **The rules first** (`src/domain/vehicles.ts`, written test-first). The domain test file holds 31 tests. Two "break it on purpose" checks proved the tests can fail:
   - removing the line that clears a model of another brand made 3 tests fail;
   - removing the picker's narrowing made 2 picker tests fail.

   Both were restored. The rules in short:
   - every list is complete until an earlier choice narrows it;
   - choosing a model fills in its brand and type;
   - a model with one fuel selects that fuel;
   - a choice that no longer fits is cleared;
   - `changed` lists what the picker changed by itself, so a screen reader can be told.

4. **The tables** (`src/server/db/schema.ts`).
   - **Composite foreign keys, the repo's first.** Each model repeats its kind. `(make_id, kind)` must match a brand of that kind, and `(category_id, kind)` a price group of that kind. So the database itself refuses a car model under a two-wheeler brand or a scooter group.
   - **CHECKs.** At least one fuel (`cardinality(fuels) > 0`), and a non-blank English name. The name check is spelled with `coalesce`, because a CHECK whose result is NULL *passes*: a name with no `en` key would slip through.
   - **Hide, don't delete.** `listed = false` takes a brand or model off the site. The foreign keys refuse deletes (`ON DELETE RESTRICT`), so a saved vehicle (task 21) never loses its model.
   - **One change from the plan:** price groups got no `listed` column. Visitors never see a group, and a hidden group with visible models would mean nothing. The plan was updated to match.

   Task 22 (Session 3) would also generate a migration numbered `0002` from the same snapshot. So `main` was merged right before generating:
   ```bash
   git fetch origin && git merge origin/main
   npm run db:generate -- --name=vehicle_catalogue
   ```
   `--` passes `--name=...` through npm to drizzle-kit. The merge (`c89bc7e`) brought in task 15's follow-up pull request #16, with no conflicts. `main` had no new migration then, so this one was first `0002_vehicle_catalogue`. Whichever of tasks 17 and 22 merges second must delete its own migration files and journal entry, merge `main`, and generate again. Renaming its file to `0003` by hand is not enough: the journal would keep its older `when` time, and Drizzle's migrator skips a migration older than the newest one a database has already applied, so existing databases would never get it (found by the code review).

   **That is what happened.** Task 22 merged first (pull request #17), and `code-reviewer` caught that this branch no longer merged. The second `git merge origin/main` (`edadde3`) stopped on seven conflicts, resolved like this:
   - **The migration files:** this branch's `0002_vehicle_catalogue.sql` was deleted, and `meta/0002_snapshot.json` and `meta/_journal.json` were taken from `main` (`git show origin/main:<file> > <file>`). Then `npm run db:generate -- --name=vehicle_catalogue` wrote `0003_vehicle_catalogue.sql`. Its snapshot points back to `0002_slot_engine`'s, its `when` is later, and its SQL is identical to the old file's (checked with `diff`).
   - **`schema.ts`:** only the import list clashed; both sides' tables stayed.
   - **`seed.ts` and `index.ts`:** both new seeds stayed, called in the order `seedGarage`, `seedSlotRules`, `seedVehicleCatalogue`, with one combined header comment.
   - **`CLAUDE.md` and `task.md`:** both sides kept: both sections, both sets of repo-map entries, and task 17's backlog lines after task 22's.

   Then `npm run db:reset`, with the dev server stopped: the local database had recorded the old `0002_vehicle_catalogue` with a later `when` than `0002_slot_engine`, so the migrator would have skipped task 22's migration there.

5. **The draft and the seed** (`vehicle-seed-data.ts`, `seedVehicleCatalogue` in `seed.ts`).
   - The data file has no `server-only` import, so the Playwright specs can import it as the values they expect.
   - The seed checks the draft with `checkCatalogue` and throws on any problem. Then it runs one transaction with one insert per table, each with `onConflictDoNothing` on the id.
   - So a new database gets everything, and an existing one gets only the rows it lacks. It never updates a row, so the owner's later edits survive restarts.
   - It is called after `seedGarage` (and, since the merge with task 22, after `seedSlotRules`), not inside `seedGarage`, because `seedGarage` returns early on every database that already has the garage.
   - Timing, from a throwaway test that was deleted and never committed: `createDatabase 3710 ms; seed into empty 40 ms; seed again 28 ms`.

6. **One cached read** (`src/server/dal/vehicles.ts`). `readVehicleCatalogue()` copies `readGarage()`: `'use cache'`, `cacheTag("vehicle-catalogue")`, `cacheLife("max")`. It returns listed rows only, in order, and also leaves out a brand whose models are all hidden. An empty catalogue gives empty lists, not an error: the home row is optional. Task 20 must seed staging before its first build, or staging shows no brands. Whether a brand whose models are all hidden should still show on the home row is an owner decision for task 39 (in its backlog line).

7. **Two native controls.**
   ```bash
   npx shadcn add native-select --dry-run
   npx shadcn add native-select -y
   ```
   `--dry-run` lists what the CLI would write without writing it. `-y` answers "yes" to its prompt. Its one dependency, the `cn` package, was already in `package.json`, so no package was added. The restyle: `h-11` (44px), `type-body`, full width, and shadcn's small size removed.

   `ChoiceGroup` draws native radios as 44px pills. The chosen pill is filled with the text colour, not the blue. Blue is for actions, and a pale fill wouldn't reach the 3:1 contrast a chosen state needs.

8. **The picker** (`vehicle-picker.tsx`, `"use client"`).
   - It gets the catalogue and its labels as props from a server page (`vehiclePickerLabels()`), so the `Vehicles` messages never go to the browser.
   - It posts `vehicleKind`, `vehicleMake`, `vehicleModel` and `vehicleFuel`.
   - `useSyncExternalStore` tells it whether it has hydrated. Before that (on the server, and during hydration) it shows the full lists with any default selected. Narrowing starts afterwards.
   - It renders only the matching options, because iOS Safari ignores hidden `<option>`s.
   - A `role="status"` live region says what it changed by itself.
   - A known gap, found by the code review: a choice made in the fields while the page's JavaScript is still loading is reset when the picker hydrates, because the fields then follow React's state, which never saw that choice. Tasks 21 and 23 fix it (read the fields once at hydration). The component's comment and `CLAUDE.md` now say so.

9. **The brands row** sits inside `HomeServices`, under the grid. A section of its own would have broken about six fixed counts of sections and tones (tests, `homeTones`, `MASTER.md`). Chrome showed a bug the unit tests can't see: "Two-wheelers" ran into "Hero". Each row is a CSS subgrid, and its `gap-1` also set a column gap, which overrode the 32px from the list. `gap-y-1` fixed it (`de353fe`).

10. **Docs and hand-overs.** `CLAUDE.md` got a "Vehicle catalogue" block with two gates: the owner checks the draft models before task 18 shows any, and staging is seeded before task 20's first build. `task.md` got backlog lines for tasks 18, 20, 21, 23 and 39.

11. **Bumps along the way.**
    - `ON DELETE RESTRICT` answers with SQLSTATE `23001` (restrict_violation), not the `23503` (foreign_key_violation) an insert gets. One test expected `23503` at first.
    - Radios inside a disabled `<fieldset>` keep their own `disabled` property `false`. The test checks `radio.matches(":disabled")` instead.
    - A Server Component can't put an `onChange` on a native input. So `ChoiceGroup` adds `onChange` only when a parent passes one, which the `/dev/design` sample needs.
    - "Cars" appears on the service tiles too, so one test reads the brands block's own `<dt>` labels.
    - A test that would have typed the site's own name in `src/` was removed: `brand-name.test.ts` forbids it.
    - `npx tsx` was used once to count the draft. Avoid it: `npx` may download a package. Node 24 runs a `.ts` file directly (see "Try it yourself").

## Decisions worth knowing

| Choice | Why | What it costs |
| --- | --- | --- |
| Ids made from names, never changed | The same vehicle has the same id in every process and build | A typo in an id stays forever once something points to it |
| Price groups, not a price per model | Task 18's price list stays short: about 6 groups × 4 fuels, not ~140 models | A petrol Swift and a petrol i20 (both hatchbacks) cost the same |
| One brand row per kind (`car-honda`, `two-wheeler-honda`) | Each list keeps the owner's order; they are separate companies in India | "Honda" is stored twice |
| Composite foreign keys | The database refuses a car model under a two-wheeler brand | Each model repeats its kind |
| Hide, don't delete | Saved vehicles keep their model | Lists only grow; retiring a model means hiding it |
| The seed adds rows, never updates | The owner's edits survive restarts | Any draft correction (a renamed id, new fuels, a new price group, a removed model) reaches an existing local database only after `npm run db:reset` |
| Native select and radios, not Radix | They work before JavaScript, post with the form, and phones open their own list | Less custom look |
| Full lists until hydrated | No hydration mismatch, and it works without JavaScript | For a moment the lists are longer than they need to be |
| Brands row inside the services section | A new section would break about six fixed counts | On phones it sits under 11 service tiles; the owner may prefer it above the grid |
| No `hybrid` fuel | Strong hybrids count as petrol | A one-line migration if task 18 prices hybrids differently |

## New ideas in this task

- **Git worktree:** a second working folder for the same repository, with its own checked-out branch. Like two desks sharing one filing cabinet: each session works at its own desk.
- **Upstream branch:** the remote branch a local branch pushes to and pulls from by default.
- **Enum (Postgres):** a column type that only allows a fixed list of values, like `petrol` or `diesel`.
- **Composite foreign key:** a foreign key on two columns together. Here the pair (brand, kind) must exist in the brands table, not just the brand.
- **CHECK and NULL:** a CHECK rejects a row only when its test is `false`. `NULL` ("unknown") passes, which is why the name check uses `coalesce` to turn a missing name into `''`.
- **Array column:** one column holding a list, here `fuel[]`. Drizzle reads it back as a TypeScript array.
- **`ON CONFLICT DO NOTHING`:** "insert this row, unless one with the same id exists; then skip it quietly." It makes the seed safe to run on every start.
- **`ON DELETE RESTRICT`:** the database refuses to delete a row that others still point to.
- **Native control:** the browser's own `<select>` or radio. It works with no JavaScript, and phones show their own picker for it.
- **`<optgroup>`:** a labelled group inside a `<select>` ("Cars", "Two-wheelers").
- **Hydration:** React taking over HTML the server already sent. The first browser render must match the server's HTML, or React complains.
- **Live region (`role="status"`):** a part of the page a screen reader reads aloud when its text changes, without moving the user's focus.
- **CSS subgrid:** a grid row that reuses its parent grid's columns, so labels line up across rows.
- **Non-text contrast (3:1):** the WCAG rule that the parts showing a control's state must stand out at least 3:1 from what's around them.

## Check that it works

Real output, from the work session unless marked:

- `npx vitest run src/domain/vehicles.test.ts`: `31 passed` (re-run for this doc: `Tests  31 passed (31)`).
- Catalogue tests, re-run for this doc:
  - `npx vitest run src/server/db/vehicle-catalogue.test.ts`: `13 passed`;
  - `npx vitest run src/server/dal/vehicles.test.ts`: `7 passed`;
  - `npx vitest run src/components/site/vehicle-picker.test.tsx src/components/site/choice-group.test.tsx`: `16 passed`;
  - `npx vitest run src/server/db/vehicle-seed-data.test.ts`: `4 passed`.
- `npm run check`: `Test Files 78 passed`, `Tests 1147 passed`.
- `npm run build`: the route list still shows `○ /en`.
- `npm run test:e2e` took three tries:
  - First full run: `6 failed, 59 passed`, with the machine's load average about 37 (other sessions were building). The failures were timeouts and aborted page loads.
  - The three failing spec files, run again with `--workers=1`: `38 passed (3.0m)`.
  - Second full run: 1 failure (task 15's login test: the button still said "Checking…" when its 5-second wait ran out), 64 passed.
  - Third full run, `npm run test:e2e -- --workers=2`: `65 passed (1.3m)`. `--workers=2` runs two tests at a time instead of Playwright's default.
- **`npm run test:design` was not run.** It reuses whatever dev server is on port 3000, which is Session 1's, so it would have tested the other folder's code. The same `e2e/dev` specs ran instead against this folder's `npm run dev -- --port 3001`, through a scratch Playwright config kept outside the repo: `43 passed (7.6m)`. The pull request must say `/dev/design` changed, so `test:design` is run after the merge.
- **The dev server:** the first `GET /` on a brand-new `.pglite/` took 39.5 s, mostly Turbopack's first compile and PGlite creating the folder (the seed is 40 ms of it). The plan's stop condition was a cold start about 2 seconds slower than `main`. The facts recorded for this doc don't include a side-by-side start against `main`, but 40 ms is far inside that limit.
- **By hand in Chrome:**
  - The picker sample's server HTML had 166 `<option>`s in 24 groups: 22 brands plus a placeholder, and 142 models plus a placeholder; 2 brand groups and 22 model groups.
  - Choosing Two-wheeler left 10 brands and 64 models.
  - Choosing the Rizta set the brand to Ather and the fuel to Electric, and the live region read "Brand set to Ather. Fuel set to Electric".
  - There were no console errors.

## Checks and reviews

- **ce-code-review** (2026-10-28 to 29): 8 reviewers (correctness, adversarial, project standards, testing, maintainability, data migration, frontend races, saved lessons). Verdict: **Ready with fixes**, no P0 or P1. An independent validator confirmed both findings. The run stopped once partway, when the session's usage limit ran out, and resumed the next day from its saved files.
  - **P2, fixed:** nothing tested that `createDatabase` gives the catalogue to a database that already has the garage, the state of every local database made before this task. A new test empties a folder database's catalogue, reopens it and counts the draft's rows. Removing the seed call made it fail (`2 failed | 11 passed`), and it passes with the call (`02f551d`).
  - **P3, fixed:** a comment said the picker uses `resolveVehicle`; it doesn't (only the forms of tasks 21 and 23 will). Reworded (`6ee3b40`).
  - **Owner decision, later:** a listed brand whose models are all hidden also leaves the home row. Added to task 39's backlog line (`3ea2b4c`).
  - **Notes acted on:** the picker's gap before hydration is now written down; every draft correction (not only a rename) needs `npm run db:reset` locally; the picker reuses the domain's `findMake` and `findModel`; the catalogue test file opens one database and resets it before each test, as `CLAUDE.md` asks; the dev picker spec says why its counts need a reset after a draft edit.
  - **Notes left for later:** `/dev/design`'s page is now 1,138 lines (its new samples could move to a `_components` file); the announcement separator `". "` is English punctuation outside `messages/en.json`; no test hydrates the picker's server HTML with a default.
  - After the fixes, `npm run check` passed again: `Test Files 78 passed`, `Tests 1147 passed`.
- **code-reviewer, first run: Needs changes.** One must-fix: task 22 had merged into `main` meanwhile, so the branch conflicted with it, with two migrations numbered `0002`. Two suggestions: this doc's size line didn't match the diff, and a line in `seed.ts`'s header was badly wrapped. All three fixed by the merge above and this doc's update.
  - Re-run on the merged code: `npm run check`: `Test Files 81 passed`, `Tests 1270 passed`; `npm run test:e2e -- --workers=2`: `65 passed (2.2m)`, first try; `npm run build`: `○ /en`; the `e2e/dev` specs on port 3001: `43 passed (9.5m)`.
- **code-reviewer, second run: Ready to merge.** It confirmed the branch now merges with `main` without conflicts (`git merge-tree`), that the migration chain is valid (`0003`'s snapshot points to `0002_slot_engine`'s, and the journal times only go up), and that `npm run check` passes (81 files, 1270 tests). Two wording suggestions, both fixed: this doc and the plan still named the old seed order and the old snapshot file.
- **SEO check** (`seo-reviewer`, run by hand: the SEO Stop hook watches the folder this session started in, which is Session 1's, so it never fired for this worktree): `/` Pass (the brands are real text in the server's HTML, the heading order is unchanged, no links or images), `/dev/design` Pass (a 404 with `noindex` in production). The home page's own title, canonical link, social tags and JSON-LD wait for task 42.
- **Compound: one lesson saved.** The counterfactual question: without it, would a future session repeat the mistake? Yes. Three sessions keep adding tables in parallel, and renaming a clashing migration looks right but fails silently on every existing database. The lesson is [`parallel-branches-same-migration-number-regenerate-not-rename.md`](../solutions/workflow-issues/parallel-branches-same-migration-number-regenerate-not-rename.md), written with `/compound-engineering:ce-compound mode:non-interactive depth:lightweight`.
- **Not done yet, for later tasks:**
  - The owner still has to check the draft models, fuels and price groups before task 18 shows any model publicly.
  - The owner still has to decide whether customers may say "my model isn't listed" (tasks 21 and 23).
  - `ChoiceGroup` and `NativeSelect` have no error state yet (tasks 21 and 23).
  - The picker inside real forms (React resetting a form after its action, a choice made before hydration) is for tasks 21 and 23.

## Common mistakes

- **Random ids for catalogue rows.** Each process seeds its own copy, so a uuid differs between the page and the server that receives its form. Use the name-based id, and never change it.
- **Deleting a brand or model.** The foreign keys refuse it (`23001`). Set `listed = false`.
- **Expecting a corrected draft model to show up** (renamed, new fuels, another price group, removed). The seed never updates or deletes a row. Stop `npm run dev`, then run `npm run db:reset`.
- **Hanging the catalogue seed off `seedGarage`.** It returns early on existing databases, so they'd never get new rows.
- **Narrowing on the first render.** The server HTML and the first browser render would differ, and a visitor without JavaScript would be stuck. Start narrowing only after hydration.
- **Hiding `<option>`s with CSS.** iOS Safari shows them anyway. Render only the options that fit.
- **A CHECK without `coalesce`.** A missing value gives NULL, and NULL passes.
- **`gap-1` on a subgrid row.** It sets the column gap too and overrides the parent's. Use `gap-y-1`.
- **Working next to another session:** `git add -A` (stage by name), generating a migration without merging `main` first, or running `npm run test:design` while someone else's dev server holds port 3000.

## Try it yourself

About 15 minutes. Predict each answer first, and finish with `git status` showing a clean tree.

1. **The picker's rules, without a browser.** With nothing chosen, a visitor picks the Rizta. What happens to the type, the brand and the fuel? Then they switch the type to Car: what's cleared, and what stays? Finally, is the Rizta with petrol a valid vehicle? Check from the repo root (Node 24 runs the `.ts` files directly):
   ```bash
   node --no-warnings -e 'Promise.all([import("./src/server/db/vehicle-seed-data.ts"), import("./src/domain/vehicles.ts")]).then(([{ draftCatalogue: c }, v]) => { const a = v.changeSelection(c, v.EMPTY_SELECTION, { field: "model", value: "two-wheeler-ather-rizta" }); console.log(JSON.stringify(a)); const b = v.changeSelection(c, a.selection, { field: "kind", value: "car" }); console.log(JSON.stringify(b)); console.log(JSON.stringify(v.resolveVehicle(c, "two-wheeler-ather-rizta", "petrol"))); })'
   ```
2. **How the seed treats an existing database.** In `src/server/db/vehicle-seed-data.ts`, add a model to one brand: copy a line such as `["city", "City", "sedan", PD]` and give it a new slug and name. Restart `npm run dev` (in this worktree, `npm run dev -- --port 3001`) and look at the picker on `/dev/design`. Then rename that model in the file and restart again. Which change reaches your local database, and why? Finally: undo the edit, stop the dev server, and run `npm run db:reset`. Why is the reset needed even after undoing the edit?

**Answers.**

(1) Real output:
```
{"selection":{"kind":"two-wheeler","makeId":"two-wheeler-ather","modelId":"two-wheeler-ather-rizta","fuel":"electric"},"changed":["kind","make","fuel"]}
{"selection":{"kind":"car","makeId":null,"modelId":null,"fuel":"electric"},"changed":["make","model"]}
{"ok":false,"problem":"fuel-not-offered"}
```
The model fills in its type and brand, and its only fuel. In Chrome the live region named only the brand and the fuel, because the type was already Two-wheeler there. Switching to Car clears the brand and the model, but keeps Electric: cars have electric models too, so it still fits. Petrol isn't one of the Rizta's fuels.

(2) This one wasn't run for this doc; the answers come from the code. The new model appears, because the seed adds every draft row the database lacks, matched by id. The rename doesn't: the row's id already exists, so `onConflictDoNothing` skips it. The reset is needed because the seed never deletes either: the added model stays in `.pglite/` after you undo the edit. If your new line names a price group that doesn't exist, `checkCatalogue` catches it before anything is written: the database doesn't open, and the error starts "The seed vehicle catalogue is invalid: …" (the message in `seed.ts`).

## Learn more

- PostgreSQL: [constraints](https://www.postgresql.org/docs/current/ddl-constraints.html) (CHECK, foreign keys over several columns, `RESTRICT`), [enum types](https://www.postgresql.org/docs/current/datatype-enum.html), [arrays](https://www.postgresql.org/docs/current/arrays.html), [`INSERT … ON CONFLICT`](https://www.postgresql.org/docs/current/sql-insert.html), [error codes](https://www.postgresql.org/docs/current/errcodes-appendix.html).
- Drizzle: [indexes and constraints](https://orm.drizzle.team/docs/indexes-constraints), [insert and `onConflictDoNothing`](https://orm.drizzle.team/docs/insert).
- Next.js, the bundled copy in `node_modules/next/dist/docs/01-app/03-api-reference/`: `01-directives/use-cache.md`, `04-functions/cacheTag.md`, `04-functions/cacheLife.md`.
- React: [`useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore) (its `getServerSnapshot` is how the picker knows it has hydrated), [`useId`](https://react.dev/reference/react/useId).
- MDN: [`<select>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/select), [`<optgroup>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/optgroup), [`<fieldset>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/fieldset), [the `status` role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/status_role), [subgrid](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout/Subgrid).
- shadcn/ui: [Native Select](https://ui.shadcn.com/docs/components/native-select).
- WCAG 2.2: [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).
- Git: [`git worktree`](https://git-scm.com/docs/git-worktree), [`git branch --unset-upstream`](https://git-scm.com/docs/git-branch).
- The saved lesson this task followed for the seed's speed: [`nextjs-16-dev-server-is-not-one-process-use-cache-probe.md`](../solutions/conventions/nextjs-16-dev-server-is-not-one-process-use-cache-probe.md).
