# 12_layout_shell: the frame around every public page

> **Branch:** `12_layout_shell` · **Date:** 2026-10-27 · **Status:** In progress

## In one minute

Every public page now sits inside the **site shell**. It has a frosted header with the Wordmark and "Book a service", a phone menu, and a footer with the garage's real address, phone, WhatsApp and hours. On phones, a Call / WhatsApp / Book bar is fixed to the bottom of the screen. A live "Open now / Closed" badge works in India time. Unknown URLs, old links like `/index.html` and pages that call `notFound()` all get a branded 404. The browser now gets only the text its client components need, and the home page is still built ahead of time. The owner approved the look from screenshots on 2026-10-27. Full details: [the plan](../plans/2026-10-26-1937-feat-layout-shell-plan.md) (R1–R14, KTD1–KTD12, units U1–U12) and the "Site shell" section of [MASTER.md](../../design-system/go-mechanic/MASTER.md).

## Why: the problem we solved

Before this task the site was a placeholder heading on a blank page. A visitor couldn't find the phone number, the address or the hours. An unknown URL showed an unstyled 404. Two other kinds of missing page got Next.js's bare error page: dotted URLs such as `/index.html`, and pages that call `notFound()`. The SEO checks in tasks 10 and 11 flagged both. Every page also sent the whole of `messages/en.json` to the browser.

Tasks 13 (home page), 14 (database), 18, 19 and 23 (services, about, contact, booking) all build on this frame. Three facts shaped it:

- **Most visitors use Android phones on 4G.** The phone bar and fast, prebuilt pages matter more than desktop polish.
- **The garage runs on India time; servers and some visitors don't.** "Open now" must be worked out in `Asia/Kolkata`, never in the computer's own time zone. The owner's computer runs on India time, so tests there would hide exactly that bug.
- **The pages the menu points to don't exist yet.** The shell must work with no broken links, and show each link once its page ships.

## What: what changed

| File or folder | Change | Why it exists |
| --- | --- | --- |
| `src/domain/opening-hours.ts` + test | Added | Pure logic: is the garage open at this moment, and if not, when does it open? Works in India time through `Intl` |
| `src/content/garage.ts` + test, `src/content/offer.ts` | Added | The owner's real details (phone, WhatsApp, address, PIN, hours) and the current offer (`null`) |
| `src/lib/contact-links.ts` + test | Added | Turns `+919764750567` into "+91 97647 50567", a `tel:` link and a `wa.me` link; checks numbers |
| `src/i18n/format.ts` + test | Changed | `formatWeekday`, `formatTimeOfDay`, `formatAddress` and `keepTogether` |
| `src/components/site/navigation.ts` + test | Added | Every page the shell can link to, with a `live` flag that a test ties to real files |
| `src/components/site/site-chrome.tsx` + test | Added | The frame itself, and the only code that reads `src/content/` (`readGarage()`) |
| `src/components/site/` `site-header`, `mobile-menu`, `site-footer`, `action-bar`, `offer-banner` (+ tests) | Added | The header, phone menu, footer, phone bar and offer band |
| `src/components/site/` `open-status`, `opening-hours-list`, `whatsapp-link`, `not-found-content` (+ tests) | Added | The live badge, the weekly hours, every WhatsApp link, and what both 404s show |
| `src/app/[locale]/(site)/layout.tsx`, `page.tsx`, `page.test.tsx` | Added, Moved | The route group that wraps public pages; the home page moved into it |
| `src/app/[locale]/not-found.tsx` | Added | The 404 for pages that call `notFound()`: a slim bar, not the full shell |
| `src/app/global-not-found.tsx` | Changed | The 404 for unknown URLs, now inside the full shell |
| `src/app/[locale]/layout.tsx` | Changed | `viewport-fit=cover`, and only the client messages go to the browser |
| `src/i18n/client-messages.ts` + test | Added | The list of namespaces the browser gets (`OpenStatus`), and a scan of every client file |
| `src/i18n/request.ts`, `request.test.ts` | Changed, Added | Falls back to English when the URL has no language (the global 404) |
| `src/proxy.ts`, `src/proxy.test.ts` | Changed, Added | The proxy skips listed file extensions only, so `/index.html` reaches the branded 404 |
| `src/app/globals.css` | Changed | Header and phone-bar height tokens, safe areas, scroll padding |
| `messages/en.json`, `src/i18n/messages.test.ts` | Changed | New namespaces: `Contact`, `Nav`, `Header`, `Hours`, `OpenStatus`, `Footer`, `ActionBar`, `Offer`, plus `NotFound.metaTitle` and `Common.skipToContent` |
| `eslint.config.mjs`, `src/i18n/lint-guards.test.ts` | Changed | Text typed into `label`/`*Label` props fails lint; the `next/link` exception for the global 404 is gone |
| `vitest.config.mts` | Changed | Tests run in UTC; next-intl is "inlined" so its `Link` loads |
| `playwright.config.ts`, `playwright.dev.config.ts`, `e2e/dev/warm-up.ts` | Changed, Added | The browser runs in UTC; the dev suite loads each page once before testing |
| `e2e/layout-shell.spec.ts`, `e2e/i18n.spec.ts` | Added, Changed | The shell on a production build |
| `src/app/[locale]/dev/design/page.tsx`, `src/lib/dev-only.test.ts` | Changed | A "Layout shell" section; dev pages put metadata in a `generateMetadata` that calls `devOnly()` first |
| `e2e/dev/shell-preview.spec.ts`, `e2e/dev/design-preview.spec.ts` | Added, Changed | Fit checks and screenshots under `next dev` |
| `CLAUDE.md`, `readme.md`, `MASTER.md`, the master plan, `task.md` | Changed | The shell's rules, and notes for tasks 13, 14, 15, 18, 19, 23, 28, 38 and 42 |
| `.claude/agents/seo-reviewer.md` | Changed | Its local example said "Hadapsar"; the garage is in Kiwale |

