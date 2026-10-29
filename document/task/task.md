# Task tracker

Every piece of work in this repo is a small, numbered task. This file is the one list of all of them.

- **Task name = branch name = learning-doc file name.** Task `01_project_setup` lives on branch `01_project_setup` and is explained in `document/learning/01_project_setup.md`.
- **Status** is one of: `To do`, `In progress`, `Done`.
- **Small** means one focused change you could review in about 15 minutes. If a task grows past that, split it.

## Tasks

| # | Task (= branch) | Goal | Status | Learning doc |
| --- | --- | --- | --- | --- |
| 01 | `01_project_setup` | Repo foundation: readme, `.gitignore`, this tracker, learning-doc template | Done | [01_project_setup.md](../learning/01_project_setup.md) |
| 02 | `02_claude_guidelines` | `CLAUDE.md`: the rules Claude follows in this repo | Done | [02_claude_guidelines.md](../learning/02_claude_guidelines.md) |
| 03 | `03_skills_installation` | Install Claude skills (GSAP, shadcn/ui, frontend-design, UI/UX Pro Max, 21st.dev) and write the skills doc | Done | [03_skills_installation.md](../learning/03_skills_installation.md) |
| 04 | `04_agents` | Subagents for planning, learning docs, UI work and review | Done | [04_agents.md](../learning/04_agents.md) |
| 05 | `05_learning_folder` | Move learning docs to `document/learning/NN_name.md` | Done | [05_learning_folder.md](../learning/05_learning_folder.md) |
| 06 | `06_compound_engineering` | Install the Compound Engineering plugin and fit its plan, work, review, compound loop into our workflow | Done | [06_compound_engineering.md](../learning/06_compound_engineering.md) |
| 07 | `07_website_plan` | Save the approved website plan: features doc, master plan, tasks 07–46 | Done | [07_website_plan.md](../learning/07_website_plan.md) |
| 08 | `08_seo_reviewer` | SEO reviewer agent + Stop hook that runs it after every page change | Done | [08_seo_reviewer.md](../learning/08_seo_reviewer.md) |
| 09 | `09_app_setup` | Next.js 16 app, shadcn/ui (Radix), GSAP, Vitest + Playwright, `npm run check` | Done | [09_app_setup.md](../learning/09_app_setup.md) |
| 10 | `10_i18n_foundation` | next-intl with `[locale]` routes (English now, Hindi-ready), ₹ and date formatting | Done | [10_i18n_foundation.md](../learning/10_i18n_foundation.md) |
| 11 | `11_design_system` | Apple-like design system: tokens, type, motion, restyled controls, `/dev/design` preview | Done | [11_design_system.md](../learning/11_design_system.md) |
| 12 | `12_layout_shell` | Frosted header, footer, sticky mobile action bar, 404, open-now, offer banner | Done | [12_layout_shell.md](../learning/12_layout_shell.md) |
| 13 | `13_home_page` | Apple-style home page with GSAP scroll storytelling | Done | [13_home_page.md](../learning/13_home_page.md) |
| 14 | `14_database_setup` | Drizzle + PGlite/Postgres, migrations, seed, env and clock helpers | Done | [14_database_setup.md](../learning/14_database_setup.md) |
| 15 | `15_auth_otp_login` | Mobile OTP login (Better Auth) with a fake SMS sender and `/dev/outbox` | Done | [15_auth_otp_login.md](../learning/15_auth_otp_login.md) |
| 16 | `16_roles_access` | Roles (customer, mechanic, manager, owner), `can()` matrix, protected areas | In progress | [16_roles_access.md](../learning/16_roles_access.md) |
| 17 | `17_vehicle_catalogue` | Vehicle types, brands, models; vehicle picker | To do |  |
| 18 | `18_services_pricing` | Services, packages, prices by vehicle; `/services`, `/packages` | To do |  |
| 19 | `19_info_pages` | Contact, about, FAQ, privacy and terms pages | To do |  |
| 20 | `20_staging_deploy` | Staging on Vercel + Supabase (Mumbai) with fake providers | To do |  |
| 21 | `21_customer_vehicles` | Customer vehicles with registration-number checks, profile | To do |  |
| 22 | `22_slot_engine` | Time slots, capacity, holidays; atomic slot reservation | In progress | [22_slot_engine.md](../learning/22_slot_engine.md) |
| 23 | `23_booking_flow` | `/book` wizard with OTP, server-side prices, e2e test | To do |  |
| 24 | `24_pickup_drop` | Pickup and drop by pincode, with fee | To do |  |
| 25 | `25_my_bookings` | Customer bookings list and detail, cancel or reschedule | To do |  |
| 26 | `26_admin_bookings_board` | Admin navigation by role, bookings board, phone and walk-in bookings | To do |  |
| 27 | `27_booking_management` | Confirm, cancel, reschedule, assign mechanic; status rules | To do |  |
| 28 | `28_schedule_settings` | Edit hours, slot rules, holidays, pickup areas | To do |  |
| 29 | `29_team_customers` | Team and roles, customer list, audit log | To do |  |
| 30 | `30_photo_uploads` | Photo storage with signed URLs, resizing, access checks | To do |  |
| 31 | `31_job_timeline` | Mechanic job updates; customer tracking timeline | To do |  |
| 32 | `32_estimate_requests` | Free estimate requests with photos; admin inbox | To do |  |
| 33 | `33_estimate_builder` | Estimate lines, versions, send for approval | To do |  |
| 34 | `34_estimate_approval` | Customer approves or rejects each estimate line | To do |  |
| 35 | `35_notification_outbox` | Notification outbox (SMS, WhatsApp, email fakes), retries, consent | To do |  |
| 36 | `36_service_reminders` | Daily reminders: service due, PUC, insurance | To do |  |
| 37 | `37_reviews` | Customer reviews, `/reviews`, admin reply or hide | To do |  |
| 38 | `38_offers_coupons` | Offers, banner, coupons at booking | To do |  |
| 39 | `39_catalogue_admin` | Admin editing of services, prices, packages, vehicles | To do |  |
| 40 | `40_content_admin` | Admin editing of FAQ, content blocks and garage info | To do |  |
| 41 | `41_admin_reports` | Reports and CSV export | To do |  |
| 42 | `42_local_seo` | Metadata, sitemap, robots, social image, AutoRepair structured data | To do |  |
| 43 | `43_privacy_dpdp` | Privacy notice, consent withdrawal, delete-my-data, export | To do |  |
| 44 | `44_real_sms_otp` | Real SMS OTP (MSG91 + DLT), bot protection, rate limits (paid) | To do |  |
| 45 | `45_real_whatsapp_email` | Real WhatsApp Cloud API and email (paid) | To do |  |
| 46 | `46_production_launch` | Production plans, domain, monitoring, backups, final audit (paid) | To do |  |

## Task steps

Each task is broken into small steps. Tick them off as you go.

### 01_project_setup

