# GoMechanic: feature list and build plan

> **Status:** approved by the owner on 2026-10-24. After approval the owner asked for an **Apple-like UI with good animation**, so tasks 12–16 were reordered: the layout and home page now come before the database and login, so the look can be seen and refined early. The product feature list lives in [document/website/features.md](../website/features.md).

## Context

The owner wants a website for **one garage in India, named GoMechanic**, that repairs **cars and two-wheelers**. It's a single-garage project: no multi-garage platform, no marketplace. It's served at the **domain root** (`/`, `/services`, `/book`, `/account`, `/admin`).

Decisions from the owner:
- **Languages:** English first, built so Hindi can be added later without rework.
- **Version 1:** the full system **except online payments and GST invoices**.
- **Paid services** (OTP SMS, WhatsApp, email) use free stand-ins until the launch tasks.
- **SEO:** an **SEO reviewer agent must run automatically every time Claude changes pages**, and share the changes plus its suggestions.

The repo has its rules, skills, agents and Compound Engineering set up (tasks 01–06), but no app code. This plan replaces the old backlog (07–10). Every task keeps the repo workflow: one `NN_name` branch, the Compound Engineering loop (ce-plan → work → ce-code-review + `code-reviewer` → ce-compound lightweight), a learning doc in `document/learning/NN_name.md`, merge `--no-ff`, then a "mark done" commit.

**Flag for the owner:** "GoMechanic" is already a well-known Indian car-service brand (gomechanic.in). That's a trademark risk and makes ranking for the name hard. Decide before the logo (task 11) and the domain (task 42).

## Who uses it

| Role | What they do |
| --- | --- |
| **Customer** (car or bike owner) | Checks services and prices, books, tracks the job, approves estimates |
| **Owner / manager** | Runs the garage: bookings, prices, slots, estimates, staff, content |
| **Mechanic** | Updates assigned jobs and uploads photos from a phone (can't see customers' phone numbers) |

## Feature list

> Snapshot at approval. The living copy is [document/website/features.md](../website/features.md); update that one.

✅ = version 1 · 🔜 = later

### A. Public website
1. ✅ **Home:** what GoMechanic does, trust signals (years, vehicles serviced, rating, warranty), big **Book / Call / WhatsApp** buttons.
2. ✅ **Prices by vehicle:** pick type (car or two-wheeler) → brand → model → fuel (petrol, diesel, CNG, electric) and see that vehicle's prices ("from ₹…").
3. ✅ **Service packages:** Basic / Standard / Comprehensive, side by side with a checklist of what's included.
4. ✅ **Service pages:** periodic service, AC, denting and painting, battery, tyres and alignment, brakes, clutch and suspension, engine, electricals, wash and detailing, insurance claim help. Each shows what's included, signs you need it, time taken and price.
5. ✅ **About:** story, team, certifications, workshop photos, genuine parts (OEM/OES), warranty.
6. ✅ **Reviews** from customers with completed jobs; average rating on the home page.
7. ✅ **Offers and coupons** (for example "10% off labour on first service").
8. ✅ **Contact:** address, map and directions, hours with a live "Open now / Closed" label, emergency number, sticky Call / WhatsApp / Book bar on phones.
9. ✅ **FAQ:** payment methods at the garage, warranty, pickup and drop, how long jobs take.
10. ✅ **Click-to-WhatsApp** with a ready-made message.

### B. Customer account, booking and tracking
11. ✅ **Login with mobile number + OTP** (+91), no passwords; 18+ and consent checkboxes.
12. ✅ **My vehicles** with registration-number check (`MH12AB1234`, BH series), PUC and insurance dates.
13. ✅ **Book a service:** vehicle → services or package → **time slot from real availability** → **pickup and drop** (by pincode, with fee) → confirm, with a booking code.
14. ✅ **Free estimate request** with photo upload.
15. ✅ **Live job tracking:** timeline (Booked → Vehicle received → Inspection → Awaiting approval → In service → Ready → Completed), with **mechanic photos and notes**.
16. ✅ **Online estimate approval:** itemised parts and labour (₹); the customer approves or rejects **each line**. Lines lock once sent; every decision is recorded.
17. ✅ **Notifications** at each step (SMS, WhatsApp, email).
18. ✅ **Reminders:** service due, PUC expiry, insurance renewal (with opt-out).
19. ✅ **Service history** per vehicle; cancel or reschedule before the cutoff.
20. 🔜 Online payments (UPI, cards), GST invoices, referrals.

