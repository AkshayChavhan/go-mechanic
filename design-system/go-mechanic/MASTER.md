# Design system: MASTER

The site's look in one place: principles, tokens and rules. Built in task 11 ([plan](../../document/plans/2026-10-26-1312-feat-design-system-plan.md)).

- **Status:** approved by the owner on **2026-10-26**, as built, with no changes.
- **Site shell** (header, phone menu, footer, phone action bar, 404; task 12, [plan](../../document/plans/2026-10-26-1937-feat-layout-shell-plan.md)): approved by the owner on **2026-10-27** from screenshots, as built.
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

**Scroll padding** on `html`: `scroll-padding-top` is the header's height plus 8px; below 768px, `scroll-padding-bottom` is the bar's height plus 8px. When the browser scrolls to an anchor (`#main`) or a focused control, it stops clear of both bars, so neither hides the focus outline.

**Full-height and pinned sections** (task 13): on phones, start below `--header-height` and end above `--action-bar-height`.

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
- **Reduced motion:** when the visitor asks for less motion, every CSS animation and transition jumps to its end (0.01ms). GSAP code wraps its animations in `gsap.matchMedia()` with `motionAllowed` and `motionReduced` from `@/lib/motion`, and shows the end state for `motionReduced`. See `src/app/[locale]/dev/design/_components/motion-demo.tsx`.
- Animate only transforms and opacity. Never hide content until a script runs.

## Components

shadcn/ui components live in `src/components/ui/`. Ours are in `src/components/site/`. Every edited shadcn file starts with an "Our changes to shadcn's ..." comment, and `src/components/ui/restyle.test.tsx` fails if `shadcn add --overwrite` undoes them.

- **Touch targets:** buttons and fields are 44px tall (`lg` 48px). The `sm` (36px) and `xs` (32px) buttons and their icon sizes grow to 44px on touch screens (`pointer-coarse:`). Icon-only buttons are 44px wide and always have an `aria-label`.
- **Buttons:** pills. One `default` (blue) button per group; the others use `secondary`, `outline` or `ghost`. `link` uses `--link`. `destructive` is a solid red fill. A busy button is `disabled` with a spinning `LoaderCircleIcon`.
- **Focus:** a solid 2px `--ring` outline, 2px away from the control, on every link, button, ARIA widget and field. It's one rule outside any `@layer` in `globals.css`.
- **Fields:** 44px tall, 17px text (iOS zooms into anything under 16px), `--input` border. Use `FieldGroup` and `Field`; labels above, errors below with `FieldError`, written to say how to fix the problem.
- **Cards:** flat tiles, `rounded-xl`, `type-callout` text, `type-title` titles.
- **Badges:** pills. `success` for status (open now), `secondary` for a normal state such as closed, `destructive` for problems. Their text is still shadcn's 12px, under the 13px floor; a backlog task restyles it.
- **Sheet:** `closeLabel` is required whenever the close button shows: pass `t("close")` from the `Common` messages.
- **Section:** every page section, for its tone, spacing and width.
- **Wordmark:** the only place code shows the brand name (see below).

## Site shell

The frame around every public page (task 12). Pages in `src/app/[locale]/(site)/` get it from that folder's `layout.tsx`; the components are in `src/components/site/`.

| Component | What it does |
| --- | --- |
| `SiteChrome` (`site-chrome.tsx`) | The frame, in order: skip link, header, offer banner, the page in `<main id="main">`, footer, action bar, then a phone-only spacer the bar's height. The only code that reads `src/content/` (`readGarage()`) and `navigation.ts` |
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

- **Server components fed by props.** Everything but the two islands renders on the server and takes the garage, the live links and the Book target as props, so `/dev/design` shows each part with demo data and task 14 changes only `readGarage()`.
- **Client islands get labels as props.** A `"use client"` component gets its labels as props (`MobileMenu`'s `openLabel`, `title`, `closeLabel`) and its content as children from a server parent. Only the namespaces in `src/i18n/client-messages.ts` reach the browser (`OpenStatus` today), and `client-messages.test.ts` fails if a client file reads another.
- **Only live links.** `navigation.ts` lists every page with a `live` flag, and the shell shows only live ones, so no link leads to a missing page. A page task sets its flag in the same commit as its page; `navigation.test.ts` checks every flag against the real `page.tsx` files.
- **Open now** is worked out in the browser, so pages stay prerendered. The prebuilt HTML holds an empty slot of the badge's height (no layout shift); the badge appears when React starts and updates every minute. Green `success` "Open now"; grey `secondary` "Closed", because closed is normal. The weekly hours always sit next to it, in case the visitor's clock is wrong. Festival closures (Diwali, Ganeshotsav) aren't known until task 28, so the badge can say "Open now" on those days.

### Phone action bar

- **Phones only:** below 768px (`md:hidden`). From 768px the header has "Book a service" and the footer has the phone and WhatsApp.
- **Three buttons, one blue:** Call and WhatsApp `secondary`, Book `default`. Until `/book` exists (task 23), Book opens WhatsApp with the booking message (owner, 2026-10-27).
- **Tab-bar layout:** three equal columns, each icon above its label. At 320px "WhatsApp" doesn't fit beside its icon.
- **Safe area:** the bottom padding grows to clear the iPhone home indicator (`--action-bar-padding-bottom`).
- **Never covers the page:** a spacer of `--action-bar-height` follows the footer, and the scroll padding keeps focused controls above the bar.
- **Floats, but never moves:** solid `bg-background`, top border, `shadow-md`, `z-40`. No animation, so reduced motion needs nothing extra.

## Brand

- **Name:** "GoMechanic" for now. The owner accepted the trademark risk on condition that a rename stays small. The name lives only in `messages/en.json`; `src/i18n/brand-name.test.ts` fails if it's typed anywhere in `src/` or `public/`.
- **Wordmark** (`src/components/site/wordmark.tsx`): the name in Inter, semibold, `-0.025em` tracking, `translate="no"` (so Chrome's automatic Hindi translation leaves it alone). Size comes from a `type-*` class: `<Wordmark className="type-lead" />` in a header, `type-callout` in a footer.
- **Icon** (`src/app/icon.svg`): the first letter, outlined from Inter Bold, white on a `#1d1d1f` tile with 14/64 rounded corners. In a dark browser tab bar it gets a light edge. It's a path, not text, so every browser shows the same letter.

### Rename checklist

1. In `messages/en.json`, change `Brand.name` and the page texts that mention the name (`Metadata`, `HomePage`).
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
