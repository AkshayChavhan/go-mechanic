# Design system: MASTER

The site's look in one place: principles, tokens and rules. Built in task 11 ([plan](../../document/plans/2026-10-26-1312-feat-design-system-plan.md)).

- **Status:** approved by the owner on **2026-10-26**, as built, with no changes.
- **Site shell** (header, phone menu, footer, phone action bar, 404; task 12, [plan](../../document/plans/2026-10-26-1937-feat-layout-shell-plan.md)): approved by the owner on **2026-10-27** from screenshots, as built.
- **Home page and page blocks** (task 13, [plan](../../document/plans/2026-10-27-1344-feat-home-page-plan.md)): the look and the draft copy approved by the owner on **2026-10-27** from `next dev` and production screenshots, as built. See "Page blocks and scroll motion" below.
- **The code wins.** The tokens live in [`src/app/globals.css`](../../src/app/globals.css) and [`src/lib/motion.ts`](../../src/lib/motion.ts). This page describes them for people. If the two ever disagree, the code is right and this page needs fixing.
- **See it live:** `npm run dev`, then open http://localhost:3000/dev/design. It's the living catalogue: every token, type style and component, with real garage copy and live contrast numbers. Production builds answer that address with a 404.
- **Page overrides:** if one page ever needs different rules, write them in a `pages/` folder next to this file (`pages/<page>.md`). They override this page for that page only. There are none yet.

## Principles

From the owner's brief ([features.md, "Design direction"](../../document/website/features.md)):

- **Calm and spacious.** White and light grey bands, near-black text, generous space between sections.
- **One blue, for actions only.** Status uses green, errors red. Headings and labels are never blue.
- **Big, confident type.** Large, tightly set headlines; short sentences; 17px running text.
- **Flat tiles.** Rounded tiles set apart by their fill, not by shadows. Shadows only for layers that float over the page.
- **Thumb-friendly.** Every control at least 44px tall on touch screens.
- **Motion that respects the visitor.** Content is visible before JavaScript runs, and visitors who ask for less motion get none.
- **Fast on 4G.** One preloaded font file; the Hindi font downloads only for Hindi text.

## Colour

Colours use shadcn's variable names, so components need no colour classes of their own. Use them as classes: `bg-background`, `text-muted-foreground`, `border-input`.

### Three surface tones

A page is a stack of sections. Each one has a tone, set by the `Section` component (`src/components/site/section.tsx`), never by hand:

| Tone | `Section` prop | What changes |
| --- | --- | --- |
| White page | `tone="white"` (default) | Nothing: the `:root` values below |
| Grey band | `tone="grey"` | Background `#f5f5f7`, tiles (`--card`) turn white, muted fills `#e8e8ed` |
| Black showcase | `tone="dark"` | Background black, text light, colours lightened (right-hand column below) |

A white `Section` nested inside a grey band stays grey: it inherits the band. Use a `Card` for a white tile there.

### Tokens

| Token | White page | Black showcase | Use |
| --- | --- | --- | --- |
| `--background` | `#ffffff` | `#000000` | The section's surface (grey band: `#f5f5f7`) |
| `--foreground` | `#1d1d1f` | `#f5f5f7` | Text |
| `--card` / `--card-foreground` | `#f5f5f7` / `#1d1d1f` | `#1d1d1f` / `#f5f5f7` | Tiles (grey band: white tiles) |
| `--popover` / `--popover-foreground` | `#ffffff` / `#1d1d1f` | `#1d1d1f` / `#f5f5f7` | The sheet, menus |
| `--primary` / `--primary-foreground` | `#0071e3` / `#ffffff` | same | The main button. Actions only |
| `--primary-hover` | `#0060c0` | same | Main button on hover: darker, so white text keeps 4.5:1 |
| `--secondary` / `--secondary-foreground` | `#e8e8ed` / `#1d1d1f` | `#2c2c2e` / `#f5f5f7` | Second buttons |
| `--muted` / `--muted-foreground` | `#f5f5f7` / `#636366` | `#1d1d1f` / `#98989d` | Quiet fills / secondary text (grey band: `--muted` `#e8e8ed`) |
| `--accent` / `--accent-foreground` | `#e8e8ed` / `#1d1d1f` | `#2c2c2e` / `#f5f5f7` | Hover washes |
| `--destructive` / `--destructive-foreground` | `#d70015` / `#ffffff` | `#ff453a` / `#000000` | Errors; solid destructive buttons and badges |
| `--success` / `--success-foreground` | `#007a33` / `#ffffff` | `#30d158` / `#000000` | Status only ("Open now"), never actions |
| `--link` | `#0066cc` | `#2997ff` | Text links. Darker than `--primary`, which is too light for small text on grey |
| `--border` | `#d2d2d7` | `#424245` | Decorative hairlines (no contrast minimum) |
| `--input` | `#808085` | same | Field borders: 3:1 on every surface |
| `--ring` | `#0071e3` | `#2997ff` | The focus outline |