The first commit on the branch, `9e9310e docs(11): mark task 11 done`, is task 11's bookkeeping. That's why `document/learning/11_design_system.md` and two lines of `task.md` also differ from `main`.

## How: step by step

1. **Plan, and the owner's data.** The owner gave the details on 2026-10-26: phone and WhatsApp +91 97647 50567; "Mukai Chowk, Kiwale, Pune, Maharashtra"; open 10:00–19:00 every day except Monday. There's no current offer and no email. The PIN code, 412101, arrived after `ce-plan` had started, so it was added to the plan by hand before building. `ce-plan` then hung after its document review, for the third task in a row. This time the watcher from the [ce-plan hang lesson](../solutions/workflow-issues/ce-plan-child-session-hangs-use-idle-watcher.md) worked as designed. The review kept editing the plan from about 19:43 to 19:53, and the watcher reported "idle for 10 minutes" around 20:02. We stopped the process, and read the diff of the review's changes before using them.

2. **Opening hours as pure logic.** `src/domain/opening-hours.ts` has no Next.js or React imports, so it runs anywhere. Hours are plain data: each weekday is `"closed"` or `{ opens: "10:00", closes: "19:00" }`. Opening is **inclusive** and closing **exclusive**: open at 10:00:00, closed at 19:00:00. `openStatusAt(hours, instant)` answers "open, closes at …" or "closed, opens today / tomorrow / on Tuesday". It reads India's wall-clock time with `Intl.DateTimeFormat` and `timeZone: "Asia/Kolkata"`, never `date.getHours()` (the computer's zone) and never a typed `+05:30`. The tests were written first. Both test runners are pinned to UTC (`env: { TZ: "UTC" }` in `vitest.config.mts`, `timezoneId: "UTC"` in `playwright.config.ts`), because the owner's computer runs on India time and would hide a bug that uses the local zone.

