# 39_catalogue_admin: staff set the garage's real prices

> **Branch:** `39_catalogue_admin` · **Date:** 2026-11-20 · **Status:** In progress

## In one minute

Managers and the owner can now type the garage's real prices at `/admin/prices`. Each service or package gets one price per price group (such as Hatchback), and can also have a different price for one fuel. A save goes live straight away on `/services`, `/services/<id>`, `/packages` and `/book`, and those pages are still built ahead of time.

Full details: [the plan](../plans/2026-11-20-1311-feat-staff-price-editor-plan.md) (KTD1–KTD9) and the "Prices" block in `CLAUDE.md`.

**Built in parallel.** Two other Claude sessions worked at the same time, each in its own git worktree. This was Session 2, in `go-mechanic-s2`. So far nothing had to be merged in from `main`. If a merge is needed before the pull request, this section will say what conflicted.

## Why: the problem we solved

Since task 18, the `service_prices` table was empty. Visitors saw "call or WhatsApp for a price", and only `npm run dev` showed made-up sample prices. Staff had no way to enter real prices except by writing SQL. Booking (task 23) also prices every line from real prices only, so every booking line was "no price".

There was also a small bug from task 18's review. `fromPrice()` (the "From ₹…" on `/services`) looked at every fuel a service covers. A price row for a fuel that no model in the group runs on could make "From" lower than any price shown on the page.

The owner's decisions (2026-11-20):

- **Task 39 is prices only.** Editing services and packages, and editing brands and models with a "models approved" switch, moved to two backlog lines.
- **One price per price group for every fuel, plus an optional price for one fuel** (diesel costs more, say).
- **Managers and the owner** may edit (`content.edit`).
- **Live at once**, and the public price tables show the group names (Hatchback, Sedan …).

## What: what changed

| File or folder | Change | Why it exists |
| --- | --- | --- |
| `src/domain/money.ts` (+ test) | Added | `parseRupees` (typed text to paise) and `PRICE_RULES` (₹1 to ₹10,00,000) |
| `src/domain/services.ts` (+ test) | Changed | `groupFuels` moved here from the price table, `groupPriceRow`, `checkGroupPrices`, the `PriceBox` type; `fromPrice` counts only the fuels a page shows |
| `src/server/dal/services.ts`, `service-prices-staff.test.ts` | Changed / Added | `listPricesForStaff` (live read) and `saveGroupPrices` (the only price write) |
| `src/server/actions/prices.ts` (+ test), `src/lib/price-form.ts` (+ test) | Added | The `savePrices` Server Action and the form's state, shared by the action and the form |
| `src/app/[locale]/admin/prices/` | Added | `/admin/prices` (the list) and `/admin/prices/[serviceId]` (one service), each with a gate inside `<Suspense>` |
| `src/components/admin/price-list.tsx`, `service-price-editor.tsx`, `price-group-form.tsx` (+ tests) | Added | The list, the service page, and one card per price group |
| `src/components/admin/admin-navigation.ts`, `admin-overview.tsx` | Changed | A "Prices" item in the staff bar and on the overview |
| `src/components/site/service-prices.tsx` | Changed | Uses `groupFuels` from the domain |
| `(site)/services/page.tsx`, `(site)/packages/page.tsx` (+ tests) | Changed | Now read the vehicle catalogue too, for the `fromPrice` fix |
| `src/i18n/format.ts` (+ test) | Changed | `rupeeSymbol()` and `formatRupeeAmount()` for the price box |
| `messages/en.json` | Changed | The `AdminPrices` texts |
| `playwright.config.ts`, `e2e/prices.spec.ts`, `e2e/admin.spec.ts` | Changed / Added | Projects `site` and `prices`; the save-goes-live test; the customer HTML check covers `/admin/prices` |
| `CLAUDE.md`, `task.md` | Changed | The "Prices" rules; backlog lines |

## How: step by step

1. **Plan, then review the plan.** `ce-plan` wrote it; six reviewers read it. Their changes:
   - **An advisory lock in the save** (see New ideas). Without it, two saves of one card at once would crash on Postgres.
   - **"Works without JavaScript" was dropped.** The card renders inside a `<Suspense>` gate, and streamed content only appears once React's script runs, so a form without JavaScript was impossible there.
   - **Each card's controls get their own accessible name** ("Save Hatchback prices"), so a screen reader can tell twenty Save buttons apart.
   - **The cursor moves to the first box with an error**, and a lost connection shows a "no connection" message.