`--chart-*` and `--sidebar-*` are defined for future shadcn components, mapped to the same neutrals and blue. The site is light-only: there is no dark mode that follows the phone's setting.

### Contrast

Text needs **4.5:1** and field borders and focus outlines **3:1** (WCAG AA). `src/app/design-tokens.test.ts` checks every pair in every tone on `npm run check`, including the see-through fills components use. The closest pairs, measured from `globals.css`:

| Pair | White | Grey | Black |
| --- | --- | --- | --- |
| `--foreground` on `--background` | 16.83 | 15.46 | 19.29 |
| `--muted-foreground` on `--background` | 5.99 | 5.50 | 7.31 |
| `--muted-foreground` on `--muted` | 5.50 | 4.90 | 5.86 |
| `--primary-foreground` on `--primary` | 4.70 | 4.70 | 4.70 |
| `--link` on `--background` | 5.57 | 5.11 | 6.96 |
| `--link` on `--card` | 5.11 | 5.57 | 5.58 |
| `--destructive` on `--card` | 4.94 | 5.38 | 4.94 |
| `--destructive-foreground` on `--destructive` | 5.38 | 5.38 | 6.16 |
| `--success` on `--card` | 5.03 | 5.48 | 8.32 |
| `--input` on `--muted` (needs 3:1) | 3.61 | 3.22 | 4.28 |
| `--ring` on `--card` (needs 3:1) | 4.31 | 4.70 | 5.58 |

A colour that fails gets a darker or lighter shade of the same colour, never a new colour.

## Type

### Fonts

Set up in `src/app/fonts.ts`; the stacks are in `globals.css`.

| Stack | Fonts, in order | Used by |
| --- | --- | --- |
| `--font-sans-stack` (`font-sans`, `font-heading`) | San Francisco on Apple devices (`-apple-system`, `BlinkMacSystemFont`), then Inter, then Noto Sans Devanagari | All text |
| `--font-brand-stack` (`font-brand`) | Inter, then Noto Sans Devanagari | The wordmark only, so the logo looks the same everywhere |

- **Inter** (`latin`) is the only preloaded file. Its `latin-ext` file (with the ₹ sign) loads only when a ₹ appears.
- **Noto Sans Devanagari** is never preloaded. The browser downloads it only for Hindi text. It must stay after Inter: it also covers ₹.

### Scale

Text sizes come only from these `type-*` classes (see the rule below). Sizes grow with the screen and with browser zoom (`clamp()` with a `rem` part); letter-spacing is in `em`.

| Class | Size (375 to 1440px) | Weight | Line height | Tracking | Use |
| --- | --- | --- | --- | --- | --- |
| `type-hero` | 48 to 88px | 600 | 1.05 | -0.025em | The home page hero only |
| `type-display` | 40 to 64px | 600 | 1.07 | -0.02em | Showcase headlines |
| `type-headline` | 32 to 48px | 600 | 1.1 | -0.015em | Section headings |
| `type-title` | 24 to 32px | 600 | 1.15 | -0.01em | Tile and card titles |
| `type-lead` | 19 to 24px | 400 | 1.4 | -0.01em | The line under a headline |
| `type-body` | 17px | 400 | 1.5 | -0.01em | Running text (set on `body`), fields, main buttons |
| `type-callout` | 15px | 400 | 1.45 | -0.005em | Secondary text, small buttons, cards |
| `type-caption` | 13px | 400 | 1.4 | 0 | Fine print. Nothing smaller |

- **Hindi** (`lang="hi"`): every `type-*` class drops its negative letter-spacing and gets taller lines (hero and display 1.25, headline 1.3, title 1.35, lead 1.6, body 1.75, callout 1.7, caption 1.6). Negative tracking breaks the line that joins Devanagari letters.
- **Headings** read better with `text-balance` (no single word left on the last line); leads with `text-pretty`.
- **Line length:** keep running text under about 75 characters (`max-w-2xl` at body size).

