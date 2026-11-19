---
title: Admin Bookings Board - Plan
type: feat
date: 2026-11-19
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-plan-bootstrap
execution: code
---

# Admin Bookings Board - Plan

## Goal Capsule

- **Objective:** The garage's owner and manager open `/admin` on their phone, from the browser or the home screen, and see each day's bookings and the waiting estimate requests with their photos. Customers and logged-out visitors never see any of it.
- **Means:** A staff area under `src/app/[locale]/admin/` with its own slim bar, server-rendered pages behind the proxy and `requirePermission`, and two new staff reads in the data-access layer (KTD1, KTD4, KTD6).
- **Authority:** `CLAUDE.md` (binding) > this plan's Requirements > its KTDs > unit Approach text. The owner's choices of 2026-11-19 (split, staff dates, phone bookings) are settled.
- **Stop conditions:** stop and ask at the KTD12 checkpoint (about 1,800 hand-written lines by the end of U3), or if the diff heads past about 2,500 lines. Also stop if any page needs the session outside `<Suspense>`, or a staff read can't check access on its first line.
- **Execution profile:** one branch, `26_admin_bookings_board`, small commits per unit, `npm run check` after each unit, `npm run test:e2e` at U6.
- **Finishing:** the main session commits on the task branch, then runs the learning doc, `ce-code-review`, `code-reviewer`, compound, and opens the pull request. The owner merges it.

---

## Product Contract

### Summary

Add `/admin`, the staff area. It has an overview page that links to what each role may use, a read-only bookings board for one India day at a time, an estimate-request inbox with a detail page that shows the photos, and a web app manifest so staff can add it to their phone's home screen. `/account` gets a "Staff area" link for staff.

### Problem Frame

Bookings (task 47) and estimate requests (task 32) now reach the database, but nobody at the garage can see them without a developer. The owner runs the garage from a phone. Task 27 (confirm, cancel, reschedule, assign) and task 33 (answering estimates) both need a staff area to build on.

### Requirements

**Access**

- R1. Logged-out visitors who open any `/admin` path get a real 307 to `/login`; a logged-in customer gets the site's 404 page, with no staff navigation or staff words anywhere in the HTML.
- R2. Every `/admin` page checks its own permission. `/admin` and `/admin/estimates/...` would otherwise be reachable when a layout check is skipped. The overview needs `admin.open`, the board `bookings.manage`, the inbox and its detail `estimates.manage`.
- R3. The staff bar's navigation shows only the sections the role may open (`can()`). The bar has a Log out button that works without JavaScript.
- R4. A staff member logged in on `/account` sees a "Staff area" link to `/admin`; customers don't.

**Bookings board**

- R5. `/admin/bookings` shows one India day's bookings in time order, today by default, with previous and next day links, a "Today" link whenever another day is shown, and a date field that works without JavaScript. A previous or next link that would leave the one-year range (R7) shows disabled.
- R6. Each booking shows its time, booking code, vehicle (make, model, fuel, registration), services and package lines, whether pickup is included, and the customer's name. The phone number and the pickup address show only with `customers.contact`.
- R7. A day with no bookings says so. A date that can't be read, or is more than a year from today, shows today with a note.

**Estimate inbox**

- R8. `/admin/estimates` lists the newest 50 estimate requests (vehicle, description preview, photo count, customer name, when sent). The phone number shows only with `customers.contact`. An empty inbox says so, and a full page of 50 says "Showing the newest 50 requests" (the sign that paging is due).
- R9. `/admin/estimates/<id>` shows one request in full with its photos. A malformed or unknown id gives the 404 page. A request whose photos were already removed says so. The page has a "Back to estimate requests" link (the installed app has no browser back button), loads its photos at once, and says the photo links expire after 5 minutes and a reload shows them again.

**Home screen**

- R10. On an admin page, Android and iOS offer to add GoMechanic's staff area to the home screen with the brand's icon, and it opens on `/admin`. Public pages offer nothing new.