2. **The rules (`src/domain/`).** `parseRupees("₹1,500")` gives `{ ok: true, paise: 150000 }`. `"1500.50"` gives `not-whole`: prices are whole rupees. `checkGroupPrices` refuses a service priced after inspection, a group of the wrong vehicle kind, a fuel the group doesn't run on, and the same fuel twice.
3. **The save (`saveGroupPrices`).** Its order is fixed: `authorize("content.edit")`, check the ids, the cached reads (services, catalogue) *before* the transaction (PGlite has one connection), `checkGroupPrices`, then one transaction: lock, delete that group's rows, insert the typed ones. Last, `updateTag("service-prices")`.
4. **The action and the pages.** The page binds the service and group to `savePrices`, so a posted id does nothing. Both pages check `content.edit` inside `<Suspense>`, as task 26's board does.
5. **The card (`PriceGroupForm`).** A box for the group price, and a fold (`<details>`) with one box per fuel. A group whose models run on one fuel gets no fold; a group with no fuel the service covers gets a note. After a save it lists what was saved, per fuel.
6. **A browser check by hand.** On `npm run dev` (port 3001, the other sessions used 3000), logged in with the owner's local number: saved Hatchback ₹1,500 and Diesel ₹1,800, saw both with the group names on `/services/periodic-service` and "From ₹1,500" on `/services`, then cleared them. This found two layout bugs, fixed in `4fcfeae`: the headings were the wrong size (now `type-headline` for the page, `type-title` for sections), and cards in a row stretched to the tallest one (fixed with `items-start`).
7. **A simplify pass** (`5c9ddfd`, `aaf74c4`): one shared `groupPriceRow`, the `PriceBox` type in the domain, `formatRupeeAmount`, the helper renamed `selectPriceRows`, `Promise.all` for the two reads, three exports dropped, a `Fragment`. The comment reviewer's ideas were skipped: this repo keeps teaching comments and task tags on purpose.

## Decisions worth knowing

- **No request token.** Other saves (bookings, reviews) use one so a retry doesn't save twice. This save is idempotent (see New ideas), so a retry is harmless.
- **The menu still says "Packages".** A label that changes with the data would put a price read into the site shell, which the global 404 also renders. A backlog line asks the owner if "Packages" is fine.
- **Nothing records who saved a price.** That would be personal data. No personal data is stored, so the privacy notice didn't change.
- **Prices on the staff bookings board are left out** while task 27 changes that board (a backlog line).

## New ideas in this task

- **Paise:** 1 rupee = 100 paise. Money is stored as a whole number of paise (₹1,500 is `150000`), never as a decimal like `1500.00`, because computers round decimals in surprising ways. Staff type rupees; `parseRupees` turns them into paise.
- **Advisory lock:** a lock that means nothing to the database itself; it's a name your code agrees to queue on. `pg_advisory_xact_lock(hashtext('service-price:<service>:<group>'))` makes a second save of the same card wait until the first one's transaction ends. Like a single key to one room: a second person waits at the door instead of both walking in.
- **Idempotent save:** doing it twice gives the same result as doing it once. "Delete this group's rows, then insert these" is idempotent; "add a row" isn't.
- **`updateTag`:** `readServicePrices()` is cached with `cacheTag("service-prices")`, so the public pages are built once and served fast. `updateTag("service-prices")` throws that cached answer away, so the next visitor gets the new price. It only works inside a Server Action.
- **Playwright projects with `dependencies`:** a project is a named group of tests. `prices` has `dependencies: ["site"]`, so it starts only after every `site` test has finished. Every spec shares one server and one in-memory database, so a real price saved mid-run would break specs that expect no price.

## Check that it works

What was run in this session:

```bash
npm run test:e2e   # 137 passed; the prices project ran last
npm run check      # first run: 3 timeouts under load (load average about 16, other sessions running)
                   # those 3 files alone: 38 passed; full rerun: 2,482 passed
```

After the simplify pass, typecheck, lint and the 1,126 affected tests passed.

