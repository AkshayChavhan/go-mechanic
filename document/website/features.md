# Go Mechanic website: features and plan

This page is the **product plan** for the website: who it's for, what it must do, what it won't do yet, and the tasks that build it. When a task adds or changes a feature, update this page in the same task.

## Who the site is for

| Who | What they want to know or do |
| --- | --- |
| **Car owners** (most visitors, mostly on phones) | Can you fix my problem? How much will it cost? When can you do it? Can I trust you? How do I reach you right now? |
| **The garage** (owner and front desk) | More bookings with less phone back-and-forth, and one place to see and update every job. |

Every feature below answers one of those questions.

## Features in this build

### 1. Get found and trusted

- **Home page** with a clear promise and two main actions: *Book a service* and *Call now*.
- **Trust signals**: years in business, cars serviced, average rating, certified technicians, warranty on work.
- **Reviews page** with customer reviews and the average rating.
- **About page**: the garage's story, team, workshop and certifications.
- **Local SEO**: page titles and descriptions, `AutoRepair` structured data (helps Google show address, hours and rating), sitemap and robots file.

### 2. Understand services and prices

- **Services list**: each service with a short description, starting price ("from ₹...") and typical time.
- **Service detail page** for each service: what's included, signs you need it, price, common questions, and a *Book this service* button.
- **Service packages**: Basic, Standard and Comprehensive service, compared side by side.
- **Offer banner** (for example a first-service discount), switched on or off in config.

### 3. Book and stay informed

- **Online booking form**: vehicle (make, model, year, fuel type, registration number), services, preferred date and time slot, optional **pickup and drop** with address, contact details and notes. Clear errors next to each field. Confirmation page with a **booking ID**.
- **Book on WhatsApp**: a button that opens WhatsApp with a ready-made message, for people who'd rather chat.
- **Track a booking**: enter the booking ID and phone number to see the status (Received, Confirmed, In service, Ready for pickup, Completed).
- **Free estimate request**: a short form for "how much would it cost to...?" questions.

### 4. Reach the garage

- **Click-to-call, WhatsApp and email** links everywhere they're useful.
- **Address with map** and a *Get directions* link.
- **Opening hours** with a live "Open now" or "Closed" label.
- **Emergency and roadside assistance** number, easy to find.
- **Sticky action bar on phones**: Call, WhatsApp, Book.
- **FAQ page**: payment methods, warranty, pickup and drop, how long jobs take, genuine parts.

### 5. Run the garage (admin)

- **Admin dashboard** at `/admin`, protected by a password: list of bookings and estimate requests, filter by status, and change a booking's status (which is what customers see on the tracking page).

## Not in this build (backlog)

These are useful, but each one needs a service, money or decisions we don't have yet.

- **Real database and hosting.** Bookings are saved to a local JSON file for now, which is fine for learning but not for a live site.
- **Notifications** by email, SMS or WhatsApp when a booking is made or its status changes.
- **Online payments.**
- **Customer accounts** with login and service history.
- **Blog** with car-care tips.
- **More languages** (for example Hindi or Marathi).
- **Real photos** of the workshop and team. The build uses illustrations and placeholders.

## Pages

| Path | Page |
| --- | --- |
| `/` | Home |
| `/services` | All services |
| `/services/[slug]` | One service, e.g. `/services/brake-repair` |
| `/pricing` | Service packages |
| `/book` | Booking form |
| `/book/confirmed` | Booking confirmation with booking ID |
| `/track` | Track a booking |
| `/contact` | Contact details, map, hours, estimate request |
| `/about` | About the garage |
| `/reviews` | Customer reviews |
| `/faq` | Common questions |
| `/admin` | Admin dashboard (password protected) |

## Decisions and assumptions

| Decision | Why | How to change it |
| --- | --- | --- |
| **Stack:** Next.js 16 (App Router), TypeScript, Tailwind CSS v4, shadcn/ui, GSAP, npm | It's what the installed skills are built for, and the most common React setup | Hard to change later: decide before task 06 |
| **Business details are sample data** in one file (`src/config/site.ts`) | We don't have the real name, address or phone yet | Edit that one file |
| **Indian market:** prices in ₹, +91 phone numbers, WhatsApp-first | WhatsApp is how most Indian customers talk to a local garage | Edit currency and phone in `src/config/site.ts` |
| **Bookings saved to a JSON file** (`data/`, ignored by git) | No database needed to learn the full flow | Swap the storage module for a database (backlog) |
| **Admin login is one password** from the `ADMIN_PASSWORD` environment variable | One garage, a few staff: simple is enough | Add real accounts (backlog) |

## Task breakdown

Each task is one branch and one learning doc. Steps for each are in the [task tracker](../task/task.md).

| # | Task | Builds |
| --- | --- | --- |
| 06 | `06_app_setup` | The empty Next.js app with Tailwind, shadcn/ui and GSAP, and the site config file |
| 07 | `07_design_system` | Colors, fonts and spacing; the visual direction |
| 08 | `08_layout_shell` | Header, navigation, footer, sticky mobile action bar, 404 page |
| 09 | `09_home_page` | Home page sections and the hero animation |
| 10 | `10_services_pages` | Services list, service detail pages, packages page |
| 11 | `11_booking_form` | Booking form, saving bookings, confirmation page, tests |
| 12 | `12_contact_page` | Contact page, map, hours, estimate request form |
| 13 | `13_about_reviews_faq` | About, reviews and FAQ pages |
| 14 | `14_booking_tracking` | Track-a-booking page |
| 15 | `15_admin_dashboard` | Password-protected admin dashboard |
| 16 | `16_seo_and_polish` | SEO, structured data, sitemap, accessibility and performance check |