3. **Garage details and contact links.** `src/content/garage.ts` holds the data, checked with `satisfies Garage`, so a typo fails `npm run typecheck`. Phone and WhatsApp are separate fields, both `+919764750567` today. A landline added later then can't break WhatsApp. The phone number is in the repo on purpose: it's the public business number on the website. `src/lib/contact-links.ts` builds what the page shows. Its display helpers never throw, because they run while a page renders: a number they can't group is shown as stored. Real output from Node 24 (it runs `.ts` files by stripping the types):
   ```bash
   fnm exec --using=24 -- node --no-warnings --input-type=module -e 'import { formatPhoneNumber, telHref, whatsappHref } from "./src/lib/contact-links.ts"; for (const n of ["+919764750567", "+912012345678"]) console.log(formatPhoneNumber(n), telHref(n)); console.log(whatsappHref("+919764750567", "Hi, I have a question about my vehicle."))'
   ```
   ```
   +91 97647 50567 tel:+919764750567
   +912012345678 tel:+912012345678
   https://wa.me/919764750567?text=Hi%2C%20I%20have%20a%20question%20about%20my%20vehicle.
   ```
   The second number is a Pune landline: it isn't a mobile, so it's shown as stored.

4. **One reader of content.** Only `SiteChrome` reads `src/content/`, through `readGarage()`. Every other component gets the garage as props. So `/dev/design` can show each part with demo data, and task 14 swaps one function for a database read.

