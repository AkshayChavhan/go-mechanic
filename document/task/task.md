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
| 09 | `09_app_setup` | Next.js 16 app, shadcn/ui (Radix), GSAP, Vitest + Playwright, `npm run check` | In progress | [09_app_setup.md](../learning/09_app_setup.md) |
| 10 | `10_i18n_foundation` | next-intl with `[locale]` routes (English now, Hindi-ready), ₹ and date formatting | To do |  |
| 11 | `11_design_system` | Apple-like design system: tokens, type, motion, restyled controls, `/design` preview | To do |  |
| 12 | `12_layout_shell` | Frosted header, footer, sticky mobile action bar, 404, open-now, offer banner | To do |  |
| 13 | `13_home_page` | Apple-style home page with GSAP scroll storytelling | To do |  |
| 14 | `14_database_setup` | Drizzle + PGlite/Postgres, migrations, seed, env and clock helpers | To do |  |
| 15 | `15_auth_otp_login` | Mobile OTP login (Better Auth) with a fake SMS sender and `/dev/outbox` | To do |  |
| 16 | `16_roles_access` | Roles (customer, mechanic, manager, owner), `can()` matrix, protected areas | To do |  |
| 17 | `17_vehicle_catalogue` | Vehicle types, brands, models; vehicle picker | To do |  |
| 18 | `18_services_pricing` | Services, packages, prices by vehicle; `/services`, `/packages` | To do |  |
| 19 | `19_info_pages` | Contact, about, FAQ, privacy and terms pages | To do |  |
| 20 | `20_staging_deploy` | Staging on Vercel + Supabase (Mumbai) with fake providers | To do |  |
| 21 | `21_customer_vehicles` | Customer vehicles with registration-number checks, profile | To do |  |
| 22 | `22_slot_engine` | Time slots, capacity, holidays; atomic slot reservation | To do |  |
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
- [ ] Remove leftover ignored build folders; scaffold Next.js 16.4.3 in a scratch folder and copy it in
- [ ] `shadcn init` (Radix); install GSAP
- [ ] Vitest + Playwright smoke tests; `npm run check`
- [ ] Update `CLAUDE.md` (stack, commands, `@AGENTS.md`) and `readme.md`
- [ ] Write the learning doc
- [ ] Review with `code-reviewer` and fix what it finds
- [ ] Compound: save a lesson in `document/solutions/` if one passes the counterfactual question
- [ ] Merge into `main`

### 10_i18n_foundation

- [ ] Create branch `10_i18n_foundation`
- [ ] Plan with `ce-plan`
- [ ] next-intl with `src/app/[locale]/` and `localePrefix: 'as-needed'`
- [ ] `messages/en.json`; ₹, date and time formatters (`en-IN`, `Asia/Kolkata`)
- [ ] Check it works with Cache Components
- [ ] Write the learning doc
- [ ] Review with `code-reviewer` and fix what it finds
- [ ] Compound: save a lesson in `document/solutions/` if one passes the counterfactual question
- [ ] Merge into `main`

### 11_design_system

- [ ] Create branch `11_design_system`
- [ ] Plan with `ce-plan`
- [ ] Design direction with frontend-design + ui-ux-pro-max (Apple-like)
- [ ] Tokens in `globals.css`: colors, type scale, radius, shadows, motion
- [ ] Fonts: Inter + system San Francisco, Devanagari-ready
- [ ] Restyle shadcn controls (44 px touch targets, pill buttons)
- [ ] `design-system/go-mechanic/MASTER.md` and a `/dev/design` preview page (development only)
- [ ] Write the learning doc
- [ ] Review with `code-reviewer` and fix what it finds
- [ ] Compound: save a lesson in `document/solutions/` if one passes the counterfactual question
- [ ] Merge into `main`

### 12_layout_shell