### C. Admin dashboard (owner, manager, mechanic)
21. ✅ **Bookings board** by date and status; phone and walk-in bookings; confirm, cancel, reschedule, assign a mechanic.
22. ✅ **Schedule:** hours, slot rules and capacity, holidays, pickup pincodes and fees.
23. ✅ **Mechanic job view on a phone:** update status, notes and photos; the customer is notified automatically.
24. ✅ **Estimate builder:** part and labour lines, versions, send; staff can record approvals given by phone.
25. ✅ **Customers and vehicles** (a simple CRM); **team and roles** (owner only).
26. ✅ **Content:** edit services, prices, packages, vehicle catalogue, offers, FAQ and garage info without code.
27. ✅ **Reviews:** reply or hide. **Reports:** bookings, approved estimate value, top services, rating, mechanic workload (CSV export).
28. 🔜 Revenue and GST reports, spare-parts inventory.

### D. Built in everywhere
29. ✅ **Mobile-first, fast on 4G**; staff can add the admin to their phone's home screen.
30. ✅ **Local SEO:** metadata per page, canonical URLs, social preview image, `sitemap.ts`, `robots.ts`, `AutoRepair` JSON-LD.
31. ✅ **Automatic SEO review** after every change to pages (details below).
32. ✅ **Ready for Hindi:** all text in `messages/en.json` and translatable database fields; English only at launch.
33. ✅ **Privacy (DPDP Act 2023 and 2025 Rules):** consent history, privacy notice, delete-my-data, data export.
34. ✅ **Security:** customers see only their own data; mechanics only their assigned jobs. Tested.
35. ✅ **Accessibility:** keyboard use, contrast, reduced motion; automated axe checks.
36. 🔜 PWA for customers, roadside-assistance dispatch, more branches.

## Automatic SEO review (task 08)

1. **`.claude/agents/seo-reviewer.md`:** a read-only subagent (Read, Glob, Grep, plus Bash for read-only commands and building or fetching a page). For each changed page it reports **Pass / Needs work** with concrete fixes:
   - **Metadata:** unique title (about 50–60 characters, template `%s | GoMechanic`), description (about 120–160), canonical, Open Graph and Twitter tags.
   - **Structure:** one `<h1>`, heading order, `alt` text, link text, semantic HTML.
   - **JSON-LD:** `AutoRepair`, `Service`, `FAQPage`, `BreadcrumbList`.
   - **Crawling:** public pages are in the sitemap (noindex pages left out); `/account`, `/admin`, `/dev` and `/login` are `noindex` but **not** blocked in `robots.ts` (Google must crawl a page to see its `noindex`); no broken links.
   - **Core Web Vitals:** `next/image` with `sizes`, the hero image loaded early with `loading="eager"` / `fetchPriority="high"` (Next.js 16 deprecated `priority`), `next/font`, no layout shift, GSAP doesn't delay the main content.
   - **India local SEO:** name, address and phone match `garage_settings`; city and area in titles; `hreflang` once Hindi exists.
   - It reads `node_modules/next/dist/docs/` (metadata, JSON-LD guides) before judging.
2. **`.claude/hooks/seo_check.py`**, run by a **Stop hook** in `.claude/settings.json` (merged with the existing plugin settings; load the `update-config` skill first):
   - It fingerprints `src/app/`, `src/components/`, `src/i18n/`, `messages/` and `public/` against `.claude/.seo-reviewed.json` (git-ignored).
   - If anything changed, it returns `{"decision":"block","reason":"Pages changed: <files>. Run the seo-reviewer agent on them, then share the changes and its suggestions with the owner. Don't apply suggestions unless asked."}` and saves the new fingerprints.
   - It exits quietly when nothing changed or `stop_hook_active` is true, so it can't loop.
   - Fingerprinting catches edits, scripts and committed changes.
