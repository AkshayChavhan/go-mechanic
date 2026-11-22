# 41_admin_reports: staff reports and CSV downloads

> **Branch:** `41_admin_reports` · **Date:** 2026-11-22 · **Status:** In progress

## In one minute

Managers and the owner can now open `/admin/reports` and see four reports for a period: the rating, the top services, each mechanic's workload, and bookings per day. Each report has a "Download CSV" link that gives the same table as a file Excel or Google Sheets can open. Before this, the only way to answer "how busy were we last month?" was to count cards on the bookings board one day at a time.

Full details: [the plan](../plans/2026-11-22-1102-feat-admin-reports-plan.md) and the "Reports" block in `CLAUDE.md`.

**Built in parallel.** Two other Claude sessions worked on other tasks at the same time, each in its own git worktree. This was Session 2, in `go-mechanic-s2`. The branch started from the latest `origin/main`, and there was no merge conflict.

## Why: the problem we solved

The garage had bookings, jobs and reviews in the database, but no totals. The `reports.view` permission (managers and the owner) existed since task 16, with nothing behind it. Without reports, the owner can't see trends (which services sell, which mechanic is overloaded) or hand numbers to an accountant.

The owner's decisions (2026-11-22):

- **Four reports now.** The "approved estimate value" report waits for task 34, which approves estimates (a backlog line).
- **Periods:** the last 7, 30 or 90 days, or a custom from/to range.
- **CSV of totals only:** no customer names, phones, plates or booking codes. Mechanics' names are allowed in the workload report and its file.
- **Who:** managers and the owner, through the existing `reports.view`.

## What: what changed

| File or folder | Change | Why it exists |
| --- | --- | --- |
| `src/domain/report-period.ts` (+ test) | Added | `pickReportPeriod`: reads `?days=` or `?from=&to=`, falls back to 30 days with a note saying why |
| `src/domain/reports.ts` (+ test) | Added | One table builder per report. The page and the CSV both use them, so they can't disagree |
| `src/lib/csv.ts` (+ test) | Added | `toCsv`: a safe CSV writer (see New ideas) |
| `src/server/dal/reports.ts` (+ test) | Added | Four live reads, each starting with `authorize("reports.view")`, and `readReportTable`, the one call the page and the CSV make |
| `src/app/[locale]/admin/reports/page.tsx`, `reports-gate.tsx` (+ test) | Added | The page; the gate checks the permission and reads the period inside `<Suspense>` |
| `src/app/[locale]/admin/reports/export/route.ts` (+ test) | Added | The CSV download, a Route Handler |
| `src/components/admin/reports-view.tsx` (+ test) | Added | The period picker, the four tables and their CSV links (a Server Component) |
| `admin-navigation.ts`, `admin-overview.tsx` (+ tests) | Changed | A "Reports" item in the staff bar and on the overview |
| `messages/en.json` | Changed | The `AdminReports` texts |
| `e2e/admin.spec.ts` | Changed | Browser checks of the page and a CSV |
| `CLAUDE.md`, `readme.md`, `task.md` | Changed | The "Reports" rules, the front page, the task's steps |

## How: step by step

1. **Plan, then review the plan.** `ce-plan` wrote it; `ce-doc-review` sent it to six reviewers before any code. Their changes:
   - Service names come from the `services` table inside the read, so the page and the CSV show the same name.
   - Top services and workload leave out no-shows (see Decisions).
   - Each report gets a one-line description, and the fallback note says *why* the dates were changed.
   - The date boxes are filled in with the period shown.
   - Tables scroll with the keyboard, use `<th scope>` and put the totals in a `<tfoot>`.
   - The rating is five rows (1 to 5 stars) plus a total and the average.
   - The bookings report (the long one) comes last.
   - The CSV's 200 answer gets the private headers too, not only the 404.
2. **The pure parts first** (`src/domain/`, `src/lib/csv.ts`): the period, the table builders, the CSV writer. No database, so the tests are fast.
3. **The reads** (`src/server/dal/reports.ts`), tested on PGlite.
4. **The page and the CSV route**, then their tests.
5. **A browser check by hand** on `npm run dev` at port 3001 (the other sessions used other ports). Made one booking through `/book`, saw it in the tables, and fetched the CSV. Its body started `"Day","Booked",...` with a `2026-11-24` row, and the answer had `Cache-Control: private, no-store`. This found one bug: the totals row's label wasn't bold (fixed in `f6a2abe`).
6. **A simplify pass** (`ce-simplify-code`, five reviewers, `44b1351`): one shared `activeBookingsIn` filter for the reads, `eq()` for `"completed"`, and one needless `?.` removed. Skipped: making `readReportTable` throw instead of returning `null` (it would change a mock that a proof test relies on), and pruning comments (this repo keeps teaching comments on purpose).

## Decisions worth knowing

