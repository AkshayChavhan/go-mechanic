# Task tracker

Every piece of work in this repo is a small, numbered task. This file is the one list of all of them.

- **Task name = branch name = learning-doc folder.** Task `01_project_setup` lives on branch `01_project_setup` and is explained in `document/task/01_project_setup/README.md`.
- **Status** is one of: `To do`, `In progress`, `Done`.
- **Small** means one focused change you could review in about 15 minutes. If a task grows past that, split it.

## Tasks

| # | Task (= branch) | Goal | Status | Learning doc |
| --- | --- | --- | --- | --- |
| 01 | `01_project_setup` | Repo foundation: readme, `.gitignore`, this tracker, learning-doc template | Done | [README](01_project_setup/README.md) |
| 02 | `02_claude_guidelines` | `CLAUDE.md`: the rules Claude follows in this repo | Done | [README](02_claude_guidelines/README.md) |
| 03 | `03_skills_installation` | Install Claude skills (GSAP, shadcn/ui, frontend-design, UI/UX Pro Max, 21st.dev) and write the skills doc | Done | [README](03_skills_installation/README.md) |
| 04 | `04_agents` | Subagents for planning, learning docs, UI work and review | Done | [README](04_agents/README.md) |
| 05 | `05_website_plan` | Feature list, pages and task breakdown for the mechanic website | Done | [README](05_website_plan/README.md) |
| 06 | `06_app_setup` | Empty Next.js app with Tailwind, shadcn/ui, GSAP and the site config file | To do | |
| 07 | `07_design_system` | Colors, fonts, spacing and the visual direction | To do | |
| 08 | `08_layout_shell` | Header, navigation, footer, sticky mobile action bar, 404 page | To do | |
| 09 | `09_home_page` | Home page sections and the hero animation | To do | |
| 10 | `10_services_pages` | Services list, service detail pages, packages page | To do | |
| 11 | `11_booking_form` | Booking form, saving bookings, confirmation page, tests | To do | |
| 12 | `12_contact_page` | Contact page, map, hours, estimate request form | To do | |
| 13 | `13_about_reviews_faq` | About, reviews and FAQ pages | To do | |
| 14 | `14_booking_tracking` | Track-a-booking page | To do | |
| 15 | `15_admin_dashboard` | Password-protected admin dashboard | To do | |
| 16 | `16_seo_and_polish` | SEO, structured data, sitemap, accessibility and performance check | To do | |

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

### 05_website_plan

- [x] Create branch `05_website_plan`
- [x] List who the site is for and what they need
- [x] Write the feature list, pages and decisions in `document/website/features.md`
- [x] Split the build into tasks 06 to 16 with steps
- [x] Write the learning doc
- [x] Review with `code-reviewer` and fix what it finds
- [x] Merge into `main`

### 06_app_setup

- [ ] Create branch `06_app_setup`
- [ ] Create the Next.js app (TypeScript, Tailwind, App Router, `src/` folder) and move it to the repo root
- [ ] Run `shadcn init`
- [ ] Install GSAP and `@gsap/react`
- [ ] Add `src/config/site.ts` with sample business details
- [ ] Check `npm run dev`, `npm run lint` and `npm run build` work
- [ ] Update `readme.md` (how to run the app) and `CLAUDE.md` (stack, commands)
- [ ] Write the learning doc, review, merge

### 07_design_system

- [ ] Create branch `07_design_system`
- [ ] Get design data from ui-ux-pro-max; plan the direction with frontend-design
- [ ] Save the decisions in `design-system/go-mechanic/MASTER.md`
- [ ] Apply colors, radius and fonts to the shadcn theme in `src/app/globals.css` and the root layout
- [ ] Check text contrast
- [ ] Write the learning doc, review, merge

### 08_layout_shell