**Mutation checks** (break the code on purpose, see if a test notices; each was undone):

| Break on purpose | Tests failed |
| --- | --- |
| Revert `fromPrice`'s fuel fix | 3 |
| Remove `authorize` from `saveGroupPrices` | 3 |
| Drop the service filter from the delete | 1 |

**Not proven yet.** PGlite runs one transaction at a time, so no test here can show two saves racing. Task 20 checks that on Postgres (a backlog line).

**A log not yet explained.** Under `npm run dev`, "Next.js encountered the unstable value `Date.now()` while prerendering" appeared at `AdminNavGate` (task 26's admin layout) twice, each right after a file change recompiled the page, never on a fresh load. A backlog line records it; it wasn't investigated further.

## Common mistakes

- **Writing `₹` in `messages/en.json`.** `e2e/services.spec.ts` scans the live site for `₹`. The box's symbol comes from `rupeeSymbol()`.
- **Reading the cache inside the transaction.** `readServices()` opens its own query; on PGlite it would wait forever. Read first, then open the transaction.
- **Adding a spec that saves shared data to the parallel run.** Put it in the `prices` project.
- **Calling `saveGroupPrices` outside a Server Action.** `updateTag` throws there.

## Try it yourself

1. In `src/domain/money.ts`, predict what `parseRupees` returns for `"1.500"`, `"1 500"`, `"0"` and `"1000001"`. Check your guesses against `src/domain/money.test.ts`, which lists all four. Bonus: why is `"1.500"` refused as `not-whole` rather than read as fifteen hundred?
2. Run `npm run dev`, log in with the owner's number (code on `/dev/outbox`), and open `/admin/prices`. Type `1500.50` in a box and save. Where does the cursor go, and what does the message say? Then give Hatchback a price and look at `/services`: did the sample prices disappear everywhere? (`selectPrices` is all or nothing.) Clear it afterwards.

## Learn more

- Next.js caching: `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/updateTag.md` and `cacheTag.md`.
- [PostgreSQL: advisory locks](https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS): what they are and the `xact` (end-of-transaction) kind.
- [Playwright: project dependencies](https://playwright.dev/docs/test-projects#dependencies): running one group of tests after another.

## Review

**`ce-code-review`** (7 reviewers): "Ready with fixes". What we fixed:

- **A one-fuel card could overwrite a real price (P2, data loss).** When a price group's models run on one fuel only, the card shows one box and no fold. That box showed the every-fuel price. If the fuel also had its own price (the one customers pay, because a fuel's own row wins in `priceFor`), pressing Save without touching anything replaced it. The box now shows `groupPriceRow(rows, fuel)`, which is exactly what customers pay. A new test failed before the fix and passes after it (`service-price-editor.test.tsx`).
- **A comment named the wrong function (P3).** A rename (`selectPrices` → `selectPriceRows`) had also changed a comment that was about the other `selectPrices()`. Put back.
- **Added a round-trip test.** Every amount the editor shows (`formatRupeeAmount`) reads back through `parseRupees` as the same paise, so a Save without a change never changes a price.

Left as known gaps: two staff saving the same group at the same moment is "last save wins" by design (the advisory lock is only proven on real Postgres in task 20).

**`code-reviewer`:** "Needs changes", with two must-fixes, both fixed:

- **The price card had a shadow.** The design system keeps cards flat (`shadow-sm` is only for things that float, like menus). Removed.
- **`readme.md` still said prices couldn't be entered.** It now describes `/admin/prices`.

We also took two of its suggestions. The "not offered" card takes its name from its heading (`aria-labelledby`), and the Playwright config says that `--no-deps` runs the prices spec alone. We skipped one: refusing an every-fuel price for a group that offers no fuel. No screen shows that row, and no page reads it.

A full `npm run check` once failed one waiting test while the machine was busy (load average about 15). It passed when run again.

## Compound

Yes. Without a note, the next task whose browser test saves something every visitor sees (garage details, the offer, page content) would hit the same failures that depend on timing. The lesson is [`document/solutions/conventions/playwright-spec-that-saves-shared-data-runs-in-last-project.md`](../solutions/conventions/playwright-spec-that-saves-shared-data-runs-in-last-project.md).