- [ ] Create branch `12_layout_shell`
- [ ] Plan with `ce-plan`
- [ ] Garage details, hours and offer in typed placeholder content files (`src/content/`), replaced in tasks 14 and 38
- [ ] Frosted sticky header with navigation and mobile menu
- [ ] Footer, sticky Call/WhatsApp/Book bar on phones, 404 page
- [ ] Open-now badge and offer banner
- [ ] Write the learning doc
- [ ] Review with `code-reviewer` and fix what it finds
- [ ] Compound: save a lesson in `document/solutions/` if one passes the counterfactual question
- [ ] Merge into `main`

### 13_home_page

- [ ] Create branch `13_home_page`
- [ ] Plan with `ce-plan`
- [ ] Hero, trust stats, services bento grid, how it works, reviews preview, final call to action (labelled placeholder content until tasks 18 and 37; sample reviews marked as samples)
- [ ] GSAP scroll storytelling (pinned section, reveals, counters) with a reduced-motion fallback
- [ ] Check at 375, 768, 1024 and 1440 px and with reduced motion
- [ ] Write the learning doc
- [ ] Review with `code-reviewer` and fix what it finds
- [ ] Compound: save a lesson in `document/solutions/` if one passes the counterfactual question
- [ ] Merge into `main`

### 14_database_setup

- [ ] Create branch `14_database_setup`
- [ ] Plan with `ce-plan`
- [ ] Drizzle + PGlite/Postgres, migrations, seed, env and clock helpers
- [ ] Move garage details and hours from the placeholder content file into the database; layout reads the database
- [ ] Write the learning doc
- [ ] Review with `code-reviewer` and fix what it finds
- [ ] Compound: save a lesson in `document/solutions/` if one passes the counterfactual question
- [ ] Merge into `main`

### 15_auth_otp_login

- [ ] Create branch `15_auth_otp_login`
- [ ] Plan with `ce-plan`
- [ ] Mobile OTP login (Better Auth) with a fake SMS sender and `/dev/outbox`
- [ ] Write the learning doc
- [ ] Review with `code-reviewer` and fix what it finds
- [ ] Compound: save a lesson in `document/solutions/` if one passes the counterfactual question
- [ ] Merge into `main`

### 16_roles_access

- [ ] Create branch `16_roles_access`
- [ ] Plan with `ce-plan`
- [ ] Roles (customer, mechanic, manager, owner), `can()` matrix, protected areas
- [ ] Write the learning doc
- [ ] Review with `code-reviewer` and fix what it finds
- [ ] Compound: save a lesson in `document/solutions/` if one passes the counterfactual question
- [ ] Merge into `main`

### 17_vehicle_catalogue

- [ ] Create branch `17_vehicle_catalogue`
- [ ] Plan with `ce-plan`
- [ ] Vehicle types, brands, models; vehicle picker
- [ ] Write the learning doc
- [ ] Review with `code-reviewer` and fix what it finds
- [ ] Compound: save a lesson in `document/solutions/` if one passes the counterfactual question
- [ ] Merge into `main`

### 18_services_pricing

- [ ] Create branch `18_services_pricing`
- [ ] Plan with `ce-plan`
- [ ] Services, packages, prices by vehicle; `/services`, `/packages`
- [ ] Switch the home page services grid from placeholder content to database services
- [ ] Write the learning doc
- [ ] Review with `code-reviewer` and fix what it finds
- [ ] Compound: save a lesson in `document/solutions/` if one passes the counterfactual question
- [ ] Merge into `main`

### 19_info_pages

- [ ] Create branch `19_info_pages`
- [ ] Plan with `ce-plan`
- [ ] Contact, about, FAQ, privacy and terms pages
- [ ] Write the learning doc
- [ ] Review with `code-reviewer` and fix what it finds
- [ ] Compound: save a lesson in `document/solutions/` if one passes the counterfactual question
- [ ] Merge into `main`

### 20_staging_deploy

- [ ] Create branch `20_staging_deploy`
- [ ] Plan with `ce-plan`
- [ ] Staging on Vercel + Supabase (Mumbai) with fake providers
- [ ] Write the learning doc
- [ ] Review with `code-reviewer` and fix what it finds
- [ ] Compound: save a lesson in `document/solutions/` if one passes the counterfactual question
- [ ] Merge into `main`