- [ ] Create branch `08_layout_shell`
- [ ] Header with logo, navigation and a call button; mobile menu
- [ ] Footer with address, hours, contact links and page links
- [ ] Sticky mobile action bar (Call, WhatsApp, Book)
- [ ] "Open now" helper based on opening hours
- [ ] 404 page
- [ ] Write the learning doc, review, merge

### 09_home_page

- [ ] Create branch `09_home_page`
- [ ] Hero with the main promise and actions
- [ ] Trust signals, services preview, how it works, why choose us, reviews preview, final call to action
- [ ] One GSAP hero animation with a reduced-motion fallback
- [ ] Check at phone, tablet and desktop widths
- [ ] Write the learning doc, review, merge

### 10_services_pages

- [ ] Create branch `10_services_pages`
- [ ] Services data file (description, price, time, what's included, signs, questions)
- [ ] `/services` list page
- [ ] `/services/[slug]` detail pages, built at build time
- [ ] `/pricing` packages page
- [ ] Write the learning doc, review, merge

### 11_booking_form

- [ ] Create branch `11_booking_form`
- [ ] Booking rules as a validation schema (shared by browser and server)
- [ ] Storage module that saves bookings to `data/bookings.json`
- [ ] `/book` form with vehicle, services, date and slot, pickup and drop, contact
- [ ] Server action that validates, saves and redirects
- [ ] `/book/confirmed` page and "Book on WhatsApp" button
- [ ] Unit tests for the schema and storage
- [ ] Write the learning doc, review, merge

### 12_contact_page

- [ ] Create branch `12_contact_page`
- [ ] Contact details, map and directions, opening hours, emergency number
- [ ] Estimate request form (saved like bookings)
- [ ] Write the learning doc, review, merge

### 13_about_reviews_faq

- [ ] Create branch `13_about_reviews_faq`
- [ ] `/about` page
- [ ] `/reviews` page with average rating
- [ ] `/faq` page
- [ ] Write the learning doc, review, merge

### 14_booking_tracking

- [ ] Create branch `14_booking_tracking`
- [ ] `/track` form (booking ID and phone)
- [ ] Status timeline
- [ ] Write the learning doc, review, merge

### 15_admin_dashboard

- [ ] Create branch `15_admin_dashboard`
- [ ] Password protection for `/admin`
- [ ] Bookings and estimate requests list with status filter
- [ ] Change booking status
- [ ] Write the learning doc, review, merge

### 16_seo_and_polish

- [ ] Create branch `16_seo_and_polish`
- [ ] Page titles and descriptions, social preview image
- [ ] `AutoRepair` structured data, sitemap, robots
- [ ] Accessibility and performance check, fix what it finds
- [ ] Final full-site review
- [ ] Write the learning doc, review, merge

## Backlog (later)

Not in this build. See "Not in this build" in [features.md](../website/features.md) for why.

- Real database and hosting
- Email, SMS or WhatsApp notifications
- Online payments
- Customer accounts and service history
- Blog with car-care tips
- More languages
- Real workshop and team photos

## How to add a task

1. **Pick the next free number.** Always two digits: `05`, `06`, ... `17`, `18`.
2. **Name it** `NN_short_name`: lowercase, words joined with `_`, two to four words that say the outcome.
   Good: `06_app_setup`, `17_blog_tips`. Bad: `5-stuff`, `fix`, `Task_Twelve`.
3. **Add it here**: a row in the table (status `To do`) and a list of small steps under "Task steps".
4. **Create the branch** from an up-to-date `main`:
   ```bash
   git switch main
   git pull            # only if the repo has a remote you work with
   git switch -c 17_blog_tips
   ```
5. **Set the status to `In progress`** and do the work in small commits.
6. **Write the learning doc**: copy [TEMPLATE.md](TEMPLATE.md) to `document/task/NN_short_name/README.md` and fill it in.
7. **Set the status to `Done`** and link the learning doc in the table.
8. **Merge into `main`** (or open a pull request):
   ```bash
   git switch main
   git merge --no-ff 17_blog_tips
   ```