3. **`CLAUDE.md`** gets an "SEO review" section: how to report ("SEO check" block: pages, verdicts, suggested fixes) and how to run it on demand.

## Architecture

**Design:** Apple-like, see "Design direction" in [features.md](../website/features.md); exact tokens in `design-system/go-mechanic/MASTER.md` (task 11).

**Stack:** Next.js 16.4 (App Router, Cache Components), TypeScript, Tailwind v4, shadcn/ui (Radix), GSAP, npm.

| Area | Choice |
| --- | --- |
| Database | **Drizzle ORM**. In development: PGlite (Postgres running inside Node, no account needed). Staging and production: **Supabase Postgres in Mumbai** |
| Auth | **Better Auth + phone-number OTP plugin** (users in our own database); Cloudflare Turnstile at launch |
| Translations | **next-intl** with `src/app/[locale]/…` from the start; `localePrefix: 'as-needed'`, so English URLs stay clean and Hindi becomes `/hi/...` later |
| SMS / WhatsApp / email | **MSG91** (handles DLT) / **Meta WhatsApp Cloud API** / **Resend**, each behind an interface in `src/server/providers/` with a **fake** that writes to `/dev/outbox`. `lib/env.ts` refuses to start production with fakes |
| Photos | Private Supabase Storage bucket with signed URLs (fake: local disk); resized in the browser to strip location data |
| Jobs | `after()` for instant sends; Vercel Cron for retries and daily reminders |
| Hosting | Vercel, functions pinned to Mumbai (`bom1`) |

**Code layout:**
- `src/domain/`: pure, unit-tested logic (pricing, slots, estimates, status changes, offers, validators, permissions, reminders).
- `src/server/`: `db/`, a data-access layer `dal/` where **every query checks ownership or role**, `actions/`, `auth.ts`, `providers/`, `notify/`.
- `src/components/{ui,site,account,admin}`, `messages/`.

**Data rules:** money in integer paise; UTC timestamps, garage-local date and time in `Asia/Kolkata`; booking items snapshot their prices; slot capacity is taken with one atomic conditional `UPDATE`; the notification outbox has a `dedupe_key`.