- **Bookings count on their slot's India day, grouped in code.** The read fetches each booking's `starts_at`, and `indiaDateOf` (from `src/domain/india-time.ts`) turns it into an India date. The old step in `task.md` said to group with SQL `AT TIME ZONE`. We didn't: `india-time.ts` is the one place that owns India time, and PGlite's time-zone data has never been tested.
- **Top services and workload count only active bookings** (`booked`, `confirmed`). Cancelling a booking doesn't clear `assigned_mechanic_id`, so counting cancelled ones would give a mechanic work they never did. The bookings report counts every status, since that's its point.
- **Workload groups by the stored assignee**, whatever their role is today. A mechanic later made a manager still did that work.
- **One table, two outputs.** `readReportTable` returns a `ReportTable`; the page formats its cells, and the CSV writes them as they are.
- **The CSV checks access itself.** See "Route Handler" below.

## New ideas in this task

- **Route Handler:** a `route.ts` file that answers a URL with any `Response` (here a file), instead of a page. Our first one that reads the session. Two traps:
  - The path has no dot (`/admin/reports/export`, not `/admin/reports.csv`). The proxy skips paths with a file extension, so a dot would skip its "logged out → `/login`" 307.
  - It calls `authorize("reports.view")` and turns only `AccessDeniedError` into a plain, empty 404. It never calls `requirePermission`: that calls `notFound()`, which would send the HTML 404 page as the "file".
- **CSV injection:** a spreadsheet treats a cell starting with `=`, `+`, `-` or `@` as a formula and runs it. Service and mechanic names are typed by staff, so a name like `=HYPERLINK(...)` could do harm on the owner's laptop. `toCsv` puts a `'` in front of such text (and of text starting with a tab or a carriage return), which spreadsheets show as plain text. Like writing "the word:" before a word so nobody reads it as an order.
- **Byte-order mark (BOM):** three invisible bytes at the start of a file that say "this is UTF-8". Without them, Excel guesses an old encoding and garbles Hindi or `₹`.
- **CRLF:** the two-character line end (`\r\n`) the CSV standard asks for.
- **India day vs UTC:** times are stored in UTC. India is 5 hours 30 minutes ahead, so a 2 AM India slot is stored as 20:30 UTC *the day before*. Grouping by the UTC date would put it on the wrong day.
- **`Cache-Control: private, no-store` and `nosniff`:** "don't let a browser or a proxy keep this file", and "don't guess another file type than the one I said".

## Check that it works

What was run in this session:

```bash
npm run check      # passed: 2,776 tests
npm run test:e2e   # passed: 137 tests
```

Both ran before the simplify commit (`44b1351`); afterwards, the 56 tests of the touched reads and page passed. The browser test checks the reports inside `admin.spec.ts`'s one owner login, so the test owner number never needs a third login code in an hour. Its counts are "at least" counts, because every spec books on the same database.

I re-ran the pure tests while writing this doc:

```bash
npx vitest run src/lib/csv.test.ts src/domain/report-period.test.ts src/domain/reports.test.ts
#  Test Files  3 passed (3)
#       Tests  40 passed (40)
```

By hand:

1. `npm run dev -- --port 3001` (any free port; `--` passes the flag on to `next dev`).
2. Log in at `/login` with the garage's own number (the local owner); the code is on `/dev/outbox`.
3. Make a booking at `/book`, then open `/admin/reports`. Try 7 days, then a custom range.
4. Click a "Download CSV" link and open the file in a spreadsheet.

## Common mistakes

- **Putting a dot in a Route Handler's path** under `/admin`: the proxy skips it, and a logged-out visitor gets no redirect.
- **Using `requirePermission` in a Route Handler:** the "file" becomes the HTML 404 page.
- **Grouping by UTC date** (`startsAt.toISOString().slice(0, 10)`): late-night India slots land on the wrong day.
- **Comparing a status with `'booked'` alone:** use `ACTIVE_STATUSES`, or confirmed bookings vanish from the totals.
- **Building a CSV by joining strings with commas:** a comma or a quote in a name breaks the columns. Use `toCsv`.

## Try it yourself

1. Open `src/lib/csv.test.ts`. Predict what `toCsv([["-5 off"], [-5]])` gives before reading the `test.each` cases. Why does the text get a `'` but the number doesn't?
2. In `src/domain/report-period.ts`, find what `pickReportPeriod` does with `?from=2026-11-10&to=2026-11-01`. Check your answer in `report-period.test.ts`, then try it on `/admin/reports` and read the note.

## Learn more

- Next.js Route Handlers: `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`.
- [OWASP: CSV injection](https://owasp.org/www-community/attacks/CSV_Injection): why the leading `'`.
- [RFC 4180](https://www.rfc-editor.org/rfc/rfc4180): the CSV format (quotes, CRLF).
- [MDN: Cache-Control](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control): what `private` and `no-store` mean.

## Review

_To come._

## Compound

_To come._