### Key Decisions

- **Phone and walk-in bookings are task 50, not this task** (owner, 2026-11-19, to keep this pull request reviewable). Governs R5.
- **The board is read-only.** Changing bookings is task 27. Governs R5, R6.
- **Mechanics get the overview with a note that their jobs come with a later task** (confirmed in the scoping summary). No mechanic can be made before task 29, so there's no separate "Your jobs" page. Governs R2, R3.

### Scope Boundaries

- Not built: confirm, cancel, reschedule or assign (task 27); phone and walk-in bookings (task 50); hours, slots and pickup areas (task 28); team and roles (task 29); answering estimates and closing photo sets (task 33); a mechanic's job view (task 31).
- Considered and not built: a status filter on the board. Every booking is `booked` until task 27, so a filter would have one option. Task 27 adds it with its statuses.
- Considered and not built: paging on the board or the inbox. One garage's day holds a few dozen bookings at most, and the inbox read already caps at 50. Revisit when the inbox shows its "newest 50" note (R8).
- Considered and not built: offline use (a service worker). The board needs live data, and an offline copy would show stale or another person's data on a shared phone.
- Considered and not built: a return path (`/login?next=/admin`). The "Staff area" link on `/account` gets staff there in one tap. It goes in the backlog next to `/estimate`'s return-path note.
- Considered and not built: `forbidden()` and a 403 page. It's experimental in Next.js 16.4.6 (needs `experimental.authInterrupts`), and a 404 tells a customer nothing about the staff area.

### Deferred to Follow-Up Work

- A status filter and actions on the board (task 27).
- The board's staff-made bookings and their name and phone copies (task 50).

---

## Planning Contract

### Key Technical Decisions

- KTD1. **`src/app/[locale]/admin/` sits beside `login/`, outside `(site)` and `(book)`, with its own `layout.tsx`.** It renders a slim bar (Wordmark linking to `/admin`, a "Back to site" link, and the Log out form outside `<Suspense>`), then the page. The staff navigation renders inside a `<Suspense>` gate that reads `getCurrentUser()` and filters items with `can()`, so the prerendered shell anyone receives holds no staff words (R1, R3). The layout's static parts carry only words safe for anyone: the brand and "Log out". Its metadata title and `appleWebApp` title are the brand alone, and pages export no staff titles, so a customer's `<head>` holds nothing staff-specific apart from the noindex and the manifest link R10 needs (a URL, not a word). The Log out button appears to a customer in the prerendered shell for a moment before the 404 replaces it, which is acceptable.
- KTD2. **No `admin/not-found.tsx`.** Without one, `notFound()` from an admin page uses `src/app/[locale]/not-found.tsx`. That page replaces the admin layout, so a customer sees the plain 404 bar, never staff navigation. Inside `<Suspense>` the 404 answers status 200 with an injected `noindex` (`node_modules/next/dist/docs/01-app/02-guides/streaming.md`, "Status codes"). Browser tests check the page and the raw HTML, not the status.
- KTD3. **Each page puts its own `requirePermission(locale, ...)` inside its `<Suspense>` gate** (R2), never only the layout. Every heading, intro and staff word a page shows renders inside that gate, after the check; the prerendered page shell holds only a neutral fallback (R1). Unlike `/book`, no heading sits in the shell. The proxy gets `/admin` in `PROTECTED_PREFIXES` for the real 307 (R1). The layout's nav gate reads the session too; `getCurrentUser` is wrapped in React `cache()`, so it's one read per request.
- KTD4. **A new staff read, `listBookingsOn(date)`, in `src/server/dal/staff-bookings.ts`.** Its order:
  1. `authorize("bookings.manage")` on the first line.
  2. `parseIndiaDate` on the input (`invalid-date` otherwise).
  3. One query for bookings with `startsAt` from `indiaInstantOn(date, 0)` up to `indiaInstantOn(addDays(date, 1), 0)` (index `bookings_starts_at_index`), joined to `users`, `vehicle_models` and `vehicle_makes` (ignoring `listed`, like `requestColumns` in `estimate-requests.ts`).
  4. One `inArray` query for their `booking_items`, ordered by `position`.
  
  Phone and pickup address are `null` without `customers.contact` (R6), the same masking as `listEstimateRequests`. A new file keeps `bookings.ts` to the customer's save, whose fixed order `CLAUDE.md` guards.