- [x] Make the first commit on `main` (a branch can't exist until there is a commit)
- [x] Create branch `01_project_setup`
- [x] Write `readme.md`
- [x] Add `.gitignore`
- [x] Create this tracker
- [x] Create `TEMPLATE.md` for learning docs
- [x] Write the learning doc
- [x] Merge into `main`

### 02_claude_guidelines

- [x] Create branch `02_claude_guidelines`
- [x] Fix the wrong `git check-ignore` example in the 01 learning doc (found after 01 was merged)
- [x] Write `CLAUDE.md` (project facts, task workflow, git rules, learning-doc rules, definition of done)
- [x] Link it from `readme.md`
- [x] Write the learning doc
- [x] Merge into `main`

### 03_skills_installation

- [x] Create branch `03_skills_installation`
- [x] Review each skill's files before installing
- [x] Install the skills into `.claude/skills/` (one commit per source)
- [x] Check the installed files match the reviewed ones
- [x] Check the UI/UX Pro Max search script runs
- [x] Write `document/skills/skills.md`
- [x] Add the skills section to `CLAUDE.md` and `readme.md`
- [x] Write the learning doc
- [x] Merge into `main`

### 04_agents

- [x] Create branch `04_agents`
- [x] Write the subagents in `.claude/agents/`
- [x] Check Claude Code loads all four agents
- [x] Add the agents section to `CLAUDE.md` and `readme.md`
- [x] Write the learning doc
- [x] Review with `code-reviewer` and fix what it found
- [x] Merge into `main`

### 05_learning_folder

- [x] Create branch `05_learning_folder`
- [x] Move each learning doc to `document/learning/NN_name.md` with `git mv` (history kept)
- [x] Move `TEMPLATE.md` to `document/learning/`
- [x] Update every link and path (readme, `CLAUDE.md`, this tracker, agents, skills doc)
- [x] Add a "moved" note to the older learning docs
- [x] Write the learning doc
- [x] Review with `code-reviewer` and fix what it finds
- [x] Merge into `main`

### 06_compound_engineering

- [x] Create branch `06_compound_engineering`
- [x] Review the plugin's files before installing (hooks, scripts, MCP servers, instructions)
- [x] Install it for this project so it's shared through git (pinned to v3.32.0)
- [x] Check the installed copy matches the reviewed code
- [x] Configure it: artifacts in `document/`, no other AI vendors, no automatic PR watching
- [x] Decide which steps use the plugin's commands and which use our agents; update `CLAUDE.md` and the agents
- [x] Run `ce-compound` once for real: first lesson in `document/solutions/`
- [x] Update `document/skills/skills.md` and `readme.md`
- [x] Write the learning doc
- [x] Review with `code-reviewer` and fix what it finds
- [x] Compound: decide whether the review taught a lesson worth saving (no new doc: the lesson went straight into `CLAUDE.md`)
- [x] Merge into `main`

No `ce-plan` plan for this task: the vetting and install (what a plan would cover) happened before the plugin was available here. From task 07 on, bigger tasks need a plan in `document/plans/`.

### 07_website_plan

- [x] Create branch `07_website_plan`
- [x] Save the feature list in `document/website/features.md`
- [x] Save the approved plan in [document/plans/2026-10-24-gomechanic-master-plan.md](../plans/2026-10-24-gomechanic-master-plan.md) (tasks 12–16 reordered for the Apple-like look)
- [x] Add tasks 07–46 to this tracker; replace the old backlog
- [x] Update `CLAUDE.md` and `readme.md` (project and stack decided)
- [x] Write the learning doc
- [x] Review with `code-reviewer` and fix what it finds
- [x] Compound: save a lesson in `document/solutions/` if one passes the counterfactual question
- [x] Merge into `main`

The master plan is this task's plan. It was made in Claude's plan mode with the owner, not with `ce-plan`.

### 08_seo_reviewer

- [x] Create branch `08_seo_reviewer`
- [x] Plan with `ce-plan`: [plan](../plans/2026-10-24-2339-chore-seo-reviewer-hook-plan.md)
- [x] Write `.claude/agents/seo-reviewer.md`
- [x] Write `.claude/hooks/seo_check.py` (fingerprints page files) and test it with sample input
- [x] Add the Stop hook to `.claude/settings.json` (merge with plugin settings)
- [x] Add the SEO review rule to `CLAUDE.md`
- [x] Write the learning doc
- [x] Review with `code-reviewer` and fix what it finds
- [x] Compound: save a lesson in `document/solutions/` if one passes the counterfactual question
- [x] Merge into `main`

### 09_app_setup

- [x] Create branch `09_app_setup`
- [x] Plan with `ce-plan`: [plan](../plans/2026-10-25-1300-chore-app-setup-plan.md)
- [x] Remove leftover ignored build folders; scaffold Next.js 16.4.3 in a scratch folder and copy it in
- [x] `shadcn init` (Radix); install GSAP
- [x] Vitest + Playwright smoke tests; `npm run check`
- [x] Update `CLAUDE.md` (stack, commands, `@AGENTS.md`) and `readme.md`
- [x] Write the learning doc
- [x] Review with `code-reviewer` and fix what it finds
- [x] Compound: save a lesson in `document/solutions/` if one passes the counterfactual question
- [x] Merge into `main`

### 10_i18n_foundation

- [x] Create branch `10_i18n_foundation`
- [x] Plan with `ce-plan`: [plan](../plans/2026-10-25-1448-feat-i18n-foundation-plan.md)
- [x] next-intl with `src/app/[locale]/` and `localePrefix: 'as-needed'`
- [x] `messages/en.json`; ₹, date and time formatters (`en-IN`, `Asia/Kolkata`)
- [x] Check it works with Cache Components
- [x] Write the learning doc
- [x] Review with `code-reviewer` and fix what it finds
- [x] Compound: save a lesson in `document/solutions/` if one passes the counterfactual question: [lint guards lesson](../solutions/conventions/lint-guards-test-real-jsx-shapes.md)
- [x] Merge into `main`: PR #3 and PR #4 on GitHub

### 11_design_system

- [x] Create branch `11_design_system`
- [x] Plan with `ce-plan`: [plan](../plans/2026-10-26-1312-feat-design-system-plan.md)
- [x] Design direction with frontend-design + ui-ux-pro-max (Apple-like)
- [x] Tokens in `globals.css`: colors, type scale, radius, shadows, motion
- [x] Fonts: Inter + system San Francisco, plus a Devanagari font with `next/font` for Hindi (SEO check in task 09: Geist has no Hindi letters)
- [x] Restyle shadcn controls (44 px touch targets, pill buttons)
- [x] `design-system/go-mechanic/MASTER.md` and a `/dev/design` preview page (development only). The owner approved the look on 2026-10-26, with no changes
- [x] Write the learning doc
- [x] Review with `code-reviewer` and fix what it finds
- [x] Compound: save a lesson in `document/solutions/` if one passes the counterfactual question: [ce-plan hang lesson](../solutions/workflow-issues/ce-plan-child-session-hangs-use-idle-watcher.md)
- [x] Merge into `main`: PR #5 on GitHub

### 12_layout_shell

- [x] Create branch `12_layout_shell`
- [x] Plan with `ce-plan`: [plan](../plans/2026-10-26-1937-feat-layout-shell-plan.md)
- [x] Garage details, hours and offer in typed content files (`src/content/garage.ts`, `src/content/offer.ts`) with the owner's real details, given 2026-10-26: phone and WhatsApp +91 97647 50567; "Mukai Chowk, Kiwale, Pune, Maharashtra 412101"; open 10:00–19:00 India time every day except Monday (closed); no current offer; no email. Task 14 moves the garage to the database, task 38 the offer
- [x] Frosted sticky header with navigation and mobile menu: the header uses the `frosted` class; the mobile menu is `Sheet` with `closeLabel={t("close")}` (task 11)
- [x] Footer, sticky Call/WhatsApp/Book bar on phones, custom 404 page built on `src/app/global-not-found.tsx` (task 10 made it the 404 for unknown URLs, with one `<title>`; give it the header, footer and design). SEO check in task 10: add the brand to its title (it doesn't get the layout's title template), and decide whether to narrow the `src/proxy.ts` matcher so dotted URLs like `/index.html` reach this page instead of a blank error page. Trade-off (`ce-code-review` in task 10): with a hand-made list of file extensions, any public file type missing from the list returns 404. Decided: narrowed; `src/proxy.test.ts` fails if a real file would go through the proxy
- [x] Pass `NextIntlClientProvider` only the message namespaces client components use (SEO check in task 10: today every page ships all of `messages/en.json`)
- [x] Open-now badge and offer banner: open-now uses `Badge variant="success"` (task 11)
- [x] Add `src/app/[locale]/not-found.tsx`, sharing its content with `global-not-found.tsx`. Pages that call `notFound()` (`/dev/design` in production, later unknown service slugs) get a bare, unbranded page today (SEO check in task 11)
- [x] Shell samples on `/dev/design` and screenshots (`npm run test:design`). The owner approved the look (header, menu, footer, phone bar, 404) as built on 2026-10-27, from screenshots. Owner decisions the same day: keep the three-button phone bar, Call, WhatsApp and Book (Book opens WhatsApp with a booking message until task 23); keep the draft WhatsApp messages ("Hi, I have a question about my vehicle." and "Hi, I'd like to book a service for my vehicle."); the garage closes on some festival days, entered in task 28
- [x] End-to-end tests on a production build (`e2e/layout-shell.spec.ts`)
- [x] Docs: `CLAUDE.md`, `MASTER.md` ("Site shell"), the master plan's Cache Components rules, and the notes from the plan's "Deferred to Follow-Up Work" on the later tasks below (`features.md` needed no change)
- [x] Write the learning doc
- [x] Review with `code-reviewer` and fix what it finds
- [x] Compound: save a lesson in `document/solutions/` if one passes the counterfactual question: [catch only expected Next.js errors](../solutions/conventions/nextjs-16-catch-only-expected-request-api-errors.md)
- [x] Merge into `main`: PRs #6, #7 and #8 on GitHub

### 13_home_page

- [x] Create branch `13_home_page`
- [x] Plan with `ce-plan`: [plan](../plans/2026-10-27-1344-feat-home-page-plan.md)
- [x] Owner's decisions, 2026-10-27:
  - trust stats and sample reviews show only under `npm run dev`, marked "Sample", until they're real (the owner's numbers; task 37's reviews). A production build has no stats or reviews section, and none of their text in its HTML, page data or JavaScript;
  - the services grid shows the usual eleven services (features.md, item 4), for cars and two-wheelers, with no prices and no links; AC is for cars only;
  - neutral line-art visuals, no stock photos;
  - no stand-in "facts" row in production: the live page is hero, story, services and call to action until real stats exist;
  - the frosted header stays as it is over the black story band;
  - the rating's one source (the owner's Google rating or the site's own average) stays task 37's decision
- [x] Home content, the sample gate (`showSamples()`) and `formatNumber`: `src/content/home.ts`, `src/content/services.ts`, `src/lib/samples.ts`
- [x] The scroll scene: `ScrollScene` loads its GSAP effects lazily, after load, only for visitors who allow motion; timings from `@/lib/motion`, every animation inside `gsap.matchMedia()` with `motionAllowed` and `motionReduced` (task 11); a sticky story instead of ScrollTrigger's `pin`
- [x] Hero, how it works, services bento grid, trust stats and reviews preview (samples, `npm run dev` only), final call to action; shared blocks in `src/components/site/` (visual slot, illustration, service, stat and review tiles, sample badge)
- [x] On phones, sticky and scroll-triggered parts start below the header (`--header-height`) and end above the phone bar (`--stage-height`, reveals start clear of the bar) (task 12)
- [x] The `h1` says where the garage is: "Car and bike service in Kiwale, Pune" (SEO check in task 12)
- [x] Checked at 375, 768, 1024 and 1440 px, with motion and with reduced motion: page-block samples on `/dev/design` and `e2e/dev/home-preview.spec.ts` (`npm run test:design`)
- [x] End-to-end tests on a production build (`e2e/home.spec.ts`), including the no-samples scan of the HTML, page data and every script
- [x] The owner approved the look and the draft copy as built on 2026-10-27, from `next dev` and production screenshots
- [x] Docs: `MASTER.md` ("Page blocks and scroll motion"), `features.md` (Home), and the plan's "Deferred to Follow-Up Work" on tasks 17, 18, 37 and 42 and in the backlog
- [x] Docs: `CLAUDE.md` (repo map and conventions for the home page)
- [x] Write the learning doc
- [x] Review with `code-reviewer` and fix what it finds
- [x] Compound: save a lesson in `document/solutions/` if one passes the counterfactual question: [test lazy islands with the App Router dynamic](../solutions/conventions/nextjs-16-test-lazy-islands-with-app-router-dynamic.md)
- [x] Merge into `main`: PRs #9, #10, #11 and #12 on GitHub

### 14_database_setup

- [x] Create branch `14_database_setup`
- [x] Plan with `ce-plan`: [plan](../plans/2026-10-27-2221-feat-database-setup-plan.md)
- [x] Packages and tooling: Drizzle ORM, PGlite, postgres.js and drizzle-kit pinned exactly (no install script approved), the `db:generate` and `db:reset` scripts, `drizzle.config.ts`, `.env.example`, and in `next.config.ts` `serverExternalPackages` and `outputFileTracingExcludes` for PGlite
- [x] Checked server settings (`src/server/env.ts`: `APP_ENV`, `DATABASE_URL`) and an injectable clock (`src/lib/clock.ts`)
- [x] The `Garage` type and `checkGarage` in `src/domain/garage.ts`: any Indian number for calls, a mobile for WhatsApp, a 6-digit PIN, an English address, valid hours
- [x] Schema (`garage_settings`, `opening_hours`), the first migration, the owner's details as a typed seed (`src/server/db/seed-data.ts`) and `getDatabase()`: PGlite in `.pglite/` under `npm run dev`, in memory for builds and tests, postgres.js when `DATABASE_URL` is set; sessions in UTC. A spike first proved PGlite works under `next dev` and `next build`
- [x] Move garage details and hours from `src/content/garage.ts` into the database. `readGarage()` moved from `site-chrome.tsx` to the data-access layer (`src/server/dal/garage.ts`); `SiteChrome` gets the garage as a prop from the `(site)` layout and `global-not-found.tsx`, and the home page, `[locale]/not-found.tsx` and `/dev/design` read it too. `src/content/garage.ts` is gone
- [x] Read the garage with `'use cache'`, `cacheTag("garage")` and `cacheLife("max")`, so `/` stays prebuilt (`○ /en`). `saveGarage()` checks with `checkGarage` (which uses `isIndianPhoneNumber` and `isIndianMobileNumber`: the shell's formatters never throw, task 12), saves in one transaction and calls `updateTag("garage")`. Nothing calls it until tasks 28 and 40, after task 16's role check
- [x] Browser-boundary check on a production build: no database code in `.next/static/` (`e2e/server-boundary.spec.ts`)
- [x] Docs: `CLAUDE.md` (stack, repo map, commands, "Database" conventions), `readme.md`, `MASTER.md`, the `seo-reviewer` agent, and the plan's "Deferred to Follow-Up Work" on tasks 15, 16, 18, 20, 22, 23, 28, 40 and 41
- [x] Write the learning doc
- [x] Review with `code-reviewer` and fix what it finds
- [x] Compound: save a lesson in `document/solutions/` if one passes the counterfactual question: [lesson](../solutions/conventions/nextjs-16-dev-server-is-not-one-process-use-cache-probe.md)
- [x] Merge into `main` (PR #13)

### 15_auth_otp_login

- [x] Create branch `15_auth_otp_login`
- [x] Plan with `ce-plan`: [plan](../plans/2026-10-28-1155-feat-otp-login-plan.md)
- [x] Mobile OTP login (Better Auth 1.7.14, pinned) with a fake SMS sender and `/dev/outbox`: `/login`, a minimal `/account` with Log out, consent records (18+ and contact, `LOGIN_NOTICE_VERSION`), our own send limits under an advisory lock, and no number, code or token in any log
- [x] No login or account entry in the header yet (the owner's choice, 2026-10-28: task 21 adds it, as a static link or a browser island, never a cookie read in the shell). The phone bar's behaviour while a field has focus doesn't come up: `/login` has no shell and `/account` has no fields (task 23 decides it)
- [x] `/dev/outbox` is a page under `src/app/[locale]/dev/` that calls `devOnly()` in the page and `generateMetadata` (`dev-only.test.ts` checks every dev page). No Route Handler was needed
- [x] Better Auth's tables go into the same schema and migrations (`src/server/db/schema.ts`, migration `0001_auth_login`), written by hand with Better Auth's field names and snake_case columns. Its Drizzle adapter gets the database from `getDatabase()` (task 14)
- [x] Write the learning doc
- [x] Review with `code-reviewer` and fix what it finds (after `ce-code-review`: "Ready with fixes", 8 findings fixed)
- [x] Compound: save a lesson in `document/solutions/` if one passes the counterfactual question: [Better Auth from Server Actions](../solutions/conventions/better-auth-phone-login-only-from-server-actions.md), [Playwright networkidle](../solutions/conventions/playwright-networkidle-hangs-after-second-page-load.md)
- [x] Merge into `main`: PRs #14, #15 and #16 on GitHub (#14 and #15 merged before the final review; #16 is the follow-up)

### 16_roles_access

- [x] Create branch `16_roles_access`
- [x] Plan with `ce-plan`: [plan](../plans/2026-10-28-1836-feat-roles-access-plan.md)
- [x] Roles (customer, mechanic, manager, owner), `can()` matrix, protected areas: one permission table (`src/domain/permissions.ts`), `requireUser`, `requirePermission` and `authorize` (`src/server/auth/access.ts`)
- [x] `saveGarage` (`src/server/dal/garage.ts`) first checks that the signed-in user is the owner or a manager (`authorize("garage.edit")`). Every later save in `src/server/dal/` does the same for its permission (task 14)
- [x] `requireUser`/`requirePermission` built on `getCurrentUser()` (`src/server/auth/session.ts`; no `requireRole`: checks ask for a permission). Proxy redirects: a logged-out `/account` gets a real 307 to `/login`, and a logged-in `/login` goes to `/account`, by a session-cookie check, with `?session=ended` against a leftover-cookie loop (task 15)
- [x] A way to make the owner's number `owner`: the `OWNER_PHONE_NUMBER` setting (the garage's own number, the owner's choice on 2026-10-28), applied on every session read (`effectiveRole`) and stored at each login (`syncOwnerRole`). Everyone else signs up as `customer`, and Better Auth refuses a role sent by the browser (task 15)
- [x] Write the learning doc
- [ ] Review with `code-reviewer` and fix what it finds
- [ ] Compound: save a lesson in `document/solutions/` if one passes the counterfactual question
- [ ] Merge into `main`

### 17_vehicle_catalogue

- [ ] Create branch `17_vehicle_catalogue`
- [ ] Plan with `ce-plan`
- [ ] Vehicle types, brands, models; vehicle picker
- [ ] If the owner names the brands the garage serves, consider a brands row on the home page (task 13)
- [ ] Write the learning doc
- [ ] Review with `code-reviewer` and fix what it finds
- [ ] Compound: save a lesson in `document/solutions/` if one passes the counterfactual question
- [ ] Merge into `main`

### 18_services_pricing

- [ ] Create branch `18_services_pricing`
- [ ] Plan with `ce-plan`
- [ ] Services, packages, prices by vehicle; `/services`, `/packages`
- [ ] Services move to the database the way the garage did in task 14: a typed seed made from `src/content/services.ts` (like `src/server/db/seed-data.ts`), a cached read in `src/server/dal/` with its own tag, and `src/content/services.ts` deleted (task 14)
- [ ] Switch the home page services grid from `src/content/services.ts` to database services. The table mirrors its fields (id, `LocalizedText` name and summary, vehicle kinds); `ServiceTile` gives an id it has no icon for a wrench (task 13)
- [ ] Each home page service tile links to its `/services/[slug]` page (the ids are the slugs), and the hero gets "See prices" and the grid an "All services" link, each only once its page is live (`isLivePage`) (task 13)
- [ ] An e2e test that goes from the home page to a service page and back: no console errors, and nothing left hidden (the scroll scene's reveals set themselves up again) (task 13)
- [ ] Set `live: true` for `services` and `prices` in `src/components/site/navigation.ts` in the same commit as the pages (`navigation.test.ts` checks the flags) (task 12)
- [ ] `aria-current` on the live navigation links, inside a `<Suspense>` with a plain-links fallback (`usePathname` suspends under Cache Components), with an e2e check for the attribute and for no hydration errors (task 12)
- [ ] An unknown service slug calls `notFound()` in `generateMetadata` as well as in the page, before any `<Suspense>`, so the status is 404 and the title comes from `src/app/[locale]/not-found.tsx`. Add `src/app/[locale]/(site)/not-found.tsx` if that 404 should keep the full shell. Add an e2e status check for an unknown slug (task 12)
- [ ] A page that calls `notFound()` while it's prerendered serves Next.js's bare error HTML to clients without JavaScript; the branded 404 appears only after hydration. Check the unknown-slug 404 with `curl`, not only in a browser (task 12)
- [ ] Once the menu has real links, load the phone menu's panel only on the first tap (`next/dynamic` inside `MobileMenu`; `node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md`): today its code, about 32 KB gzipped, loads on every page, desktop too (SEO check in task 12)
- [ ] If the scroll effects change, guard every setup run: GSAP re-runs `media.add` on a breakpoint change from its own listener, so move the `try`/`catch` in `scroll-scene-effects.tsx` inside the callback, undo what was set up, and test it (code-reviewer in task 13)
- [ ] Write the learning doc
- [ ] Review with `code-reviewer` and fix what it finds
- [ ] Compound: save a lesson in `document/solutions/` if one passes the counterfactual question
- [ ] Merge into `main`

### 19_info_pages

- [ ] Create branch `19_info_pages`
- [ ] Plan with `ce-plan`
- [ ] Contact, about, FAQ, privacy and terms pages
- [ ] Set `live: true` for `about` and `contact` in `src/components/site/navigation.ts` with the pages. A directions link needs the owner's exact map link: one built from the address text lands at Mukai Chowk, not the garage (task 12)
- [ ] Link `/login`'s short notice to the new `/privacy` page, and change `LOGIN_NOTICE_VERSION` (`src/domain/consent.ts`) and the pinned wording in `consent.test.ts` in the same commit (task 15)
- [ ] Write the learning doc
- [ ] Review with `code-reviewer` and fix what it finds
- [ ] Compound: save a lesson in `document/solutions/` if one passes the counterfactual question
- [ ] Merge into `main`

### 20_staging_deploy

- [ ] Create branch `20_staging_deploy`
- [ ] Plan with `ce-plan`
- [ ] Staging on Vercel + Supabase (Mumbai) with fake providers
- [ ] Set `APP_ENV` (`staging`) and `DATABASE_URL` on Vercel: Supabase's transaction pooler (port 6543), with postgres.js's `prepare: false` (`createDatabase` in `src/server/db/index.ts`) (task 14)
- [ ] Run `drizzle-kit migrate` over the direct connection before `next build`: prerendering reads the database during the build (task 14)
- [ ] Seed the garage row on Supabase, with `db:migrate` and `db:seed` scripts that load the env through `loadEnvConfig(process.cwd(), true)` from `@next/env`. The app never migrates or seeds a real Postgres itself (task 14)
- [ ] Size postgres.js's connection pool for the build's worker processes, and check whether postgres.js needs `serverExternalPackages` (task 14)
- [ ] Rows changed in the Supabase console reach the site only after a redeploy or a revalidation (`readGarage()` uses `cacheLife("max")`): say so in the deploy notes (task 14)
- [ ] Set `BETTER_AUTH_SECRET` on Vercel (`openssl rand -base64 32`), and check that `x-vercel-forwarded-for` carries the visitor's IP there (`clientIpKey` in `src/server/auth/login.ts`) (task 15)
- [ ] Decide how staging testers read the fake SMS: `/dev/outbox` is a 404 on every production build, and codes must never be readable by the public (task 15)
- [ ] Write the learning doc
- [ ] Review with `code-reviewer` and fix what it finds
- [ ] Compound: save a lesson in `document/solutions/` if one passes the counterfactual question
- [ ] Merge into `main`

### 21_customer_vehicles

- [ ] Create branch `21_customer_vehicles`
- [ ] Plan with `ce-plan`
- [ ] Customer vehicles with registration-number checks, profile
- [ ] Ask the owner to start the DLT (SMS) and Meta (WhatsApp) paperwork: approvals take weeks
- [ ] The header's "Log in"/"Account" entry (the owner's choice: not before this task), as a static link or a browser island, never a session read in the shell (`ensureStatic` on `/`), with `prefetch={false}` (task 15)
- [ ] Ask for a name on the profile (users get an empty `name` at sign-up). Carriers reassign numbers that go unused: decide what a new SIM owner sees of the old account (task 15)
- [ ] Write the learning doc
- [ ] Review with `code-reviewer` and fix what it finds
- [ ] Compound: save a lesson in `document/solutions/` if one passes the counterfactual question
- [ ] Merge into `main`

### 22_slot_engine

- [x] Create branch `22_slot_engine`
- [x] Plan with `ce-plan`: [2026-10-28-1754-feat-slot-engine-plan.md](../plans/2026-10-28-1754-feat-slot-engine-plan.md)
- [x] Time slots, capacity, holidays; atomic slot reservation
- [x] Notes for the tasks that build on the slot engine (20, 23 to 28, 43) at the end of the backlog: this task may edit only its own steps (three sessions work in parallel)
- [x] Slot rules from the owner (2026-10-28): 1-hour slots; customers book up to 7 days ahead, from tomorrow on (no same-day slots). Capacity is a **placeholder**: 2 vehicles per slot, cars and two-wheelers together, until the owner gives the real number
- [x] The slot engine reads the hours through the data-access layer (`readSchedule` in `src/server/dal/slots.ts`, through `weeklyHours` from `garage.ts`) and the time through a `Clock` (`@/lib/clock`), so tests can fix it (task 14)
- [x] Rules for slot callers in `CLAUDE.md` ("Booking slots")
- [x] Write the learning doc: [22_slot_engine.md](../learning/22_slot_engine.md)
- [x] Review with `ce-code-review` and `code-reviewer` and fix what they find (verdicts and fixes in the learning doc)
- [x] Compound: [pglite-parallel-tests-bare-database-not-transaction-per-call.md](../solutions/conventions/pglite-parallel-tests-bare-database-not-transaction-per-call.md)
- [ ] Merge into `main`

### 23_booking_flow

- [ ] Create branch `23_booking_flow`
- [ ] Plan with `ce-plan`
- [ ] `/book` wizard with OTP, server-side prices, e2e test
- [ ] e2e tests run on a production server whose database is PGlite in memory: every run starts from the seed, and whatever a test creates is gone after a restart. Write booking tests that don't depend on an earlier run (task 14)
- [ ] Set `bookPage.live` to true in `src/components/site/navigation.ts`: "Book a service" and the phone bar's Book then go to `/book` instead of WhatsApp. Decide the phone bar on `/book`, where its Book repeats the page and can cover the wizard's own buttons (task 12)
- [ ] The inline OTP reuses the login service (`requestLoginCode`, `verifyLoginCode`), its consent snapshot and the e2e outbox file. Decide whether the phone bar hides while a form field has focus. If a different number verifies on a phone that is already logged in, end the old session (task 15)
- [ ] Write the learning doc
- [ ] Review with `code-reviewer` and fix what it finds
- [ ] Compound: save a lesson in `document/solutions/` if one passes the counterfactual question
- [ ] Merge into `main`

### 24_pickup_drop

- [ ] Create branch `24_pickup_drop`
- [ ] Plan with `ce-plan`
- [ ] Pickup and drop by pincode, with fee
- [ ] Write the learning doc
- [ ] Review with `code-reviewer` and fix what it finds
- [ ] Compound: save a lesson in `document/solutions/` if one passes the counterfactual question
- [ ] Merge into `main`

### 25_my_bookings

- [ ] Create branch `25_my_bookings`
- [ ] Plan with `ce-plan`
- [ ] Customer bookings list and detail, cancel or reschedule
- [ ] Write the learning doc
- [ ] Review with `code-reviewer` and fix what it finds
- [ ] Compound: save a lesson in `document/solutions/` if one passes the counterfactual question
- [ ] Merge into `main`

### 26_admin_bookings_board

- [ ] Create branch `26_admin_bookings_board`
- [ ] Plan with `ce-plan`
- [ ] Admin navigation by role, bookings board, phone and walk-in bookings
- [ ] Write the learning doc
- [ ] Review with `code-reviewer` and fix what it finds
- [ ] Compound: save a lesson in `document/solutions/` if one passes the counterfactual question
- [ ] Merge into `main`

### 27_booking_management

- [ ] Create branch `27_booking_management`
- [ ] Plan with `ce-plan`
- [ ] Confirm, cancel, reschedule, assign mechanic; status rules
- [ ] Write the learning doc
- [ ] Review with `code-reviewer` and fix what it finds
- [ ] Compound: save a lesson in `document/solutions/` if one passes the counterfactual question
- [ ] Merge into `main`

### 28_schedule_settings

- [ ] Create branch `28_schedule_settings`
- [ ] Plan with `ce-plan`
- [ ] Edit hours, slot rules, holidays, pickup areas
- [ ] The hours editor saves through `saveGarage` (`src/server/dal/garage.ts`) from a Server Action, after task 16's role check, and turns its problem codes into messages. Add an e2e test that the public pages show the new hours after a save (task 14)
- [ ] The garage closes on some festival days (for example Diwali, Ganeshotsav): let the owner enter those dates, and make the open-status badge (`openStatusAt` in `src/domain/opening-hours.ts`) say "Closed" on them. Until then it can say "Open now" (owner, 2026-10-27)
- [ ] Write the learning doc
- [ ] Review with `code-reviewer` and fix what it finds
- [ ] Compound: save a lesson in `document/solutions/` if one passes the counterfactual question
- [ ] Merge into `main`

### 29_team_customers

- [ ] Create branch `29_team_customers`
- [ ] Plan with `ce-plan`
- [ ] Team and roles, customer list, audit log
- [ ] Write the learning doc
- [ ] Review with `code-reviewer` and fix what it finds
- [ ] Compound: save a lesson in `document/solutions/` if one passes the counterfactual question
- [ ] Merge into `main`

### 30_photo_uploads

- [ ] Create branch `30_photo_uploads`
- [ ] Plan with `ce-plan`
- [ ] Photo storage with signed URLs, resizing, access checks
- [ ] Write the learning doc
- [ ] Review with `code-reviewer` and fix what it finds
- [ ] Compound: save a lesson in `document/solutions/` if one passes the counterfactual question
- [ ] Merge into `main`

### 31_job_timeline

- [ ] Create branch `31_job_timeline`
- [ ] Plan with `ce-plan`
- [ ] Mechanic job updates; customer tracking timeline
- [ ] Write the learning doc
- [ ] Review with `code-reviewer` and fix what it finds
- [ ] Compound: save a lesson in `document/solutions/` if one passes the counterfactual question
- [ ] Merge into `main`

### 32_estimate_requests

- [ ] Create branch `32_estimate_requests`
- [ ] Plan with `ce-plan`
- [ ] Free estimate requests with photos; admin inbox
- [ ] Write the learning doc
- [ ] Review with `code-reviewer` and fix what it finds
- [ ] Compound: save a lesson in `document/solutions/` if one passes the counterfactual question
- [ ] Merge into `main`

### 33_estimate_builder

- [ ] Create branch `33_estimate_builder`
- [ ] Plan with `ce-plan`
- [ ] Estimate lines, versions, send for approval
- [ ] Write the learning doc
- [ ] Review with `code-reviewer` and fix what it finds
- [ ] Compound: save a lesson in `document/solutions/` if one passes the counterfactual question
- [ ] Merge into `main`

### 34_estimate_approval

- [ ] Create branch `34_estimate_approval`
- [ ] Plan with `ce-plan`
- [ ] Customer approves or rejects each estimate line
- [ ] Write the learning doc
- [ ] Review with `code-reviewer` and fix what it finds
- [ ] Compound: save a lesson in `document/solutions/` if one passes the counterfactual question
- [ ] Merge into `main`

### 35_notification_outbox

- [ ] Create branch `35_notification_outbox`
- [ ] Plan with `ce-plan`
- [ ] Notification outbox (SMS, WhatsApp, email fakes), retries, consent
- [ ] Reuse `dev_messages` (it already has a `channel`: sms, whatsapp, email) and the provider pattern in `src/server/providers/`. `notify()` sends only for purposes the user agreed to (`consents`) (task 15)
- [ ] Write the learning doc
- [ ] Review with `code-reviewer` and fix what it finds
- [ ] Compound: save a lesson in `document/solutions/` if one passes the counterfactual question
- [ ] Merge into `main`

### 36_service_reminders

- [ ] Create branch `36_service_reminders`
- [ ] Plan with `ce-plan`
- [ ] Daily reminders: service due, PUC, insurance
- [ ] Write the learning doc
- [ ] Review with `code-reviewer` and fix what it finds
- [ ] Compound: save a lesson in `document/solutions/` if one passes the counterfactual question
- [ ] Merge into `main`

### 37_reviews

- [ ] Create branch `37_reviews`
- [ ] Plan with `ce-plan`
- [ ] Customer reviews, `/reviews`, admin reply or hide
- [ ] Switch the home page reviews preview and rating from sample content to real reviews: `selectReviews()` in `src/content/home.ts` reads the real ones; delete `sampleReviews`, and move the production no-samples scan in `e2e/home.spec.ts` off `sampleCanary`, which goes with them (task 13)
- [ ] Decide the rating stat's one source, the owner's Google rating or the site's own average: two ratings that disagree would confuse visitors (task 13)
- [ ] Write the learning doc
- [ ] Review with `code-reviewer` and fix what it finds
- [ ] Compound: save a lesson in `document/solutions/` if one passes the counterfactual question
- [ ] Merge into `main`

### 38_offers_coupons

- [ ] Create branch `38_offers_coupons`
- [ ] Plan with `ce-plan`
- [ ] Offers, banner, coupons at booking
- [ ] Switch the offer banner from `src/content/offer.ts` to database offers
- [ ] A prerendered banner can't check an offer's end date when it renders: end it through cache expiry or a check in the browser, like the open status (task 12)
- [ ] Write the learning doc
- [ ] Review with `code-reviewer` and fix what it finds
- [ ] Compound: save a lesson in `document/solutions/` if one passes the counterfactual question
- [ ] Merge into `main`

### 39_catalogue_admin

- [ ] Create branch `39_catalogue_admin`
- [ ] Plan with `ce-plan`
- [ ] Admin editing of services, prices, packages, vehicles
- [ ] Write the learning doc
- [ ] Review with `code-reviewer` and fix what it finds
- [ ] Compound: save a lesson in `document/solutions/` if one passes the counterfactual question
- [ ] Merge into `main`

### 40_content_admin

- [ ] Create branch `40_content_admin`
- [ ] Plan with `ce-plan`
- [ ] Admin editing of FAQ, content blocks and garage info
- [ ] The garage info editor saves through `saveGarage` from a Server Action, after task 16's role check, and turns its problem codes (`GarageProblem`) into messages. Add an e2e test that the header and footer change after a save (task 14)
- [ ] Write the learning doc
- [ ] Review with `code-reviewer` and fix what it finds
- [ ] Compound: save a lesson in `document/solutions/` if one passes the counterfactual question
- [ ] Merge into `main`

### 41_admin_reports

- [ ] Create branch `41_admin_reports`
- [ ] Plan with `ce-plan`
- [ ] Reports and CSV export
- [ ] Reports that group by day convert to India time in SQL (`AT TIME ZONE 'Asia/Kolkata'`): the database session runs in UTC (task 14)
- [ ] Write the learning doc
- [ ] Review with `code-reviewer` and fix what it finds
- [ ] Compound: save a lesson in `document/solutions/` if one passes the counterfactual question
- [ ] Merge into `main`

### 42_local_seo

- [ ] Create branch `42_local_seo`
- [ ] Plan with `ce-plan`
- [ ] Metadata, sitemap, robots, social image, AutoRepair structured data
- [ ] An `apple-icon` PNG (180×180) from the same letter design as `src/app/icon.svg`, plus `theme-color` (task 11)
- [ ] One source of hreflang for when Hindi ships: `alternates.languages` in metadata and the sitemap with `alternateLinks: false` in `src/i18n/routing.ts`, or next-intl's `Link` header alone (SEO check in task 10). A canonical on `/` also settles the `/en` 307 redirect
- [ ] The 404 titles already include the brand (`NotFound.metaTitle`), so the title template must not add it twice. The PIN code (412101) is already stored on its own (`garage_settings.postal_code`, read with `readGarage()` from `src/server/dal/garage.ts`; task 14); split the address text into street, area and city for the JSON-LD (task 12)
- [ ] Decide whether to add a `favicon.ico`: today `/favicon.ico` gets Next.js's bare 404, because the proxy skips `.ico` paths (task 12)
- [ ] The home page's title and description name Kiwale, Pune (task 13 changed only the h1 and the description's wording), with `AutoRepair` JSON-LD and a social image (task 13)
- [ ] Once the domain is known, add the WebOTP line (`@domain #code`) to the login SMS (`Sms.loginCode`), so Android can fill the code in (task 15)
- [ ] `Login.metaTitle` and `Account.metaTitle` already end in the brand ("Log in | {brand}"), like `NotFound.metaTitle`. With a `%s | GoMechanic` title template they would read "Log in | GoMechanic | GoMechanic": drop the brand from those messages, or return `title: { absolute: ... }` (SEO check in task 15)
- [ ] Write the learning doc
- [ ] Review with `code-reviewer` and fix what it finds
- [ ] Compound: save a lesson in `document/solutions/` if one passes the counterfactual question
- [ ] Merge into `main`

### 43_privacy_dpdp

- [ ] Create branch `43_privacy_dpdp`
- [ ] Plan with `ce-plan`
- [ ] Privacy notice, consent withdrawal, delete-my-data, export
- [ ] Consent history and withdrawal (`consents`). Deleting a user is refused while it has consent records (`restrict`): decide what deletion does to them. Mention that sessions keep the IP address and browser name (task 15)
- [ ] Write the learning doc
- [ ] Review with `code-reviewer` and fix what it finds
- [ ] Compound: save a lesson in `document/solutions/` if one passes the counterfactual question
- [ ] Merge into `main`

### 44_real_sms_otp

- [ ] Create branch `44_real_sms_otp`
- [ ] Plan with `ce-plan`
- [ ] Real SMS OTP (MSG91 + DLT), bot protection, rate limits (paid)
- [ ] An MSG91 provider (`SMS_PROVIDER=msg91`) with its DLT template; production then starts. Turnstile on the phone step, a per-IP cap on code checks, a site-wide daily SMS cap, tuned `LOGIN_RULES`, a message for a provider failure, and sending through Better Auth's background-task hook. Until then a number can be locked out for up to a day and nobody can reset it (task 15)
- [ ] Write the learning doc
- [ ] Review with `code-reviewer` and fix what it finds
- [ ] Compound: save a lesson in `document/solutions/` if one passes the counterfactual question
- [ ] Merge into `main`

### 45_real_whatsapp_email

- [ ] Create branch `45_real_whatsapp_email`
- [ ] Plan with `ce-plan`
- [ ] Real WhatsApp Cloud API and email (paid)
- [ ] Write the learning doc
- [ ] Review with `code-reviewer` and fix what it finds
- [ ] Compound: save a lesson in `document/solutions/` if one passes the counterfactual question
- [ ] Merge into `main`

### 46_production_launch

- [ ] Create branch `46_production_launch`
- [ ] Plan with `ce-plan`
- [ ] Production plans, domain, monitoring, backups, final audit (paid)
- [ ] Write the learning doc
- [ ] Review with `code-reviewer` and fix what it finds
- [ ] Compound: save a lesson in `document/solutions/` if one passes the counterfactual question
- [ ] Merge into `main`

## Backlog (later)

Not in version 1. See [features.md](../website/features.md).

- Online payments (UPI, cards) and GST invoices
- Referral rewards
- Revenue and GST reports, spare-parts inventory
- Hindi translation of all text (the site is built Hindi-ready from task 10). Also make `src/i18n/messages.test.ts` check that `hi.json` has exactly the keys of `en.json`
- Upgrade ESLint 9 (end-of-life; `npm ci` prints a deprecation warning) to ESLint 10 once `eslint-config-next`'s plugins support it
- Restyle Badge's text size: it's shadcn's stock 12px (`text-xs` in `src/components/ui/badge.tsx`), below MASTER.md's 13px floor. Its own small task (task 12)
- Real trust numbers from the owner (years in business, vehicles serviced, rating, warranty): set `trustStats` in `src/content/home.ts`. They then show in every build, without the Sample badge. Years in business is a number the owner gives, never worked out from today's date (task 13)
- Real photos of the garage: static imports from a new `src/assets/` folder, passed to the home page's visual slots (the hero's with `eager`), each with its alt text added to `messages/en.json` (task 13)
- The lint text guard in `eslint.config.mjs` treats every `placeholder` prop as text people read, including next/image's `placeholder="blur"` setting; `src/components/site/visual-slot.tsx` works around it. Narrow that selector to form fields, with a case in `src/i18n/lint-guards.test.ts` (task 13)
- App-like install for customers, roadside-assistance dispatch, more branches
- The local database lock (`src/server/db/folder-lock.ts`): if two processes start within milliseconds of each other and both find a lock left by a stopped process, both can take it over (each deletes the old file, and the second can delete the first one's new lock). Take it over by renaming the old file aside and checking it still names the stopped process, instead of deleting it. Rare: it needs two `npm run dev` starting together after a crash (task 14 code review)
- `npm audit` shows 3 low findings from a deepmerge advisory through the shadcn CLI (also on `main`, seen in task 14). Revisit when shadcn updates; don't run `npm audit fix --force` (it would install shadcn 1.0.0)
- For task 20: the Supabase seed also writes the `slot_rules` row (`ownerSlotRules` in `src/server/db/seed-data.ts`; the slot reads throw without it). Then prove "never overbooked" on real Postgres: N parallel `reserveSlot` calls on one slot never pass its capacity (PGlite runs one query or one transaction at a time, so the unit tests can't) (task 22)
- For task 23: in the booking transaction, call `reserveSlot(tx, ...)` before writing the booking and return a non-ok answer at once; write the booking only after an ok. Confirm with the owner that a pending booking holds a place from creation (task 22 assumes so). Add a test that every slot's counter equals its active bookings. Read slots with `readAvailableSlots` inside `<Suspense>`, after `await io()` (it reads the clock before its first query) (task 22)
- For task 24: a pickup booking's slot is the time the vehicle reaches the garage, and it takes a place like any booking (task 22)
- For tasks 25 and 27: a cancel or reschedule first locks the booking row (`select ... for update`) and reads its slot and status from that row, then calls `releaseSlot` or `moveSlot` (inside the same transaction), then writes the booking. Two changes at once then run one after the other; without the lock both give the old slot's place back and it can be overbooked. Add a test, and prove it on Postgres with task 20's race test (task 22)
- For task 26: `reserveSlot` and `moveSlot` apply the customer window (tomorrow to 7 days ahead). Phone and walk-in bookings need a staff rule (today, later dates; may staff go over "full"?): ask the owner, then add it as an option (task 22)
- For task 28: edit slot rules (`checkSlotRules`) and closed dates. Before saving rules, hours (`saveGarage`) or a closed date, list the future reservations it would strand; lock the `slot_rules` row in each save and have `reserveSlot` read it `for share`, so the list includes reservations still being made. Add a cached closed-dates read so the open badge says "Closed" on those dates (task 22)
- For task 43: deleting a customer's data releases their future bookings' places, locking each booking row first like a cancel (task 22)
- Task 20: set `OWNER_PHONE_NUMBER` on Vercel staging (required there, like `BETTER_AUTH_SECRET`) (task 16)
- Task 21: vehicle and profile data take the user from `authorizeUser()` in the data-access layer (`requireUser(locale)` in pages and actions) and filter by it in the query, never a user id from the caller; a test that customer A can't read or change customer B's vehicle by its id (task 16)
- Task 23: a booking takes its customer from the session after the inline code (`authorizeUser()`, called before the booking transaction opens, never inside it), never from a form field (task 16)
- Task 25: another customer's booking id gives the 404 page, not a 403 (task 16)
- Task 26: add `/admin` to `PROTECTED_PREFIXES` in `src/lib/access-routes.ts`; every `/admin` page calls `requirePermission(locale, "admin.open")` itself, not only its layout; browser tests that a customer gets the 404 and a logged-out visitor a 307; revisit `forbidden()` (task 16)
- Tasks 28 and 40: `saveGarage` now checks `garage.edit` itself; their Server Action calls `requireUser(locale)` first (their steps still say "after task 16's role check") (task 16)
- Task 29: assigning roles needs `team.manage`; nobody can be given `owner` (it comes from `OWNER_PHONE_NUMBER`); the team list shows the effective role (`effectiveRole`) (task 16)
- Task 31: a mechanic's job queries filter by the assigned mechanic in the query, and never select a customer's phone number (`customers.contact` is not a mechanic's) (task 16)

## How to add a task

1. **Pick the next free number**: the highest number in the tables plus one, always two digits (`07`, not `7`).
2. **Name it** `NN_short_name`: lowercase, words joined with `_`, two to four words that say the outcome.
   Good: `03_skills_installation`, `12_booking_form`. Bad: `5-stuff`, `fix`, `Task_Twelve`.
3. **Add it here**: a row in the table (status `To do`) and a list of small steps under "Task steps".
4. **Create the branch** from an up-to-date `main` (replace `NN_short_name` with your task's name):
   ```bash
   git switch main
   git pull            # only if the repo has a remote you work with
   git switch -c NN_short_name
   ```
5. **Set the status to `In progress`** and do the work in small commits.
6. **Write the learning doc**: copy [TEMPLATE.md](../learning/TEMPLATE.md) to `document/learning/NN_short_name.md` and fill it in.
7. **Link the learning doc** in the table. Tick "Review" only after the review really happened.
8. **Merge into `main` through a pull request.** Push the branch and make sure a pull request into `main` exists; the owner merges it on GitHub (from task 10 on; tasks 01–09 were merged locally with `git merge --no-ff`):
   ```bash
   git push -u origin NN_short_name   # ask the owner first
   gh pr list                          # is there a pull request for the branch?
   ```
   After the owner merges it, update your `main`: `git switch main && git pull --ff-only origin main`.
9. **Mark it done** in one bookkeeping commit, `docs(NN): mark task NN done`: tick "Merge into `main`", set the status to `Done` here and in the learning doc's header. Make it the first commit on the next task's branch, so `main` only changes through pull requests. A step can't honestly be ticked before it happens, which is why this comes after the merge.