5. **No broken links.** `src/components/site/navigation.ts` lists services, prices, about, contact and book, each with `live: false` today. The shell shows only live items. `navigation.test.ts` scans `src/app/[locale]/` for `page.tsx` files (route groups like `(site)` don't count as URL parts) and fails if a flag disagrees with the files, in either direction. Until `/book` exists (task 23), "Book a service" opens WhatsApp with a booking message already typed in.

6. **Header and phone menu.** `SiteHeader` is a server component: frosted, sticky, `z-40`, 56px tall (`--header-height`). Below 768px its links and button make way for `MobileMenu`, a small **client island** that only knows whether the Sheet is open. Its labels arrive as props (`openLabel`, `title`, `closeLabel`) and its content as server-rendered children. Building it showed a **lint gap**: `closeLabel="Close"` typed in English passed lint. Now props named `label` or ending in `Label` count as text people read (commit `5686d9d`). `aria-labelledby` holds an id, not text, so it isn't matched.

7. **"Open now", in the browser.** `OpenStatus` reads the clock with React's `useSyncExternalStore`. On the server, and while React takes over the server's HTML, the value is `null`. So the prebuilt HTML holds an empty row with a fixed minimum height (`min-h-6`), and the server's HTML always matches the browser's first render. The browser then fills in the badge. It checks again at the start of each minute, when the visitor comes back to the tab (`visibilitychange`), and when the page returns from the back/forward cache (`pageshow`).
   - **Why not on the server?** The master plan said `connection()` in a `<Suspense>` (the 16.4 docs now prefer `io()`). But the shell wraps every page, so part of every page would render on each visit. That means a server call per visit, and it would break the "prerendered" check on `/`. A status rendered by the server would also go stale in a tab left open.
   - **Trade-off:** a phone with the wrong time shows the wrong badge. The weekly hours next to it (plain server text) stay right.
   - **A fix from the screenshots:** in the narrow menu, "Opens tomorrow at 10:00" ended a line and "am" sat alone on the next one. `keepTogether()` now joins a time's words with no-break spaces (commit `561584c`).

8. **Footer, phone bar and offer banner.**
   - **`SiteFooter`:** a grey band with the Wordmark, the address with its PIN, phone and WhatsApp links, the hours with the badge and "Times are India time (IST)". There's no copyright year, because reading today's date would stop the page from being prebuilt.
   - **`ActionBar`:** below 768px only. Three equal cells with the icon above the label, like a phone's tab bar. At 320px a cell is 88px wide, and "WhatsApp" doesn't fit beside its icon. Book is the one blue button.
   - **`OfferBanner`:** returns `null` when there's no offer, so today there's no empty band.
   - **Every WhatsApp link** goes through `WhatsAppLink`. It opens a new tab with `rel="noopener noreferrer"` and tells screen readers "(opens WhatsApp)".

9. **Safe areas and scroll padding.** iPhones have rounded corners and a home indicator. The layouts export `viewport = { viewportFit: "cover" }`, which lets the page reach under them, and `env(safe-area-inset-*)` then keeps content clear. The gutter never gets thinner than the side insets, and the bar's bottom padding is `max(0.5rem, env(safe-area-inset-bottom))`. `--action-bar-height` adds up the bar's parts. It sizes a spacer after the footer, so the bar never covers the end of the page. It also sets `scroll-padding-bottom` on phones, as `scroll-padding-top` does for the header, so a focused control never hides under either bar.

10. **The `(site)` route group.** `src/app/[locale]/(site)/layout.tsx` wraps its pages in `SiteChrome`. The brackets keep "site" out of the URL, so `(site)/page.tsx` is still `/`. `/dev/design` stays outside with its own dev header, and `/admin` and `/login` can get their own frames later.

11. **Only client text goes to the browser.** With no `messages` prop, `NextIntlClientProvider` sends every message. Both layouts now pass `pickClientMessages(messages)`, which keeps only `OpenStatus`. `client-messages.test.ts` reads every `"use client"` file, and every `src/` file it imports, all the way down. It fails if one calls `useTranslations()` with no namespace, or with one that isn't listed.

12. **Two branded 404s.** Both show `NotFoundContent`: a heading, a short line, "Go to the home page", plus Call and WhatsApp. Their title is "Page not found | GoMechanic", built from `Brand.name`.
    - **Unknown URLs** get `global-not-found.tsx`. It's a whole document of its own, so it can carry the full shell without adding to other pages. It has no `[locale]` in its URL. In a production build, reading the root param gives nothing; under `next dev` the read fails with an error. So `request.ts` catches that and falls back to English. `unstable_rethrow(error)` first passes on Next.js's own signals (such as a `notFound()`), which are thrown errors too.
    - **Pages that call `notFound()`** get `[locale]/not-found.tsx`, with only a slim Wordmark bar. Next.js sends that file's content along with every page under `[locale]`, just in case. The plan found this in `create-component-tree.js`. The full header and footer there would ride along on every page.
    - **The title rule:** a `notFound()` thrown only from the page body keeps the page's own title. So `/dev/design` now has a `generateMetadata` that calls `devOnly()` first, and `dev-only.test.ts` requires that of every dev page.
    - **Not fixed, written down:** a page that calls `notFound()` *while it's prebuilt* (only `/dev/design` in production today) sends Next.js's bare error HTML (`<html id="__next_error__">`). Status 404 and `noindex` are right, but the branded content appears only once JavaScript runs. The e2e test checks it as it really is, and task 18 has a note to check its unknown-slug 404 with `curl`.

13. **Dotted URLs and the proxy.** Task 10's proxy skipped every path with a dot, so `/index.html` got the bare error page. The matcher now skips only paths ending in a listed extension:
    ```ts
    "/((?!api|_next|_vercel|.*\\.(?:svg|png|jpe?g|gif|webp|avif|ico|txt|xml|webmanifest|woff2?|ttf|otf|eot|js|css|map|pdf)$).*)",
    ```
    `(?!...)` means "unless the rest matches this". This reverses task 10's choice. The trade-off task 10's review raised was that a file type missing from the list would get a 404. `src/proxy.test.ts` closes it: it walks every file in `public/` (none yet) and every metadata file in `src/app/`, and asks Next.js's own matcher check whether the proxy would run for it. The bundled docs call that helper `unstable_doesProxyMatch`, but Next.js 16.4.3 exports only `unstable_doesMiddlewareMatch` (checked in `node_modules/next/dist/experimental/testing/server/`).

14. **A test-setup bump.** Tests that rendered a `Link` from `@/i18n/navigation` failed with "Cannot find module". next-intl imports `next/navigation` without `.js`, and Node refuses that for the `next` package. `server: { deps: { inline: ["next-intl"] } }` in `vitest.config.mts` makes Vite load next-intl instead of Node.

15. **`/dev/design` samples and screenshots.** The page got a "Layout shell" section: the header with every link live, the phone menu, each badge state, the bar in a 320px frame, an offer banner, the footer and the 404 content. `npm run test:design` also runs a new `e2e/dev/shell-preview.spec.ts`, which checks the fit at 320px and saves seven screenshots of the real shell (`test-results/design/screenshots/shell-*.png`, git-ignored). Three bumps:
    - **Viewport screenshots, not full-page.** Chrome's full-page capture dropped the touch emulation, so touch-sized links shrank, and it drew the fixed bar halfway down the page.
    - **A flaky dev suite.** `next dev` compiled a page while a test had another one open, and pushed the new code into it. React remounted the motion demo mid-test. `e2e/dev/warm-up.ts` (a Playwright `globalSetup`) now loads every page once before the tests.
    - **Alignment.** The 404 content and the home placeholder were 980px wide; the header and footer are 1280px. Both now use `<Section width="wide">`, so their left edges line up.

16. **The owner's look check (2026-10-27).** From the screenshots, the owner approved the shell as built and made four decisions. Keep the three-button phone bar, with Book opening WhatsApp until task 23. Keep the draft WhatsApp messages. The garage closes on some festival days: that's task 28's holiday calendar, so until then the badge may say "Open now" on those days. And the shell needs no other change.

17. **Docs and other bumps.** `CLAUDE.md` and MASTER.md gained the shell's rules, and `task.md` got the plan's follow-ups for later tasks. Two more things happened during the work:
    - The owner's computer slept mid-run, and a subagent stopped. It was resumed with its context, and no work was lost.
    - A subagent used `git mv`, which staged two moves despite the "no git changes" rule for agents. It reported this itself; it was harmless, and the main session committed the moves.

18. **Not done yet.** These steps come after this doc, so their results aren't in it:
    - **SEO check:** the SEO hook listed the changed page files, and the `seo-reviewer` agent checked `/`, the four URLs that share the global 404 (`/this-page-does-not-exist`, `/index.html`, `/contact.php`, `/hi`), `/dev/design` and `/icon.svg` on the production build. **All pass.** It confirmed the name, address and phone are real text in `<address>` and match `src/content/garage.ts` exactly, the layout shift is 0 at six widths, and `/` is still prerendered. Two suggestions were filed, not applied (repo rule): put the area in the home `h1` ("Car and bike service in Kiwale, Pune", task 13), and load the phone menu's code on first tap (about 32 KB gzipped on every page today, task 18).
    - **Review** (`ce-code-review`, then `code-reviewer`): *Pending.*
    - **Compound question:** *Pending.*
    - **Pull request and merge:** *Pending.*

## Decisions worth knowing

| Choice | Why | What it costs |
| --- | --- | --- |
| "Open now" in the browser | Pages stay prebuilt; no server call per visit; updates in an open tab | A wrong phone clock gives a wrong badge; no badge without JavaScript (the hours still show) |
| One reader of content (`readGarage()`) | Task 14 changes one function | Changing details today means a code change |
| `live` flags tied to page files by a test | No link to a missing page | Each page task flips one flag |
| Labels as props; only `OpenStatus` sent | Less text downloaded on every page | A client component must name and list its namespace |
| Slim bar on `[locale]/not-found.tsx` | Its content is sent with every page | `notFound()` pages get a lighter 404 than unknown URLs |
| Listed extensions in the proxy (reverses task 10) | `/index.html` gets the branded 404 | A new file type needs its extension. A missing file with a listed one (`/favicon.ico` today) still gets the bare 404 |
| Book opens WhatsApp until `/book` exists | The owner chose three buttons | Two of the bar's three buttons open WhatsApp for now |
| No `aria-current` on links yet | `usePathname` suspends under Cache Components, and no link is live | Task 18 adds it with the first live page |
| Holidays ignored until task 28 | Task 28 owns the holiday calendar | The badge can be wrong on a festival day |

## New ideas in this task

- **Layout shell:** the parts that stay the same on every page (header, footer, bars). Like a car's body: the engine changes, the frame stays.
- **Route group `(name)`:** a folder in brackets that groups pages under one layout without adding to the URL.
- **Client island:** a small `"use client"` component inside a server-rendered page. Only the island's code is sent to the browser for interactivity.
- **Hydration:** React taking over the HTML the server sent. If the browser's first render differs from that HTML, React reports a mismatch.
- **`useSyncExternalStore`:** React's way to read a value that lives outside React (here, the clock). You give it how to subscribe, how to read the value, and what the server should use.
- **Prerendered (○):** built once at build time and served as a file. `◐` is partly built ahead, with parts streamed per request.
- **Layout shift (CLS):** content jumping while a page loads. The empty, fixed-height badge slot prevents it.
- **E.164:** the international phone format, `+` then country code then number, no spaces: `+919764750567`.
- **Safe area:** the part of a phone screen not covered by rounded corners, a notch or the home indicator. `env(safe-area-inset-bottom)` is its size.
- **Scroll padding:** space the browser keeps clear when it scrolls something into view, so a sticky bar doesn't hide it.
- **Skip link:** a hidden link that appears on the first Tab and jumps past the header to `<main>`.
- **Proxy matcher:** the pattern that decides which URLs run through `src/proxy.ts`.
- **Root param:** a value from the top folder of the URL (here `[locale]`), read with `next/root-params`.
- **Inclusive / exclusive:** included in the range or not. Open at 10:00:00 (included), closed at 19:00:00 (excluded).
- **No-break space (U+00A0):** looks like a space, but a line never breaks there.

## Check that it works

Real output from the work session's final runs on 2026-10-27 (trimmed):

```bash
npm run check
```
```
 Test Files  32 passed (32)
      Tests  599 passed (599)
```

`npm run build` lists the routes. `○ /en` means the home page, now inside the shell, is still prebuilt:
```
Route (app)
┌ ○ /_not-found
├   /[locale]
│ ├ ◐ /[locale]
│ └ ○ /en
├   /[locale]/dev/design
│ ├ ◐ /[locale]/dev/design
│ └ ○ /en/dev/design
└ ○ /icon.svg
```

```bash
npm run test:e2e      # production build
```
```
  ✓   7 e2e/i18n.spec.ts:58:9 › pages that don't exist › a path with a dot (/index.html) gets the branded 404 (1.6s)
  ✓   9 e2e/i18n.spec.ts:80:7 › prerendering › the home page is built ahead of time, not rendered per request (1.1s)
  ✓  19 e2e/layout-shell.spec.ts:153:11 › the open status, in India time › on a device set to America/Los_Angeles › Tuesday 11:00 IST is still open (1.3s)
  ✓  21 e2e/layout-shell.spec.ts:160:7 › the open status, in India time › turns to closed at 19:00 IST while the page stays open (1.3s)
  ✓  33 e2e/layout-shell.spec.ts:331:7 › the browser gets only the client components' messages › the page data on / holds the OpenStatus messages, not the home page's or the metadata's (933ms)
  41 passed (31.7s)
```

```bash
npm run test:design   # /dev/design and the shell under next dev, plus screenshots
```
```
  ✓  20 e2e/dev/shell-preview.spec.ts:80:9 › home page on a 320px phone › every phone bar label fits inside its button (16.2s)
  ✓  27 e2e/dev/shell-preview.spec.ts:168:9 › an unknown URL on a 375px phone › shows the branded 404 inside the full shell, without console errors (9.1s)
  28 passed (1.6m)
```

For this doc I re-ran the four key unit-test files (opening hours, proxy, navigation, client messages):
```bash
npx vitest run src/domain/opening-hours.test.ts src/proxy.test.ts src/components/site/navigation.test.ts src/i18n/client-messages.test.ts
```
```
 Test Files  4 passed (4)
      Tests  79 passed (79)
```

To look for yourself, run `npm run dev` and open http://localhost:3000 (try a phone width in DevTools), then http://localhost:3000/index.html.

## Common mistakes

- **Reading cookies, headers or the time in the shell.** Every public page would render per visit. Use a `<Suspense>` slot or a client island (task 15's login entry).
- **`date.getHours()` or a typed `+05:30`.** Wrong on a UTC server. Use `Intl` with `GARAGE_TIME_ZONE`; the UTC test setup catches it.
- **A new page without its `live` flag** (or the flag without the page). `navigation.test.ts` fails. Change both in one commit.
- **A new public page outside `(site)`.** It gets no header or footer.
- **`useTranslations()` with no namespace in a client component**, or a namespace that isn't in `clientNamespaces`. The browser shows the raw key. Pass the text as a prop, or list the namespace.
- **The full shell in `[locale]/not-found.tsx`.** It would ship with every page.
- **`notFound()` only in a page body.** The 404 keeps the page's own title. Call it in `generateMetadata` too.
- **A new file type in `public/`** (say `.json`) without its extension in `src/proxy.ts`. It would 404; `proxy.test.ts` tells you.
- **Checking a prebuilt `notFound()` page only in a browser.** JavaScript hides the bare HTML. Check with `curl` as well.
- **A dev spec visiting a new page** that isn't in `e2e/dev/warm-up.ts`. The suite gets flaky again.

## Try it yourself

About 10 minutes. Predict each answer first, and finish with `git status` showing a clean tree.

1. In `src/components/site/navigation.ts`, set `live: true` on `services`. Run `npx vitest run src/components/site/navigation.test.ts`. Revert.
2. Create `public/prices.json` containing `{}`. Run `npx vitest run src/proxy.test.ts`. Delete the `public/` folder.
3. Without running anything, what does the badge say at each of these India times? Tuesday 09:59, Monday 12:00, Sunday 19:30. Then find the answers in `e2e/layout-shell.spec.ts` ("the open status, in India time").

Answers. (1) and (2) are from a real run in a throwaway copy of the repo, so nothing in the repo was edited:
```
 FAIL  |node| src/components/site/navigation.test.ts > the navigation registry > /services is live exactly when its page.tsx exists
AssertionError: /services has live: true, but its page.tsx doesn't exist: expected true to be false // Object.is equality
      Tests  1 failed | 12 passed (13)
```
```
 FAIL  |node| src/proxy.test.ts > the proxy matcher (src/proxy.ts) > skips every file in public/ (the folder may not exist yet)
AssertionError: add these files' extensions to the matcher in src/proxy.ts: expected [ '/prices.json' ] to deeply equal []
```
(3) From the e2e run: "Closed · Opens today at 10:00 am" (09:59 is before opening), "Closed · Opens tomorrow at 10:00 am" (Monday is closed all day) and "Closed · Opens Tue at 10:00 am" (19:30 is after closing, and Monday is skipped). The tests set the clock with Playwright's `page.clock.setFixedTime`, so they give the same answer whenever they run.

## Learn more

- Next.js (read the bundled copy first, in `node_modules/next/dist/docs/01-app/03-api-reference/`): [route groups](https://nextjs.org/docs/app/api-reference/file-conventions/route-groups), [`not-found` and `global-not-found`](https://nextjs.org/docs/app/api-reference/file-conventions/not-found), [proxy and its matcher](https://nextjs.org/docs/app/api-reference/file-conventions/proxy), [`generateViewport`](https://nextjs.org/docs/app/api-reference/functions/generate-viewport).
- React: [`useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore).
- next-intl: [server and client components](https://next-intl.dev/docs/environments/server-client-components) (why client messages are trimmed).
- MDN: [`env()`](https://developer.mozilla.org/en-US/docs/Web/CSS/env), [`scroll-padding`](https://developer.mozilla.org/en-US/docs/Web/CSS/scroll-padding), [`Intl.DateTimeFormat.formatToParts()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/formatToParts).
- Playwright: [fixing the clock](https://playwright.dev/docs/clock) and [emulating a time zone](https://playwright.dev/docs/emulation#locale--timezone).