### The text-size rule

Text size comes only from `type-*` classes. Tailwind writes stock classes after the `type-*` classes in the CSS, so on the same element the stock class wins, and `cn()` doesn't know they clash.

- **Banned:** stock `text-*` sizes, and `leading-*` or `tracking-*` next to a `type-*` class, except inside a component's own definition (such as Wordmark's tracking).
- **Allowed:** a weight next to a `type-*` class (`type-callout font-semibold`, Button's `font-medium`). It wins, which is the point: that's how to emphasise text.
- **Two `type-*` classes:** never on one element. The later one in Tailwind's CSS order wins (body, callout, display, headline, hero, lead, title, caption), whatever order you write them in. So don't pass a `type-*` class to a component that sets its own (Button, Card, CardTitle, CardDescription, Input): `<CardTitle className="type-headline">` silently stays `type-title`.
- **Components:** a `type-*` class passed to a component doesn't beat stock sizes the component sets itself. Badge, Sheet, Field and Label keep shadcn's sizes until a task restyles them, so change a component's size through its variant or size prop.

Lint enforces the stock sizes (`text-xs` to `text-9xl`, with or without prefixes like `md:`) in `src/app` and `src/components` (not `ui/` or dev pages). It does **not** catch these, so reviewers check them by hand:

- arbitrary sizes such as `text-[17px]`;
- `leading-*` or `tracking-*` stacked on a `type-*` class.

## Space and layout

| Token | Value | Use |
| --- | --- | --- |
| `--section-space` | 64 to 128px (`clamp(4rem, 2.5rem + 6vw, 8rem)`) | Above and below every section (`py-(--section-space)`) |
| `--gutter` | 20 to 40px (`clamp(var(--gutter-min), 0.75rem + 2vw, 2.5rem)`), never less than the side safe areas | The sides of the content (`px-(--gutter)`) |
| `--gutter-min` | 20px | The gutter on the narrowest phones. `/dev/design` uses it to draw the phone bar as a 320px phone shows it |
| `--container-content` | 980px (`max-w-content`) | Text and most sections |
| `--container-wide` | 1280px (`max-w-wide`) | Grids and galleries |

`Section` (`src/components/site/section.tsx`) applies the section space, the gutter and the two widths: `<Section tone="grey" width="wide">`. The content box is centred, and the gutter sits outside its maximum width.

**Safe areas.** The root layout and `global-not-found.tsx` set `viewportFit: "cover"`, so the page reaches under an iPhone's rounded corners, notch and home indicator. `env(safe-area-inset-*)` (0 on other screens) keeps content clear of them: in `--gutter` for the sides (a phone turned sideways) and in the action bar's bottom padding.

### Site shell tokens

For the parts in "Site shell" below.

| Token | Value | Use |
| --- | --- | --- |
| `--header-height` | 56px | The sticky header's height (`h-(--header-height)`), and the 404's slim bar |
| `--action-bar-item-height` | 54px | Each phone-bar button: a 16px icon over a 15px label |
| `--action-bar-padding-top` | 8px | Space above the phone-bar buttons |
| `--action-bar-padding-bottom` | `max(0.5rem, env(safe-area-inset-bottom))` | Space below them; grows to clear the iPhone home indicator |
| `--action-bar-height` | 1px border + the three above | The whole bar. Sizes the spacer after the footer and the scroll padding |
| `--stage-height` | `100svh` minus `--header-height`; below 768px also minus `--action-bar-height` | The screen left for the page between the bars: the most a full-height section or a sticky visual takes (the home hero on large screens, the story's picture). `svh`: it doesn't jump when a phone's address bar hides |

**Scroll padding** on `html`: `scroll-padding-top` is the header's height plus 8px; below 768px, `scroll-padding-bottom` is the bar's height plus 8px. When the browser scrolls to an anchor (`#main`) or a focused control, it stops clear of both bars, so neither hides the focus outline.

**Full-height and sticky sections** (task 13): size them with `--stage-height` and stick them at `top-(--header-height)`, so on phones they start below the header and end above the phone bar.

## Shape and depth

| Class | Value | Used by |
| --- | --- | --- |
| `rounded-sm` | 6px | Small accents |
| `rounded-md` | 10px | Menu items |
| `rounded-lg` | 12px | Fields, popovers |
| `rounded-xl` | 18px | Cards and tiles |
| `rounded-2xl` | 24px | Large panels |
| `rounded-3xl` | 28px | Framed bands |
| `rounded-4xl` | Pill (9999px) | Badges |
| `rounded-full` | Pill | Buttons (set in `button.tsx`) |

- **Elevation:** tiles, cards, fields and bands are flat (`shadow-xs` is none). `shadow-sm`, `shadow-md` and `shadow-lg` are soft layered shadows for things that float: popovers, menus, the sheet, the skip link and the phone action bar.
- **Frosted:** the `frosted` class is the background at 72% with a blur, for the header. It falls back to a solid background where blur isn't supported or the visitor asks for less transparency. Put only `--foreground` text on it.
- **Stacking** (`z-*`), lowest first: the page; the sticky header and the phone action bar (`z-40`); the skip link while it has focus (`z-45`); the sheet and its overlay (`z-50`, set in `sheet.tsx`). A new floating layer takes its place in this list.

## Motion

| Token | CSS | GSAP (`@/lib/motion`) | Use |
| --- | --- | --- | --- |
| fast | `--duration-fast` 150ms | `duration.fast` 0.15 | Press and hover feedback |
| base | `--duration-base` 250ms | `duration.base` 0.25 | Menus, small transitions (the default for `transition-*` classes) |
| slow | `--duration-slow` 450ms | `duration.slow` 0.45 | Sheets and overlays |
| reveal | `--duration-reveal` 800ms | `duration.reveal` 0.8 | Scroll reveals |
| standard | `ease-standard` `cubic-bezier(0.33, 1, 0.68, 1)` | `power2.out` | Most motion (the default) |
| emphasized | `ease-emphasized` `cubic-bezier(0.22, 1, 0.36, 1)` | `power4.out` | Big entrances |
| exit | `ease-exit` `cubic-bezier(0.32, 0, 0.67, 0)` | `power2.in` | Things leaving (shorter than entering) |

- CSS and GSAP share these values; `src/lib/motion.test.ts` keeps them equal.

GSAP-only values for the scroll scene (task 13), also in `@/lib/motion`. CSS never moves things this way, so it has no copy:

| Name | Value | Use |
| --- | --- | --- |
| `distance.reveal` | 24px | How far a reveal rises into place, from 768px up |
| `distance.revealPhone` | 12px | The same on phones (below 768px) |
| `distance.stagger` | 0.08s | Between tiles that reveal together (phones don't stagger) |
| `distance.storyScale` | 0.9 | Where the story's picture starts; it grows to 1, never past it |
| `countDuration` | 1.6s (twice `duration.reveal`) | A number counting up |
| `storyQuery` | `(min-width: 64rem) and (min-height: 40rem)` | Large screens: the story's two columns and sticky picture. The same query is the `story:` variant in `globals.css` |
| `phoneQuery` | `(width < 48rem)` | Phones: below Tailwind's `md`, where the action bar shows |
- **Reduced motion:** when the visitor asks for less motion, every CSS animation and transition jumps to its end (0.01ms). GSAP code wraps its animations in `gsap.matchMedia()` with `motionAllowed` and `motionReduced` from `@/lib/motion`, and shows the end state for `motionReduced`. See `src/app/[locale]/dev/design/_components/motion-demo.tsx`.
- Animate only transforms and opacity. Never hide content until a script runs.

## Components

shadcn/ui components live in `src/components/ui/`. Ours are in `src/components/site/`. Every edited shadcn file starts with an "Our changes to shadcn's ..." comment, and `src/components/ui/restyle.test.tsx` fails if `shadcn add --overwrite` undoes them.

- **Touch targets:** buttons and fields are 44px tall (`lg` 48px). The `sm` (36px) and `xs` (32px) buttons and their icon sizes grow to 44px on touch screens (`pointer-coarse:`). Icon-only buttons are 44px wide and always have an `aria-label`.
- **Buttons:** pills. One `default` (blue) button per group; the others use `secondary`, `outline` or `ghost`. `link` uses `--link`. `destructive` is a solid red fill. A busy button is `disabled` with a spinning `LoaderCircleIcon`.
- **Focus:** a solid 2px `--ring` outline, 2px away from the control, on every link, button, ARIA widget and field. It's one rule outside any `@layer` in `globals.css`.
- **Fields:** 44px tall, 17px text (iOS zooms into anything under 16px), `--input` border. Use `FieldGroup` and `Field`; labels above, errors below with `FieldError`, written to say how to fix the problem.
- **Checkbox field** (`CheckboxField`, `src/components/site/checkbox-field.tsx`, task 15): a native `<input type="checkbox">` inside its `<label>`, as one row at least 44px tall, so pressing anywhere on the row ticks the box. Not shadcn's Checkbox: that's a Radix button, 16px, which can't be ticked before JavaScript loads. The box is 20px, blue when ticked (`accent-primary`), centred on the label's first line (`h-lh`); the label is `type-body`. An error sits under the label's text (`FieldError`) and gives the box `aria-invalid`, a red outline and `aria-describedby`. Every other prop (`name`, `required`, `defaultChecked`...) goes to the `<input>`. The 44px check in `e2e/dev/design-preview.spec.ts` measures the row, not the box.
- **Cards:** flat tiles, `rounded-xl`, `type-callout` text, `type-title` titles.
- **Badges:** pills. `success` for status (open now), `secondary` for a normal state such as closed, `destructive` for problems. Their text is still shadcn's 12px, under the 13px floor; a backlog task restyles it.
- **Sheet:** `closeLabel` is required whenever the close button shows: pass `t("close")` from the `Common` messages.
- **Section:** every page section, for its tone, spacing and width.
- **Wordmark:** the only place code shows the brand name (see below).

## Site shell

The frame around every public page (task 12). Pages in `src/app/[locale]/(site)/` get it from that folder's `layout.tsx`; the components are in `src/components/site/`.

| Component | What it does |
| --- | --- |
| `SiteChrome` (`site-chrome.tsx`) | The frame, in order: skip link, header, offer banner, the page in `<main id="main">`, footer, action bar, then a phone-only spacer the bar's height. It gets the garage as a prop (`garage`) from its callers, the `(site)` layout and `global-not-found.tsx`, which read it from the database with `readGarage()` (`src/server/dal/garage.ts`; the home page and both 404 pages call it too). It reads the offer and `navigation.ts` itself, and passes all of them down as props |
| `SiteHeader` (`site-header.tsx`) | Frosted, sticky. The Wordmark links home; from 768px, the live page links and one blue "Book a service"; below 768px, the menu button |
| `MobileMenu` (`mobile-menu.tsx`) | Client island: the menu button and the sheet that slides in. Only holds the open state |
| `MobileMenuContent` (`site-header.tsx`) | What the menu holds: live page links, open status, hours, address, Call and WhatsApp. Rendered on the server, passed to `MobileMenu` as children |
| `SiteFooter` (`site-footer.tsx`) | A grey band: Wordmark, address, phone, WhatsApp, the hours with the open status, and the live page links once there are any. No copyright year (reading the date would stop prerendering) |
| `ActionBar` (`action-bar.tsx`) | The phone bar: Call, WhatsApp, Book (rules below) |
| `OfferBanner` (`offer-banner.tsx`) | A grey line under the header with the current offer; scrolls away with the page. Renders nothing when there's no offer (today). Links only to a live page |
| `OpenStatus`, `OpenStatusView` (`open-status.tsx`) | Client island: the "Open now" / "Closed" badge and the next opening, in India time (rules below). `OpenStatusView` draws one given status, for `/dev/design` |
| `OpeningHoursList` (`opening-hours-list.tsx`) | The week, with days of equal hours joined ("Tuesday to Sunday"), and "Times are India time (IST)". Plain server text: readable without JavaScript |
| `WhatsAppLink` (`whatsapp-link.tsx`) | Every `wa.me` link: opens a new tab (`noopener noreferrer`), shows a chat icon and tells screen readers "(opens WhatsApp)" |
| `NotFoundContent` (`not-found-content.tsx`) | Both 404 pages: heading, a short explanation, a blue "Go to the home page" and secondary Call and WhatsApp. Under the full shell for unknown URLs (`global-not-found.tsx`), under a slim Wordmark bar after `notFound()` (`[locale]/not-found.tsx`) |

- **Server components fed by props.** Everything but the two islands renders on the server and takes the garage, the live links and the Book target as props, so `/dev/design` shows each part with demo data. `SiteChrome` takes the garage as a prop too (since task 14): the page or layout around it reads it from the database, so the components never touch the database.
- **Client islands get labels as props.** A `"use client"` component gets its labels as props (`MobileMenu`'s `openLabel`, `title`, `closeLabel`) and its content as children from a server parent. Only the namespaces in `src/i18n/client-messages.ts` reach the browser (`OpenStatus` today), and `client-messages.test.ts` fails if a client file reads another.
- **Pages without the shell** (`/login`, `/dev/outbox`; task 15): the 404's slim bar (a bottom border, the Wordmark linking home, `--header-height` tall), then a `Section width="wide"` whose content column starts at the Wordmark's left edge. `/login` keeps the visitor on one job: no header links, footer or phone bar.
- **Only live links.** `navigation.ts` lists every page with a `live` flag, and the shell shows only live ones, so no link leads to a missing page. A page task sets its flag in the same commit as its page; `navigation.test.ts` checks every flag against the real `page.tsx` files.
- **Open now** is worked out in the browser, so pages stay prerendered. The prebuilt HTML holds an empty slot of the badge's height (no layout shift); the badge appears when React starts and updates every minute. Green `success` "Open now"; grey `secondary` "Closed", because closed is normal. The weekly hours always sit next to it, in case the visitor's clock is wrong. Festival closures (Diwali, Ganeshotsav) aren't known until task 28, so the badge can say "Open now" on those days.

### Phone action bar

- **Phones only:** below 768px (`md:hidden`). From 768px the header has "Book a service" and the footer has the phone and WhatsApp.
- **Three buttons, one blue:** Call and WhatsApp `secondary`, Book `default`. Until `/book` exists (task 23), Book opens WhatsApp with the booking message (owner, 2026-10-27).
- **Tab-bar layout:** three equal columns, each icon above its label. At 320px "WhatsApp" doesn't fit beside its icon.
- **Safe area:** the bottom padding grows to clear the iPhone home indicator (`--action-bar-padding-bottom`).
- **Never covers the page:** a spacer of `--action-bar-height` follows the footer, and the scroll padding keeps focused controls above the bar.
- **Floats, but never moves:** solid `bg-background`, top border, `shadow-md`, `z-40`. No animation, so reduced motion needs nothing extra.

## Page blocks and scroll motion

The home page (task 13) is built from Server Component sections and one client island, `ScrollScene`, which adds the scroll motion in the browser. The sections live in `src/app/[locale]/(site)/_components/`; the reusable pieces below live in `src/components/site/`, for the service, about and review pages to reuse. Every one has a sample on `/dev/design` ("Page blocks").

| Component | What it does |
| --- | --- |
| `VehicleIllustration` (`vehicle-illustration.tsx`) | A car and a scooter in line art, inline (no network request), in `currentColor` so it suits every tone, hidden from screen readers. The stand-in for photos: no stock photos, which would pretend to be the garage (owner, 2026-10-27) |
| `VisualSlot` (`visual-slot.tsx`) | A fixed 16:10 box (`rounded-2xl`, `bg-card`), so nothing moves when a photo arrives. With a photo (a static import), `next/image` fills it with `fill`, `sizes` and a blurred preview; the photo's alt text joins `messages/en.json` with the photo. Without one, the illustration. `eager` (the hero's slot only) loads the photo with `loading="eager"` and `fetchPriority="high"`, never the deprecated `priority` |
| `ServiceTile` (`service-tile.tsx`) | A flat `Card`: icon, `h3` name, one-line summary, and which vehicles it's for. Not a link, so no hover effect, until task 18 adds the service pages. Every service id needs an icon (a `Record` over the ids: typecheck fails otherwise) |
| `StatTile` (`stat-tile.tsx`) | One trust stat inside a `<dl>`: the label in `dt`, the number in `dd`, built for accessible counting (below) |
| `ReviewCard` (`review-card.tsx`) | Stars (hidden from screen readers, which hear "Rated 4 out of 5"), the words in a `blockquote`, and the credit. A sample is credited to a vehicle, never a name |
| `SampleBadge` (`sample-badge.tsx`) | The "Sample" pill (`Badge`, secondary) on every made-up stat and review |
| `ScrollScene` (`scroll-scene.tsx`) | The client island a page wraps its sections in: a plain wrapper `div` around them, which loads the effects lazily (below) |
| Effects (`scroll-scene-effects.tsx`) | The animations. The only file outside the dev pages that imports GSAP (`src/lib/gsap-imports.test.ts` checks) |
| Attributes (`scroll-scene-attributes.ts`) | The attribute names, plus `sceneMark("reveal")`, `sceneCount(5000)` and `sceneSelector(...)` for marking markup and finding it |

### Samples: `npm run dev` only

Made-up trust stats and reviews let the owner judge the design before the real ones exist. They must never reach customers (owner, 2026-10-27):

- `src/content/home.ts` holds the real data (`trustStats`, `reviews`: `null` until there is some) and the samples. Pages read it only through `selectTrustStats()` and `selectReviews()`: the real data in every build, else the samples when `showSamples()` (`src/lib/samples.ts`) says so, else `null`, and a section given `null` renders nothing.
- `showSamples()` is true only when `NODE_ENV` is `development`. It's deliberately separate from `devOnly()`, whose comment invites showing dev pages on a staging server: staging must never show samples.
- Each sample stat and review carries `data-sample` and a `SampleBadge`. `e2e/home.spec.ts` searches a production build's HTML, page data and every script the page loads for the sample text (a canary phrase in one sample review included).

### What `ScrollScene` animates

Server markup marks elements with these attributes. The effects find them inside the `ScrollScene` only, so a section holds no animation code, and another page gets scroll motion by wrapping its sections and marking them.

| Mark (`sceneMark(...)`) | Put it on | What happens, with motion allowed |
| --- | --- | --- |
| `reveal` | A heading block, paragraph, tile or visual | Fades and rises into place the first time it scrolls into view |
| `revealGroup` | A list or grid | Its direct children reveal like `reveal`, one after another (from 768px) |
| `sceneCount(value, decimals)` | The digits of a number, nothing else, inside the hidden counting copy | Counts up from 0 the first time it scrolls into view |
| `story` | The story section | Holds the two below |
| `storyVisual` | The wrapper in the sticky column | Grows from `distance.storyScale` to 1 as the story scrolls past (large screens) |
| `storyStep`, `storyRail` | Each step, and the vertical line inside it | The line fills from the top as its step passes the middle of the screen (large screens). It rests at `scale-y-0`, so without motion only its hairline track shows |

### The reveal rules

- **Loaded late, and only when wanted.** `ScrollScene` loads the effects and GSAP with `next/dynamic` and `ssr: false` (two files: about 117 KB, 46 KB compressed, measured in task 13), after the page's `load` event, only for visitors who allow motion (`motionAllowed`), and only in browsers with `matchMedia`. Never on the server: GSAP reads `Date.now()` when it loads, which would stop the page being built ahead of time. Reduced-motion visitors never download it.
- **Nothing on screen moves on load.** When the effects start, only targets entirely below the screen are hidden. The hero, and anything a restored scroll position shows, stay exactly as the server drew them.
- **Hidden means opacity 0**, never `visibility` or `display` (no `autoAlpha`): screen readers and find-in-page still reach the text while it waits.
- **Never hide a control.** A reveal target holds no link or button and sits inside none, so keyboard focus never lands on something invisible. The effects also skip any target that breaks this rule, and the story's scaling picture.
- **Once, then gone.** Each target reveals once (`ScrollTrigger.batch`, `once: true`), even when the visitor jumps straight past it; its inline styles are then removed.
- **Clear of the bars.** A reveal starts when the target's top is 10% of the screen above the bottom edge, or above the phone bar (measured from the page's `scroll-padding-bottom`).
- **Phones** (`phoneQuery`, below 768px): a 12px rise and no stagger. From 768px: 24px and 0.08s between tiles.
- **Fonts and print.** Trigger positions are measured again once the fonts have loaded. A `@media print` rule prints every reveal target visible.
- **Undone cleanly.** Leaving the page, a hidden route, or a change of motion setting or breakpoint reverts everything: inline styles removed, numbers back to their final value.
- **No Tailwind `translate-*` or `scale-*`** on a reveal target or the story picture: GSAP sets `translate`, `rotate` and `scale` to `none` inline while it animates.

### The sticky story

- Two columns only on large screens: `storyQuery`, `(min-width: 64rem) and (min-height: 40rem)`, which is the `story:` variant in CSS. Tablets, short laptop windows and phones turned sideways keep one column.
- The picture's column is `position: sticky` at `top-(--header-height)`, `--stage-height` tall, with the picture centred. CSS, not ScrollTrigger's `pin`: no pin-spacer, nothing moves when GSAP starts, and the layout is the same without JavaScript.
- With motion allowed, the picture grows from 0.9 to 1 while the story scrolls past (scrubbed: it follows the scroll position), and each step's rail fills. With reduced motion the layout stays; nothing scales or fills. Step text is never dimmed.

### Accessible counting

- The number is drawn twice in one grid cell. The first copy shows the final value at opacity 0: it's what screen readers read, and it fixes the cell's width, so counting never pushes the text around it. The second copy is `aria-hidden`; its digits are the ones that count. There is no `aria-live`, so nothing is announced while it counts.
- Only the digits change. The words around them come from messages with a tag around the digits (`"<number>{value}</number>+"`), so Hindi can put the words where it needs them.
- `formatNumber` (`src/i18n/format.ts`) writes every value the Indian way (`5,000`, `1,23,456`), on the server and while counting. `tabular-nums` keeps the digits from wobbling.
- A number below the screen waits at 0 and counts once, over `countDuration`, when it scrolls into view. One already on screen shows its final value. Printing before it has counted prints the final value. The rating counts with one decimal; the warranty is shown, not counted.

### Section tones on the home page

`homeTones()` (`src/app/[locale]/(site)/_components/home-tones.ts`) picks them, so neighbouring sections never share a tone, the grey footer included: hero white, story black, services grey; then stats and reviews, when they show, alternate white and grey; the final call to action is white after a grey band and black after a white one. Today that's white, black, grey, white in production, and white, black, grey, white, grey, white under `npm run dev`.

## Brand

- **Name:** "GoMechanic" for now. The owner accepted the trademark risk on condition that a rename stays small. The name lives only in `messages/en.json`; `src/i18n/brand-name.test.ts` fails if it's typed anywhere in `src/` or `public/`.
- **Wordmark** (`src/components/site/wordmark.tsx`): the name in Inter, semibold, `-0.025em` tracking, `translate="no"` (so Chrome's automatic Hindi translation leaves it alone). Size comes from a `type-*` class: `<Wordmark className="type-lead" />` in a header, `type-callout` in a footer.
- **Icon** (`src/app/icon.svg`): the first letter, outlined from Inter Bold, white on a `#1d1d1f` tile with 14/64 rounded corners. In a dark browser tab bar it gets a light edge. It's a path, not text, so every browser shows the same letter.

### Rename checklist

1. In `messages/en.json`, change `Brand.name` and `Metadata.title`, the only other message that types the name (the 404 title reads it through `{brand}`).
2. Redraw the letter in `src/app/icon.svg` from the new name's first letter (Inter Bold outline, same tile).
3. Run `npm run check`: `brand-name.test.ts` lists any file that still has the old name.

## Do and don't

| Do | Don't |
| --- | --- |
| One blue button per group, the rest secondary or outline | Two blue buttons side by side |
| Blue for things you can press; green for status | Blue status badges or blue headings |
| Flat tiles set apart by their fill | A shadow under every tile |
| Text visible before any script runs; animation only moves it | Content hidden until a script fades it in |
| Text sizes from `type-*` classes | `text-lg` or `text-[17px]` next to a `type-*` class |
| Colours from tokens (`bg-card`, `text-link`) | Raw colours (`bg-blue-500`, `#0071e3` in a component) |

Each rule is shown as a rendered pair at the bottom of `/dev/design`.

## Before you ship UI

Adapted from ui-ux-pro-max's pre-delivery checklist:

- [ ] Its sample is on `/dev/design`, and `npm run test:design` passes.
- [ ] Only tokens: no raw colours, font sizes, radii or shadows outside `globals.css` and `src/components/ui/`.
- [ ] Checked at 375, 768, 1024 and 1440px: no sideways scroll, nothing running into an edge, readable line lengths.
- [ ] Every control is at least 44px tall on a touch screen; icon-only controls have an `aria-label`.
- [ ] Contrast checked in every tone the UI appears in (white, grey band, black showcase).
- [ ] Keyboard: everything reachable with Tab, in visual order, with the focus outline visible and not hidden under sticky bars.
- [ ] Reduced motion: no movement, content still visible and complete.
- [ ] Icons are lucide SVGs; decorative ones are hidden from screen readers.
- [ ] Fields have visible labels and errors that say how to fix the problem.
- [ ] Colour is never the only signal (pair it with text or an icon).
- [ ] Text people read comes from `messages/en.json`; the brand only through `Wordmark`.