- KTD5. **The board reads `searchParams` inside its `<Suspense>` gate.** The page passes the unawaited promise down. The gate calls `await io()`, then reads today as `indiaDateOf(systemClock.now())`. A value that's missing, an array, unreadable, or more than 366 days from today falls back to today with a note (R7); the bound also keeps previous and next links readable at the calendar's edges. The day links are `Link`s with `?date=`. The date field is a plain GET `<form>` whose `action` comes from `getPathname` (`@/i18n/navigation`). No client island holds booking data. Next.js still keeps a page you leave in the DOM (`<Activity>`, `node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md`), so a server-rendered board could be painted again after a log-out. If U6's Back check finds that, wrap the admin content in a client wrapper that remounts on the login identity in a `useLayoutEffect`, as task 47's `FollowPageLogin` does (`document/solutions/conventions/react-19-form-islands-hydration-action-activity.md`, section 3b).
- KTD6. **The inbox list signs no photo links; the detail page does.** View links last 5 minutes (`PHOTO_RULES.viewLinkSeconds`) and cost one query per set. The detail page calls a new `readEstimateRequestForStaff(id)` (in `src/server/dal/estimate-requests.ts`: `authorize("estimates.manage")`, then `isUuid`, then one query shaped like `listEstimateRequests`, phone masked the same way), then `photoViewUrls(photoSetId)` when the set still exists. It renders the photos as plain `<img>`, as `photo-uploader.tsx` does.
- KTD7. **The manifest is generated and linked only from the admin layout's metadata.** It's a Route Handler at `src/app/admin.webmanifest/route.ts` (the proxy skips `.webmanifest`, so the browser's cookie-less fetch works). It takes the brand from messages with `getTranslations({ locale: "en", namespace: "Brand" })`, because `brand-name.test.ts` forbids the brand typed into a file. Fields: `id` and `start_url` `/admin`, `scope` `/` (so `/login` and `/account` stay inside the app when a login has ended), `display: "standalone"`, theme colours from the design tokens' hex values. The admin layout's `generateMetadata` sets `manifest` and `appleWebApp`. The root `app/manifest.ts` convention would link it from every public page.
- KTD8. **Icons are PNGs generated with `ImageResponse` (`next/og`) from the letter path `src/app/icon.svg` draws:** 192px and 512px for the manifest, 180px for iOS. They're Route Handlers at paths ending in `.png` (the proxy skips them). The exact path layout is an implementation detail. If `ImageResponse` can't draw the letter path faithfully, static PNGs drawn from `icon.svg` with a one-off script are the fallback. `icon.test.ts`'s checks stay as they are.
- KTD9. **The overview `/admin` renders links, never redirects.** A redirect inside `<Suspense>` happens in the browser after a 200 (KTD2). It shows a card per section the role may open, and for a role with neither section (a mechanic) a note that their jobs come later. No nav item points at `/admin` itself (Wordmark does), because `NavLinks`' prefix match would mark it current on every page.
- KTD10. **Staff components go in `src/components/admin/`**, outside the `/dev/design` rule. They're built from existing `site/` and `ui/` parts (`Section`, `Button`, `Wordmark`, `NavLinks`). If one needs a new `site/` component, it gets its `/dev/design` sample.
- KTD11. **Browser tests use a test owner number in one serial spec file.** `playwright.config.ts` sets `OWNER_PHONE_NUMBER` for the e2e server to a fixed test number outside `freshNumber()`'s range (`60000` plus 5 digits), for example `+918000000001`. `e2e/admin.spec.ts` runs serially and logs the owner in once (`LOGIN_RULES` allows 5 codes an hour, and `alreadySent` sends no new SMS while a code works). Managers and mechanics can't exist before task 29, so their views are unit-tested with a mocked session.
- KTD12. **Size checkpoint: about 1,800 hand-written lines by the end of U3, within the 2,500-line stop line.** The estimate is 1,800 to 2,300 with tests. Past the checkpoint, stop and ask before U4. If the owner chooses to split, this pull request keeps U1 to U3 and U6's access, board and shared-phone tests, and a follow-up task takes U4 and U5 with R8 to R10, U6's inbox, photo and manifest checks, and U1's manifest metadata assertion.

### High-Level Technical Design

```mermaid
flowchart TB
  P[proxy: /admin and no session cookie] -->|307| L[/login]
  P -->|cookie present| Lay[admin layout: slim bar, Log out form]
  Lay --> NavGate[Suspense: nav gate, getCurrentUser, can]
  Lay --> Page[page shell, prerendered]
  Page --> Gate[Suspense: page gate]
  Gate --> RP{requirePermission}
  RP -->|no session| Rd[redirect to /login?session=ended, in the browser]
  RP -->|wrong role| NF[root not-found: plain 404 bar]
  RP -->|allowed| Read[staff read: authorize first, then input, then query]
  Read --> View[server-rendered list, no client island with data]
```

### Assumptions

- The privacy notice already covers garage staff seeing a customer's name, number, vehicles, bookings, estimate requests and photos. No new data is stored, so `LOGIN_NOTICE_VERSION` doesn't move. U6 checks the notice's wording and, if it names no staff access, updates it and moves the version.
- `ImageResponse` from `next/og` works in a Route Handler under Cache Components and is built at build time (no request API). U5 checks it against `node_modules/next/dist/docs/` first.

### Sources

- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/manifest.md`: the root-only file convention.
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-metadata.md` (`manifest`, `appleWebApp`).
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/forbidden.md`: still experimental.
- `node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md`: `searchParams` passed unawaited into `<Suspense>`.
- Lessons: `document/solutions/conventions/playwright-networkidle-hangs-after-second-page-load.md`, `react-19-form-islands-hydration-action-activity.md` (section 3b, shared phone), `nextjs-16-catch-only-expected-request-api-errors.md`, `server-action-login-invisible-until-next-request.md`, `signed-upload-links-keep-pending-rows-until-links-expire.md`.

---

## Implementation Units

### U1. The admin area, its access and the overview

- **Goal:** `/admin` exists, is protected, has its bar and role-filtered navigation, and shows the overview.
- **Requirements:** R1, R2, R3, R4.
- **Dependencies:** none.
- **Files:**
  - `src/lib/access-routes.ts`, `src/lib/access-routes.test.ts`
  - `src/app/[locale]/admin/layout.tsx`, `layout.test.tsx`
  - `src/app/[locale]/admin/page.tsx`, `page.test.tsx`
  - `src/components/admin/admin-bar.tsx`, `admin-nav-gate.tsx`, `admin-overview.tsx`, with tests
  - `src/components/admin/admin-navigation.ts`, `admin-navigation.test.ts`
  - `src/components/account/account-content.tsx`, its test (the "Staff area" link)
  - `messages/en.json` (`Admin` namespace)
- **Approach:**
  1. Add `/admin` to `PROTECTED_PREFIXES`.
  2. The layout follows KTD1: `generateMetadata` with `robots: { index: false, follow: false }` and a title with `{brand}`, the bar, the nav gate in `<Suspense fallback={null}>`, then `children`.
  3. `admin-navigation.ts` lists `{ href, labelKey, permission }` for Bookings (`bookings.manage`) and Estimate requests (`estimates.manage`). A pure `adminNavFor(role)` filters it with `can()`.
  4. The overview page's gate calls `requirePermission(locale, "admin.open")`, then renders KTD9's cards.
  5. The "Staff area" link goes inside `AccountContent`'s existing `<Suspense>`, shown when `can(role, "admin.open")`.
  6. The nav sits in the bar's fixed-height row, so its arrival moves nothing. Every page gate shares one loading line from messages as its fallback, as `/account` does.
- **Patterns to follow:** `src/app/[locale]/login/page.tsx` (slim bar, metadata), `(site)/estimate/estimate-gate.tsx` (gate), `(site)/account/page.tsx` (Log out form outside `<Suspense>`), `src/components/site/navigation.ts`.
- **Test scenarios:**
  - `/admin`, `/admin/bookings`, `/hi/admin` and `/%61dmin` without a session cookie get the login redirect; `/administrator` doesn't.
  - `adminNavFor("owner")` and `("manager")` give both items; `("mechanic")` gives none; `("customer")` gives none.
  - The overview gate, logged out, throws the login redirect digest; as a customer, the 404 digest; as a mechanic, renders the "jobs come later" note and no section cards; as a manager, renders both cards.
  - The layout's metadata is noindex and its title is the brand alone; after U5 it also links the manifest and Apple web app settings.
  - The prerendered layout output (gates mocked to null) contains no nav labels.
  - `AccountContent` shows the "Staff area" link for the owner and not for a customer.
- **Verification:** `npm run check` passes; under `npm run dev`, the garage's own number reaches `/admin` and sees both cards.

### U2. The staff bookings read

- **Goal:** `listBookingsOn(date)` returns one India day's bookings for staff.
- **Requirements:** R5, R6.
- **Dependencies:** none.
- **Files:** `src/server/dal/staff-bookings.ts`, `src/server/dal/staff-bookings.test.ts`, `src/domain/bookings.ts` (a `StaffBookingRow` type if the domain is the right home), `CLAUDE.md` (repo map).
- **Approach:** KTD4. Returns `{ ok: true, bookings }` or `{ ok: false, problem: "invalid-date" }`. Rows carry the booking's own copies (vehicle, lines, pickup) with names from the join, the registration compact (the page formats it), and `phoneNumber` and `pickupAddress` masked.
- **Patterns to follow:** `listEstimateRequests` and its test (`src/server/dal/estimate-requests.test.ts`: five fake users, `can` mocked over the real one), `readBookedBooking` in `src/server/dal/bookings.ts` for the row and line shape.
- **Test scenarios:**
  - Logged out, a customer, and a mechanic each reject with `AccessDeniedError`, and `getDatabase` is never called.
  - An unreadable date (`2026-02-30`, `tomorrow`) as the manager answers `invalid-date` without a query.
  - Bookings at 00:00 and 23:30 India time on the day are included; one at 00:00 the next day and one at 23:30 the day before are not (the UTC boundary at 18:30).
  - Rows come in `startsAt` order, each with its lines in `position` order.
  - A booking whose vehicle model was later hidden (`listed = false`) still shows its make and model.
  - With `bookings.manage` but not `customers.contact` (`can` stubbed), phone and pickup address are null while "pickup included" stays true.
  - A day with no bookings gives an empty list.
- **Verification:** the DAL tests pass, and breaking the `authorize` line or the day range makes a test fail.

### U3. The bookings board page

- **Goal:** `/admin/bookings` shows the board for one day.
- **Requirements:** R5, R6, R7.
- **Dependencies:** U1, U2.
- **Files:** `src/app/[locale]/admin/bookings/page.tsx`, `page.test.tsx`, `src/components/admin/bookings-board.tsx`, `bookings-board.test.tsx`, a pure `pickBoardDate(value, today)` helper (in `src/domain/` or next to the board) with its test, `messages/en.json`.
- **Approach:** KTD5. The gate calls `requirePermission(locale, "bookings.manage")`, then picks the date, then `listBookingsOn`. Times with `formatTime`, the day heading with `formatIndiaDate` plus the weekday, codes with `formatBookingCode`, plates with `formatRegistration`, phones with `formatPhoneNumber` as `tel:` links, names with `localize`. A line with no price shows nothing about money (prices come with task 39).
- **Patterns to follow:** `(book)/book/booking-loader.tsx` (`io()` first), `src/components/account/estimate-requests.tsx` (card markup), `src/i18n/format.ts`.
- **Test scenarios:**
  - `pickBoardDate`: no value, an array, `2026-02-30`, and a date 400 days away each give today with the note flag; `2026-11-20` gives itself.
  - The page, as a mechanic, throws the 404 digest; logged out, the login digest.
  - The board renders two bookings in time order, with code `K7Q-4MX` style, plate `MH 12 AB 0042` style, and its lines.
  - Without contact permission, no phone link and no address are rendered; with it, both are.
  - An empty day shows the "no bookings" text; previous and next links carry the neighbouring dates.
  - The "Today" link shows on another day and not on today; on the last day of the one-year range the next link renders disabled (not a link), and the same for previous on the first day.
  - The date form's action is the locale's `/admin/bookings` path and its field is named `date`.
- **Verification:** `npm run check` passes; under `npm run dev`, a booking made on `/book` appears on its day.

### U4. The estimate inbox and its detail page

- **Goal:** Staff read estimate requests and see their photos.
- **Requirements:** R8, R9.
- **Dependencies:** U1.
- **Files:**
  - `src/server/dal/estimate-requests.ts`, its test (`readEstimateRequestForStaff`)
  - `src/app/[locale]/admin/estimates/page.tsx`, `page.test.tsx`
  - `src/app/[locale]/admin/estimates/[requestId]/page.tsx`, `page.test.tsx`
  - `src/components/admin/estimate-inbox.tsx`, `estimate-detail.tsx`, with tests
  - `messages/en.json`, `CLAUDE.md`
- **Approach:** KTD6. Both gates call `requirePermission(locale, "estimates.manage")`; the detail gate also awaits `params` inside `<Suspense>`. The detail page renders `notFound()` for a `not-found` answer. Photos missing (`photoSetId` null, or `photoViewUrls` says `not-found`) show "The photos were removed". Each inbox row links to its detail page.
- **Patterns to follow:** `listEstimateRequests` and `src/components/account/estimate-requests.tsx` (`descriptionPreview`), `(site)/services/[slug]/page.tsx` (`params`).
- **Test scenarios:**
  - `readEstimateRequestForStaff`: logged out, a customer and a mechanic reject before `getDatabase`; `not-a-uuid` and an unknown uuid answer `not-found`; the manager gets the request with its phone; without `customers.contact`, phone is null.
  - The inbox renders the newest first with photo counts, and each row links to `/admin/estimates/<id>`.
  - No requests shows the empty text; exactly 50 shows the "newest 50" note; 49 doesn't.
  - The detail page, with photos, renders one `<img>` per photo with an alt text from messages; with `photoSetId` null, the removed-photos text; with an unknown id, the 404 digest.
  - The detail page has the back link to `/admin/estimates`; its images have no `loading="lazy"`, and the expiry line shows whenever photos do.
- **Verification:** `npm run check` passes; under `npm run dev`, a request sent from `/estimate` with a photo shows that photo on its detail page.

### U5. Add to home screen

- **Goal:** Staff can install `/admin` with the brand's icon.
- **Requirements:** R10.
- **Dependencies:** U1.
- **Files:** `src/app/admin.webmanifest/route.ts` with its test, the icon Route Handlers (KTD8) with a test, `src/app/[locale]/admin/layout.tsx` (metadata), `src/proxy.test.ts` (if the new paths aren't covered), `CLAUDE.md`.
- **Approach:** KTD7, KTD8. Read the manifest and `ImageResponse` docs in `node_modules/next/dist/docs/` first. Keep the handlers static (no request API), so the build prerenders them.
- **Patterns to follow:** `src/app/global-not-found.tsx` (messages outside a `[locale]` page), `src/app/icon.svg` and `icon.test.ts`.
- **Test scenarios:**
  - The manifest's `name` and `short_name` come from messages, `start_url` and `id` are `/admin`, `scope` is `/`, its icons list 192 and 512 PNGs that exist.
  - The proxy skips `/admin.webmanifest` and the icon paths (`src/proxy.test.ts`).
  - A public page's HTML has no `rel="manifest"` link; an admin page's has one (browser test in U6).
  - Each icon answers `image/png` at its stated size.
- **Verification:** in Chrome's DevTools under `npm run build && npm start`, the Application panel shows the manifest with no errors and the icons.

### U6. Browser tests and docs

- **Goal:** The whole area is proven on a production build, and the repo docs describe it.
- **Requirements:** R1 to R10.
- **Dependencies:** U1 to U5.
- **Files:** `playwright.config.ts` (`OWNER_PHONE_NUMBER`), `e2e/admin.spec.ts`, `e2e/access.spec.ts`, `e2e/helpers.ts` (a login helper that takes a number), `CLAUDE.md` (repo map, "Roles and access", a new "Staff area" block), `readme.md` if it lists pages, `document/task/task.md` (backlog: the `/login?next=` return path).
- **Approach:** KTD11. The spec runs serially. A customer books on `/book` and sends an estimate request with a photo, then the owner logs in once and checks the board for that booking's day, the inbox, the detail page's photo, the manifest link, and log out.
- **Patterns to follow:** `e2e/booking.spec.ts` and `e2e/estimate.spec.ts` (helpers, outbox codes), `e2e/access.spec.ts` (`page.request.get(path, { maxRedirects: 0 })`), the networkidle lesson (`expectNoErrors` on the first load only).
- **Test scenarios:**
  - A logged-out GET of `/admin` and `/admin/bookings` gets a 307 to `/login`.
  - A logged-in customer opening `/admin`, `/admin/bookings` and `/admin/estimates` sees the 404 page, and the raw HTML of each response contains none of the `Admin` namespace's staff strings (nav labels, page headings, overview card words, "Staff area"), no seeded booking code and no customer name.
  - The owner sees the customer's booking on its day (found by its code, not by row count, since other specs book too) with the customer's phone.
  - The owner opens the request's detail page and its photo loads (`naturalWidth > 0`).
  - The `/account` page shows the owner the "Staff area" link.
  - The admin page links the manifest; `/` doesn't.
  - Shared phone: the owner logs out from the bar, a customer logs in on the same page and presses Back; a non-retrying read of the page text right after the navigation (`page.evaluate` of `document.body.innerText`) contains no booking code and no staff nav label (KTD5 names the fix if it fails).
- **Verification:** `npm run check` and `npm run test:e2e` pass; `npm run test:design` passes if any `site/` or `ui/` component changed.

---

## Verification Contract

| Gate | Command | When |
| --- | --- | --- |
| Lint, types, unit tests | `npm run check` | after every unit |
| Browser tests on a production build | `npm run test:e2e` | at U6, and before the pull request |
| Design catalogue | `npm run test:design` | only if a `site/` or `ui/` component or a token changed |

Run Node through `fnm exec --using=24 --`. Port 3210 may be busy with another session's run: wait and retry. Tests that open PGlite follow `CLAUDE.md`'s timeout rule.

## Definition of Done

- Every R1 to R10 has a passing test that names it in its scenario, and U1 to U6's verification outcomes hold. If the KTD12 split happens, the items KTD12 lists move to the follow-up task.
- No staff word or customer data reaches a customer's or a logged-out visitor's HTML.
- `CLAUDE.md`'s repo map lists the new files, and its rules block says how `/admin` pages check access and where staff reads live.
- The privacy notice check in Assumptions is done, and its outcome is in the learning doc.
- No dead-end or experimental code from abandoned attempts is left in the diff.
- The learning doc, reviews and compound step follow `CLAUDE.md`'s task workflow.