### 21_customer_vehicles

- [ ] Create branch `21_customer_vehicles`
- [ ] Plan with `ce-plan`
- [ ] Customer vehicles with registration-number checks, profile
- [ ] Ask the owner to start the DLT (SMS) and Meta (WhatsApp) paperwork: approvals take weeks
- [ ] Write the learning doc
- [ ] Review with `code-reviewer` and fix what it finds
- [ ] Compound: save a lesson in `document/solutions/` if one passes the counterfactual question
- [ ] Merge into `main`

### 22_slot_engine

- [ ] Create branch `22_slot_engine`
- [ ] Plan with `ce-plan`
- [ ] Time slots, capacity, holidays; atomic slot reservation
- [ ] Write the learning doc
- [ ] Review with `code-reviewer` and fix what it finds
- [ ] Compound: save a lesson in `document/solutions/` if one passes the counterfactual question
- [ ] Merge into `main`

### 23_booking_flow

- [ ] Create branch `23_booking_flow`
- [ ] Plan with `ce-plan`
- [ ] `/book` wizard with OTP, server-side prices, e2e test
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
- [ ] Switch the home page reviews preview and rating from sample content to real reviews
- [ ] Write the learning doc
- [ ] Review with `code-reviewer` and fix what it finds
- [ ] Compound: save a lesson in `document/solutions/` if one passes the counterfactual question
- [ ] Merge into `main`

### 38_offers_coupons

- [ ] Create branch `38_offers_coupons`
- [ ] Plan with `ce-plan`
- [ ] Offers, banner, coupons at booking
- [ ] Switch the offer banner from placeholder content to database offers
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
- [ ] Write the learning doc
- [ ] Review with `code-reviewer` and fix what it finds
- [ ] Compound: save a lesson in `document/solutions/` if one passes the counterfactual question
- [ ] Merge into `main`

### 41_admin_reports

- [ ] Create branch `41_admin_reports`
- [ ] Plan with `ce-plan`
- [ ] Reports and CSV export
- [ ] Write the learning doc
- [ ] Review with `code-reviewer` and fix what it finds
- [ ] Compound: save a lesson in `document/solutions/` if one passes the counterfactual question
- [ ] Merge into `main`

### 42_local_seo

- [ ] Create branch `42_local_seo`
- [ ] Plan with `ce-plan`
- [ ] Metadata, sitemap, robots, social image, AutoRepair structured data
- [ ] Write the learning doc
- [ ] Review with `code-reviewer` and fix what it finds
- [ ] Compound: save a lesson in `document/solutions/` if one passes the counterfactual question
- [ ] Merge into `main`

### 43_privacy_dpdp

- [ ] Create branch `43_privacy_dpdp`
- [ ] Plan with `ce-plan`
- [ ] Privacy notice, consent withdrawal, delete-my-data, export
- [ ] Write the learning doc
- [ ] Review with `code-reviewer` and fix what it finds
- [ ] Compound: save a lesson in `document/solutions/` if one passes the counterfactual question
- [ ] Merge into `main`

### 44_real_sms_otp

- [ ] Create branch `44_real_sms_otp`
- [ ] Plan with `ce-plan`
- [ ] Real SMS OTP (MSG91 + DLT), bot protection, rate limits (paid)
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
- Hindi translation of all text (the site is built Hindi-ready from task 10)
- App-like install for customers, roadside-assistance dispatch, more branches

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
8. **Merge into `main`** (or open a pull request):
   ```bash
   git switch main
   git merge --no-ff NN_short_name
   ```
9. **Mark it done** in one bookkeeping commit on `main`: tick "Merge into `main`", set the status to `Done` here and in the learning doc's header, then `git commit -m "docs(NN): mark task NN done"`. A step can't honestly be ticked before it happens, which is why this comes after the merge.
