# GoMechanic website: features

This is the product plan: who the site is for, what it does, and what's left for later. The full build plan (architecture and all tasks) is [document/plans/2026-10-24-gomechanic-master-plan.md](../plans/2026-10-24-gomechanic-master-plan.md). When a task adds or changes a feature, update this page in the same task.

## The garage

- **GoMechanic**: one garage in India that repairs **cars and two-wheelers**.
- The website lives at the **domain root** (`/`, `/services`, `/book`, `/account`, `/admin`).
- **English first**, built so Hindi can be added later without rework.
- **Look and feel:** clean and premium, like Apple's website, with smooth scroll animations (see "Design direction").
- **Not in version 1:** online payments and GST invoices.
- **Paid services** (OTP SMS, WhatsApp, email) use free stand-ins until the launch tasks.

**Owner decision pending:** "GoMechanic" is already a well-known Indian car-service brand. That's a trademark risk, and it makes ranking for the name hard. Decide before the logo (task 11) and the domain (task 42).

## Who uses it

| Role | What they do |
| --- | --- |
| **Customer** (car or bike owner) | Checks services and prices, books, tracks the job, approves estimates |
| **Owner / manager** | Runs the garage: bookings, prices, slots, estimates, staff, content |
| **Mechanic** | Updates assigned jobs and uploads photos from a phone (can't see customers' phone numbers) |

## Features

✅ = version 1 · 🔜 = later

### A. Public website
1. ✅ **Home:** what GoMechanic does, trust signals (years, vehicles serviced, rating, warranty), big **Book / Call / WhatsApp** buttons.
2. ✅ **Prices by vehicle:** pick type (car or two-wheeler) → brand → model → fuel (petrol, diesel, CNG, electric) and see that vehicle's prices ("from ₹…").
3. ✅ **Service packages:** Basic / Standard / Comprehensive, side by side with a checklist of what's included.
4. ✅ **Service pages:** periodic service, AC, denting and painting, battery, tyres and alignment, brakes, clutch and suspension, engine, electricals, wash and detailing, insurance claim help.
5. ✅ **About:** story, team, certifications, workshop photos, genuine parts (OEM/OES), warranty.
6. ✅ **Reviews** from customers with completed jobs; average rating on the home page.
7. ✅ **Offers and coupons.**
8. ✅ **Contact:** address, map and directions, hours with a live "Open now / Closed" label, emergency number, sticky Call / WhatsApp / Book bar on phones.
9. ✅ **FAQ:** payment methods at the garage, warranty, pickup and drop, how long jobs take.
10. ✅ **Click-to-WhatsApp** with a ready-made message.

### B. Customer account, booking and tracking
11. ✅ **Login with mobile number + OTP** (+91), no passwords; 18+ and consent checkboxes.
12. ✅ **My vehicles** with registration-number check (`MH12AB1234`, BH series), PUC and insurance dates.
13. ✅ **Book a service:** vehicle → services or package → **time slot from real availability** → **pickup and drop** (by pincode, with fee) → confirm, with a booking code.
14. ✅ **Free estimate request** with photo upload.
15. ✅ **Live job tracking:** a timeline with **mechanic photos and notes**.
16. ✅ **Online estimate approval:** itemised parts and labour (₹); the customer approves or rejects **each line**.
17. ✅ **Notifications** at each step (SMS, WhatsApp, email).
18. ✅ **Reminders:** service due, PUC expiry, insurance renewal (with opt-out).
19. ✅ **Service history** per vehicle; cancel or reschedule before the cutoff.
20. 🔜 Online payments (UPI, cards), GST invoices, referrals.

### C. Admin dashboard (owner, manager, mechanic)
21. ✅ **Bookings board** by date and status; phone and walk-in bookings; confirm, cancel, reschedule, assign a mechanic.
22. ✅ **Schedule:** hours, slot rules and capacity, holidays, pickup pincodes and fees.
23. ✅ **Mechanic job view on a phone:** status, notes and photos; the customer is notified automatically.
24. ✅ **Estimate builder:** part and labour lines, versions, send; record approvals given by phone.
25. ✅ **Customers and vehicles** (a simple CRM); **team and roles** (owner only).
26. ✅ **Content:** services, prices, packages, vehicle catalogue, offers, FAQ and garage info, all editable without code.
27. ✅ **Reviews** (reply or hide) and **reports** (bookings, approved value, top services, rating, mechanic workload; CSV export).
28. 🔜 Revenue and GST reports, spare-parts inventory.

### D. Built in everywhere
29. ✅ **Mobile-first, fast on 4G**; staff can add the admin dashboard to their phone's home screen.
30. ✅ **Local SEO:** metadata, canonical URLs, social preview image, sitemap, robots file, `AutoRepair` structured data.
31. ✅ **Automatic SEO review** after every change to pages (task 08).
32. ✅ **Ready for Hindi:** all text in translation files and translatable database fields.
33. ✅ **Privacy (DPDP Act 2023 and 2025 Rules):** consent history, privacy notice, delete-my-data, data export.
34. ✅ **Security:** customers see only their own data; mechanics only their assigned jobs. Tested.
35. ✅ **Accessibility:** keyboard use, contrast, reduced motion; automated checks.
36. 🔜 App-like install for customers (PWA), roadside-assistance dispatch, more branches.

## Design direction: Apple-like

The owner asked for an Apple-style site with smooth animation. Task 11 turns this into exact design tokens (`design-system/go-mechanic/MASTER.md`). The principles:

- **Calm and spacious:** white and very light grey (`#f5f5f7`-style) sections, near-black text, one blue accent for actions, and the occasional full-black "showcase" section.
- **Big, confident type:** a clean sans-serif (the system's San Francisco font on Apple devices, Inter elsewhere), very large headlines with tight letter-spacing, and short sentences.
- **One idea per screen:** a headline, one line of support text, two actions ("Book a service", "See prices"), and a big visual.
- **Rounded tiles** in a grid (Apple's "bento" layout) for services and trust points.
- **A frosted, translucent header** that stays at the top.
- **Scroll storytelling with GSAP:** text that fades and rises into place, a pinned section where the vehicle image scales while the story changes beside it, staggered tile reveals, and counting-up numbers. Smooth, never flashy.
- **Rules:** animate only transforms and opacity, never hide the main content until JavaScript runs, and show everything still when the visitor prefers reduced motion. Mobile gets simpler animations.

## Pages

| Path | Page |
| --- | --- |
| `/` | Home |
| `/services`, `/services/[slug]` | All services, one service |
| `/packages`, `/offers`, `/reviews`, `/about`, `/faq`, `/contact` | Info pages |
| `/estimate`, `/book`, `/login` | Free estimate, booking, login |
| `/privacy`, `/terms` | Legal |
| `/account/...` | Customer: vehicles, bookings, estimates, profile |
| `/admin/...` | Staff: bookings, jobs, estimates, customers, schedule, catalogue, offers, content, reviews, messages, reports, team |