**Data model** (28 tables plus Better Auth's own tables): auth tables with `role` (customer / mechanic / manager / owner); `garage_settings`, `opening_hours`, `slot_rules`, `calendar_exceptions`, `slot_counters`, `pickup_areas`; `vehicle_categories`, `vehicle_makes`, `vehicle_models`; `services`, `package_items`, `service_prices`; `customer_vehicles`, `consents`; `bookings`, `booking_items`, `booking_events`; `media`; `estimate_requests`, `estimates`, `estimate_items`; `reviews`, `offers`, `faqs`, `content_blocks`; `notifications`, `dev_messages`, `audit_log`.

**Cache Components rules** (from `node_modules/next/dist/docs/01-app/…`):
- Public catalogue reads use `'use cache'` + `cacheTag`, and admin saves call `updateTag`.
- Session reads go inside `<Suspense>`.
- "Open now" and slots use `connection()`.
- Photos upload directly with signed URLs (Server Actions accept at most 1 MB).

## Tasks (07–46)

| # | Task | Goal | Owner decision / paid |
| --- | --- | --- | --- |
| **M0 Plan and foundations** ||||
| 07 | `07_website_plan` | Save this plan in the repo: `document/website/features.md` and tasks 07–46 in `task.md` | – |
| 08 | `08_seo_reviewer` | SEO agent + Stop hook + `CLAUDE.md` rule (above) | – |
| 09 | `09_app_setup` | Delete leftover `node_modules/`, `.next/` etc.; scaffold `create-next-app@16.4.3` in a scratch folder (`--ts --tailwind --eslint --app --src-dir --cache-components --use-npm --agents-md --no-agent-feedback --disable-git`) and copy it in; `shadcn init` with **Radix**; GSAP; Vitest + Playwright smoke tests; `npm run check` (lint + `next typegen` + `tsc` + tests); `CLAUDE.md` stack and `@AGENTS.md` | – |
| 10 | `10_i18n_foundation` | next-intl, `[locale]`, `en.json`, ₹ and date formatters, a Cache Components compatibility test | – |
| 11 | `11_design_system` | **Apple-like** visual system (frontend-design + ui-ux-pro-max + shadcn): tokens, type scale, Inter + system font, Devanagari-ready, motion tokens, restyled shadcn controls (44 px targets), `design-system/go-mechanic/MASTER.md`, a `/dev/design` preview page (development only, not indexed) | Approve the look; name and logo |
| 12 | `12_layout_shell` | Frosted header, footer, sticky Call/WhatsApp/Book bar on phones, 404, "Open now", offer banner; garage details, hours and the offer from typed **placeholder** content files (`src/content/`). Task 14 moves garage details and hours to the database; task 38 switches the offer banner to real offers | Real address, phone, hours |
| 13 | `13_home_page` | Apple-style home: hero, scroll storytelling (pinned section), bento grid of services, counting stats, reviews preview, final call to action; GSAP + ScrollTrigger with a reduced-motion fallback. Services, stats and reviews use labelled **placeholder** content until tasks 18 (services) and 37 (reviews and rating) switch them to real data. Sample reviews are marked as samples and never shown as real | Photos (placeholders until real ones) |
| **M1 Data and accounts** ||||
| 14 | `14_database_setup` | Drizzle, PGlite / postgres.js, migrations, garage settings and hours (moved here from the placeholder content file), seed data, `env.ts`, `clock.ts` | – |
| 15 | `15_auth_otp_login` | Better Auth phone OTP, provider pattern, fake SMS + `/dev/outbox`, `/login`, consent | – |
| 16 | `16_roles_access` | Roles, `can()` matrix with tests, `requireUser/Staff/Role`, proxy redirects, owner bootstrap | Owner's phone number |
| **M1b Public site** ||||
| 17 | `17_vehicle_catalogue` | Categories, makes and models + seed; vehicle picker | Brands served |
| 18 | `18_services_pricing` | Services, packages and prices; `priceFor()` tests; `/services`, `/services/[slug]`, `/packages` | Price list |
| 19 | `19_info_pages` | Contact (map, hours), about, FAQ, draft privacy and terms | – |
| 20 | `20_staging_deploy` | Supabase (Mumbai) + Vercel staging, fakes behind password protection | Free accounts |
| **M2 Customer and booking** ||||
| 21 | `21_customer_vehicles` | Registration validator + tests, vehicles, profile | **Start the DLT and Meta paperwork** |
| 22 | `22_slot_engine` | Slot rules, holidays, counters; `availableSlots()` tests; atomic reserve | Slot length, capacity |
| 23 | `23_booking_flow` | `/book` wizard with inline OTP, prices worked out on the server; Playwright e2e test | – |
| 24 | `24_pickup_drop` | Pickup areas, 6-digit pincode, fee | Pincodes, fee |
| 25 | `25_my_bookings` | List, detail, cancel or reschedule before the cutoff | Cancellation policy |
| **M3 Admin** ||||
| 26 | `26_admin_bookings_board` | Navigation per role, board, phone and walk-in bookings, add to home screen | – |
| 27 | `27_booking_management` | Confirm, cancel, reschedule, assign; `canTransition()` tests | – |
| 28 | `28_schedule_settings` | Edit slot rules, holidays, pickup areas, hours | – |
| 29 | `29_team_customers` | Team and roles, customer search, `audit_log` | – |
| **M4 Tracking and estimates** ||||
| 30 | `30_photo_uploads` | Storage provider (fake + Supabase), signed URLs, browser resize, access tests | – |
| 31 | `31_job_timeline` | Mechanic job updates; customer timeline | – |
| 32 | `32_estimate_requests` | `/estimate` with photos, account view, admin inbox | – |
| 33 | `33_estimate_builder` | Lines, versions, send (booking moves to awaiting approval) | – |
| 34 | `34_estimate_approval` | Approve or reject each line, lock, phone approvals; tests + e2e | What happens when a required line is rejected |
| **M5 Notifications** ||||
| 35 | `35_notification_outbox` | Outbox, fakes, `notify()` respecting consent, retries, `/admin/messages` | Events and wording |
| 36 | `36_service_reminders` | Daily cron: service due, PUC, insurance; dedupe, opt-out | Intervals |
| **M6 Reviews, offers, content** ||||
| 37 | `37_reviews` | Eligibility, write, `/reviews`, admin reply or hide | – |
| 38 | `38_offers_coupons` | Offers, banner, coupon at booking; `applyOffer()` tests | Offer rules |
| 39 | `39_catalogue_admin` | Edit services, prices, packages, makes, models | – |
| 40 | `40_content_admin` | FAQ, content blocks, garage info | – |
| 41 | `41_admin_reports` | Bookings, approved value, top services, rating, workload; CSV | – |
| **M7 SEO and privacy** ||||
| 42 | `42_local_seo` | Metadata, canonical URLs, OG image, sitemap, robots, AutoRepair JSON-LD | **Domain**; Google Business Profile |
| 43 | `43_privacy_dpdp` | Privacy notice, consent withdrawal, delete-my-data, export; tests | Grievance officer |
| **M8 Launch (paid)** ||||
| 44 | `44_real_sms_otp` | MSG91 adapter, Turnstile, rate limits | **DLT, MSG91 credits** |
| 45 | `45_real_whatsapp_email` | WhatsApp Cloud API + webhook, Resend | **Meta billing, domain DNS** |
| 46 | `46_production_launch` | Vercel Pro and Supabase Pro, domain, cron, security headers, monitoring, backups, final audit | **Paid plans** |

**Main risks:**
- **OTP abuse and SMS bills:** Turnstile, +91 only, rate limits.
- **Double booking:** atomic slot update, tested in parallel on staging.
- **Money and time bugs:** paise, IST, injected clock.
- **Users reaching others' data** by changing IDs in URLs: data-access layer checks plus tests.
- **DLT and Meta approvals take weeks:** start at task 21; WhatsApp OTP as fallback.
- **Next.js 16 caching mistakes:** follow the rules above.
- **Library compatibility:** spike next-intl in 10 and Better Auth in 15, and pin versions.

## Verification

- **Every task:** `npm run check` (lint, `next typegen`, `tsc`, Vitest), then open the changed pages; `ce-code-review` + `code-reviewer` before merge; SEO hook report on page changes.
- **Unit tests** (`src/domain`): `priceFor`, `availableSlots`, `canTransition`, estimate decisions and totals, `applyOffer`, validators (registration, BH series, `^[6-9]\d{9}$` mobile, pincode), `isOpenAt`, `dueReminders`, the `can()` matrix.
- **Integration tests** (Vitest + in-memory PGlite): slot reserve and release, `createBooking` snapshots, review eligibility, data deletion, and data-access checks (customer A can't read customer B; a mechanic only sees assigned jobs).
- **End-to-end tests** (Playwright with fakes and a fixed clock): guest booking → OTP → account; staff update → customer timeline; estimate approved and rejected line by line; a customer is blocked from `/admin`. Run at 375 px and desktop, with axe accessibility checks.
- **SEO hook (task 08):**
  - Run `seo_check.py` with sample hook JSON: no changes → exits quietly; touch a file under `src/app/` → prints the block decision and the file; run again → quiet; `stop_hook_active: true` → quiet.
  - Then open a new session, make a small page change, and confirm Claude runs `seo-reviewer` and shares a report.
