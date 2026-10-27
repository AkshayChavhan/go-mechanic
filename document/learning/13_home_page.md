# 13_home_page: the real home page, with calm scroll motion

> **Branch:** `13_home_page` · **Date:** 2026-10-27 · **Status:** In progress

## In one minute

`/` is now a real home page. It has a hero ("Car and bike service in Kiwale, Pune", with Book and Call) and a dark "How a visit works" story in four steps. On large screens the story's vehicle drawing stays in view and grows as you scroll. Then come a grid of the eleven services and a final call to action. Trust stats and sample reviews are built too, but only `npm run dev` shows them: made-up numbers must never reach customers. The motion comes from GSAP, which the browser downloads only after the page has loaded, and only for visitors who allow motion. Every word is in the server's HTML, so the page reads the same without JavaScript. The page is still built ahead of time (`○ /en`). Full details: [the plan](../plans/2026-10-27-1344-feat-home-page-plan.md) (R1–R16, KTD1–KTD13, units U1–U7) and "Page blocks and scroll motion" in [MASTER.md](../../design-system/go-mechanic/MASTER.md).

## Why: the problem we solved

Before this task, `/` showed one heading and "Our new website is on its way". Task 12's frame gave visitors the phone number and hours, but nothing said what the garage fixes, how a visit works or why to trust it. The SEO check in task 12 also asked for the area in the `h1`: people search for "car service Kiwale", not for a brand.

Three facts shaped the page:

- **Most visitors use Android phones on 4G.** The owner wants Apple-like scroll motion, but it must not cost speed. So the page stays prebuilt, and the animation code loads late.
- **The owner has no real photos, numbers or reviews yet.** The master plan put labelled placeholders on the live site. On 2026-10-27 the owner narrowed that: nothing made up may reach customers.
- **Motion must never hide content.** Screen-reader users, keyboard users, people who turn motion off and people whose JavaScript fails must all get every word.

## What: what changed

| File or folder | Change | Why it exists |
| --- | --- | --- |
| `src/lib/samples.ts` + test | Added | `showSamples()`: true only under `npm run dev`. The one switch for made-up content |
| `src/content/home.ts` + test | Added | Real trust stats and reviews (`null` today), the samples, a canary phrase, and the selectors the page reads through |
| `src/content/services.ts` + test | Added | The owner's eleven services: id, name, one-line summary, and cars, two-wheelers or both |
| `src/i18n/format.ts` + test | Changed | `formatNumber`: Indian grouping (`1,23,456`), used for the stats |
| `src/lib/motion.ts` + test | Changed | Scroll values (`distance`, `countDuration`) and two media queries (`storyQuery`, `phoneQuery`) |
| `src/app/globals.css` | Changed | `--stage-height`, a `story:` variant that matches `storyQuery`, and a print rule |
| `src/components/site/scroll-scene.tsx` + test | Added | The one client island. It wraps the sections and loads the effects lazily |
| `src/components/site/scroll-scene-effects.tsx` | Added | The animations: the only non-dev file that imports GSAP |
| `src/components/site/scroll-scene-attributes.ts` + test | Added | The `data-scene-*` names, and `sceneMark()`/`sceneCount()` to mark server markup |
| `src/lib/gsap-imports.test.ts` | Added | Fails if any other file imports GSAP (dev pages excepted) |
| `src/components/site/` `vehicle-illustration`, `visual-slot`, `service-tile`, `stat-tile`, `review-card`, `sample-badge` (+ tests) | Added | Reusable page blocks: the line drawing, a photo slot, the tiles, the review card and the "Sample" badge |
| `src/app/[locale]/(site)/page.tsx`, `page.test.tsx` | Changed | The real page, with `ensureStatic = "navigation"` |
| `src/app/[locale]/(site)/_components/` `home-hero`, `home-story`, `home-services`, `home-stats`, `home-reviews`, `home-cta`, `home-actions` | Added | The page's sections, plus the shared Book and Call buttons |
| `src/app/[locale]/(site)/_components/home-tones.ts` + test | Added | Picks each section's colour, so two neighbours never match |
| `messages/en.json` | Changed | The `HomePage` groups (hero, story, services, stats, reviews, cta, sample), and a new `Metadata.description` |
| `src/app/[locale]/dev/design/page.tsx` | Changed | A "Page blocks" section with a sample of every new block |
| `e2e/home.spec.ts` | Added | The home page on a production build, including the no-samples scan |
| `e2e/helpers.ts`, `e2e/layout-shell.spec.ts` | Added, Changed | Helpers shared by the specs, moved out of `layout-shell.spec.ts` |
| `e2e/dev/home-preview.spec.ts`, `design-preview.spec.ts`, `shell-preview.spec.ts` | Added, Changed | Checks and screenshots under `next dev` |
| `CLAUDE.md`, `MASTER.md`, `features.md`, `task.md` | Changed | The new rules, the owner's decisions, and follow-ups for tasks 17, 18, 37 and 42 |

The first commit on the branch, `665ee09 docs(12): mark task 12 done`, is task 12's bookkeeping. That's why `document/learning/12_layout_shell.md` also differs from `main`.

## How: step by step

1. **Plan, and the owner's decisions.** On 2026-10-27, before planning, the owner decided four things:
   - trust stats are labelled placeholders that never appear on the live site until real numbers exist;
   - sample reviews follow the same rule, until task 37 brings real ones;
   - the services grid lists all the usual services, for cars and two-wheelers;
   - no photos yet: neutral line art, no stock photos (they would pretend to be the garage).

   `ce-plan` then hung after its document review, for the fourth task running. The watcher from the [ce-plan hang lesson](../solutions/workflow-issues/ce-plan-child-session-hangs-use-idle-watcher.md) reported it after 10 idle minutes, and the process was stopped.

2. **The sample gate.** `showSamples()` in `src/lib/samples.ts` is one line: `process.env.NODE_ENV === "development"`. Next.js writes `NODE_ENV` into the code when it builds (`node_modules/next/dist/build/define-env.js`, line 76). In a production build the check becomes `"production" === "development"`, which is always false. Reading it doesn't make the page dynamic, and a production prerender can never render a sample.
   - The page never calls `showSamples()` itself. It calls `selectTrustStats()` and `selectReviews()` in `src/content/home.ts`. They return real data in every build, else the samples under `npm run dev`, else `null`. A section given `null` renders nothing.
   - **Why not `devOnly()`?** Its comment invites turning dev pages on for a staging server later. Staging might be shown to customers, so samples get their own switch.
   - One sample review contains a **canary**, "quiet as a sleeping cat" (`sampleCanary`). It appears nowhere else, so finding it in a production file proves a leak.

3. **Numbers the Indian way.** `formatNumber(value, locale, decimals)` uses `Intl.NumberFormat` with the `en-IN` locale, so 5000 shows as "5,000" and 123456 as "1,23,456". It throws for a value that isn't a real number, like `formatRupees`.

4. **The building blocks** in `src/components/site/`. They're reusable, because tasks 18, 19 and 37 will need them too:
   - **`VehicleIllustration`:** a car and a scooter drawn inline in SVG, in `currentColor`, so it suits white, grey and black sections. It makes no network request.
   - **`VisualSlot`:** a fixed 16:10 box. Today it shows the drawing. When a real photo arrives (a static import), it renders `next/image`. The hero's slot passes `eager`, which becomes `loading="eager"` and `fetchPriority="high"`, never the deprecated `priority` ([image lesson](../solutions/conventions/nextjs-16-read-bundled-docs-image-priority.md)).
   - **`ServiceTile`:** icon, name, summary, vehicles. It isn't a link, because the service pages don't exist yet (task 18).
   - **`StatTile`, `ReviewCard`, `SampleBadge`:** the stats and reviews. Each sample gets a visible "Sample" badge and a `data-sample` attribute for the tests.

5. **The scroll scene island.** `ScrollScene` (`"use client"`) wraps every section. The sections are Server Components passed in as `children`, so they stay on the server. It loads the effects like this:
   ```tsx
   const ScrollSceneEffects = dynamic(
     () => import("./scroll-scene-effects").then((module) => module.ScrollSceneEffects),
     { ssr: false },
   );
   ```
   - `ssr: false` means "never render this on the server". Only a client component may use it.
   - It renders `<ScrollSceneEffects>` only when `useMotionReady()` says yes. That needs two things: the page has fired `load` (`document.readyState === "complete"`), and the visitor allows motion. Until then the browser doesn't even request the file.
   - **Why so careful?** GSAP calls `Date.now()` the moment it's imported (`node_modules/gsap/gsap-core.js`, lines 1269–1272). Reading the time during a prerender stops Next.js from building the page ahead of time. GSAP is also big: about 117 KB, 46 KB compressed (measured below). Loading it after `load` keeps it from competing with the text and fonts on 4G. Reduced-motion visitors never download it at all.
   - The effects find what to animate by data attributes (`data-scene-reveal`, `data-scene-count`...) inside the scene only. So a section holds no animation code, and `src/lib/gsap-imports.test.ts` fails if a section imports GSAP anyway.

6. **The reveal rules** (`scroll-scene-effects.tsx`). Headings, text and tiles fade and rise in the first time they scroll into view, under these rules:
   - **Pre-hide only what is fully below the screen** when the effects start. The hero, and whatever a restored scroll position shows, never move on load.
   - **Opacity, not `autoAlpha` or `display`.** `autoAlpha` also sets `visibility: hidden`, which removes text from what screen readers and find-in-page can reach. At opacity 0 the text is still there.
   - **Once** (`ScrollTrigger.batch` with `once: true`). Jumping straight to the bottom still reveals what you skipped.
   - **Inline styles are cleared** afterwards (`clearProps`), so each element ends exactly as the server drew it.
   - **Links and buttons are never reveal targets.** Keyboard focus could land on something invisible. The effects also skip any target that holds one.
   - **Phones get shorter reveals** (12px instead of 24px) **and no stagger**. Reveals start once the target clears the phone bar.

7. **The sticky story.** On large screens (`storyQuery`: at least 1024px wide and 640px tall), the story has two columns. The drawing's column is CSS `position: sticky` at `top-(--header-height)`. A scrubbed GSAP tween grows the drawing from 0.9 to 1 as the steps scroll past. We didn't use ScrollTrigger's `pin`: it wraps the element in a "pin-spacer" and moves it in the page, which can shift the layout when GSAP starts. Sticky needs no JavaScript, so the layout is the same with or without it. It never grows past its natural size, so it can't overflow sideways. Smaller screens stack the drawing above the steps, with no scaling.

8. **Accessible counting.** `StatTile` draws the number twice in one grid cell:
   - the first copy holds the final value at opacity 0. Screen readers read it, and it fixes the cell's width, so counting never pushes its neighbours;
   - the second copy is `aria-hidden`, and its digits count up.

   There's no `aria-live`, so nothing is announced while it counts. Without motion, both copies just show the final value.

9. **The page and its colours.** `page.tsx` reads the garage through `readGarage()`, works out the Book target (WhatsApp until `/book` exists), and passes everything down as props. It exports `ensureStatic = "navigation"`. If the page, or the `(site)` layout above it, ever reads something per request, `next dev` and `next build` now fail instead of quietly making the page slower. The work session proved this by adding `await connection()` (a per-request read): the build failed.

   The plan wrote the tones down as a fixed list (A1). That list repeats a colour when only one of the optional sections shows. So `homeTones()` works them out. Real output with Node 24:
   ```bash
   fnm exec --using=24 -- node --no-warnings --input-type=module -e 'import { homeTones } from "./src/app/[locale]/(site)/_components/home-tones.ts"; for (const stats of [false, true]) for (const reviews of [false, true]) { const t = homeTones({ stats, reviews }); console.log(`stats ${stats ? "on " : "off"}, reviews ${reviews ? "on " : "off"}:`, ["white", "dark", "grey", ...(stats ? [t.stats] : []), ...(reviews ? [t.reviews] : []), t.cta, "grey (footer)"].join(" → ")); }'
   ```
   ```
   stats off, reviews off: white → dark → grey → white → grey (footer)
   stats off, reviews on : white → dark → grey → white → dark → grey (footer)
   stats on , reviews off: white → dark → grey → white → dark → grey (footer)
   stats on , reviews on : white → dark → grey → white → grey → white → grey (footer)
   ```
   The first line is production today; the last is `npm run dev`.

10. **Testing an animated page.** Two traps shaped every browser test:
    - **A fixed clock freezes GSAP.** `page.clock.setFixedTime` freezes `Date.now`, and GSAP times its animations with it, so no reveal would ever finish. So screenshots and content checks use `reducedMotion: "reduce"` (GSAP never loads), and motion checks use the real clock.
    - **`toBeVisible()` counts opacity 0 as visible.** The tests use `effectiveOpacities` from `e2e/helpers.ts`, which multiplies an element's opacity by every ancestor's.

    The **no-samples scan** in `e2e/home.spec.ts` searches a production build for the canary and the stats and reviews labels. It looks in the HTML, the page data inside it, the page data a client-side navigation fetches (`RSC: 1` header), and every script the page loads, GSAP's late chunk included. The work session proved it catches leaks. With `showSamples()` forced to true in production, the test failed on every channel. A canary planted in the lazy effects chunk was caught at `/_next/static/chunks/2205qe6wuuqyj.js`. (Chunk names change with each build.)

11. **Bumps along the way.**
    - **Tests that passed only by luck of order.** `scroll-scene.test.tsx` checks that the effects module is never loaded under reduced motion. It mocked the module with `vi.mock` and called `vi.resetModules()` before each test. But `vi.mock` is hoisted (moved to the top of the file), and `resetModules()` doesn't run its factory again. So the "never loaded" tests passed only because an earlier test had already loaded the stand-in. The fix: `vi.doMock` inside `beforeEach`. Checked with five shuffled orders (re-run for this doc, below).
    - **Lint caught two real issues.** The React Compiler rule `react-hooks/static-components` flagged an icon component picked inside render; it's now a small `ServiceIcon` component. And the text-in-JSX guard flagged next/image's `placeholder="blur"` as if it were text people read. `visual-slot.tsx` works the value out before the JSX, and the backlog has a note to narrow that rule.
    - **Test mistakes.** The heading-order check also caught the footer's `h2`, so it now looks inside `<main>` only. And `/dev/design` imports GSAP directly for its motion demo, so "GSAP never loads" can't be checked there.
    - **Screenshots vanished.** A filtered Playwright run (`-g`) empties its output folder first. `CLAUDE.md` now says to run the full suites before collecting screenshots.
    - **`CLAUDE.md` by patch.** The docs agent declined to edit `CLAUDE.md` itself and wrote a patch instead. The main session reviewed it and applied it.

12. **The owner's look check (2026-10-27).** The owner looked at screenshots from `next dev` (with samples) and from production (without). Decisions:
    - the look and the copy are approved as they are;
    - no stand-in "facts" row on production: the live page is hero, story, services and call to action until real stats exist;
    - AC is for cars only (every other service covers both);
    - the frosted header stays as it is over the black story band.

    The screenshots from this check are kept, for now, in the session scratchpad: `/private/tmp/claude-501/-Users-rtlecl910010-Desktop-Projects-Project-go-mechanic/b8887bf8-9d2e-427b-b51f-f35665077086/scratchpad/home-screenshots/` (29 from `dev/`, 10 from `prod/`). The full suites recreate them in `test-results/design/screenshots/home-*.png` and `test-results/home/`.

13. **A slip by the main session.** The docs commit `89806f6` went in after `npm run check` had reported 4 failed tests: the command chain didn't stop on the failure. Three reruns all passed (765 of 765), and so did the run for this doc. The failures were timeouts while the computer was overloaded: Docker Desktop at about 99% CPU for 16 days, Spotlight indexing at about 98%, and a load average near 24. Nothing broken was committed, but the habit was wrong. The lesson: only commit after a check that passed (`npm run check && git commit ...`).

## Decisions worth knowing

| Choice | Why | What it costs |
| --- | --- | --- |
| Samples only under `npm run dev` | The owner: nothing made up reaches customers | Production has no trust section until the owner gives real numbers |
| `showSamples()` apart from `devOnly()` | Staging must never show samples, even if dev pages are shown there | Two switches to know about |
| GSAP lazy, after `load`, motion only | The page stays prebuilt; 117 KB stays off the first load; reduced motion never downloads it | Motion starts a moment after load |
| CSS `sticky` + scale, not `pin` | No pin-spacer, no layout shift, same layout without JavaScript | Only the scale moves; large screens only |
| `opacity`, not `autoAlpha` | Hidden text stays readable by screen readers and find-in-page | None worth noting |
| No links or buttons in reveals | Focus never lands on something invisible | Buttons never animate |
| `ensureStatic = "navigation"` | A slow-down fails the build instead of shipping | Task 15's login entry must be a client island, as planned |
| `homeTones()`, not the plan's fixed list | The fixed list repeats a colour with one optional section | Tones aren't visible in the markup |
| No SplitText, no smooth-scroll library | Splitting letters breaks Hindi once it ships; smooth scrolling fights the sticky bars | Plainer motion |
| Line art, no stock photos | Stock photos would pretend to be the garage | Less colour until real photos arrive |

## New ideas in this task

- **Lazy loading:** downloading code only when it's needed, not with the page. Like a restaurant that cooks dessert only for people who order it.
- **Chunk:** one JavaScript file in the build. The build splits code into chunks so a page downloads only the ones it uses.
- **`next/dynamic` with `ssr: false`:** loads a client component lazily, and never renders it on the server.
- **Build-time constant:** a value the build writes straight into the code, like `NODE_ENV`. The built code can't change it later.
- **Canary:** a unique phrase hidden in test data. If it shows up somewhere it shouldn't, something leaked. Named after miners' canaries.
- **ScrollTrigger:** the GSAP plugin that starts animations when an element scrolls to a point on the screen.
- **Scrub:** tying an animation to the scroll position, so it moves forward as you scroll down and back as you scroll up.
- **`gsap.matchMedia()`:** runs animation setup only while media queries match, and undoes it cleanly when they stop matching.
- **`prefers-reduced-motion`:** a device setting that asks websites for less movement. Some people get dizzy or sick from animation.
- **`position: sticky`:** an element scrolls normally until it reaches a set distance from the top, then stays there while its section scrolls past.
- **Accessibility tree:** the version of the page that screen readers read. `visibility: hidden` and `display: none` remove things from it; opacity 0 doesn't.
- **`aria-hidden` / `aria-live`:** `aria-hidden="true"` hides an element from screen readers. `aria-live` makes them announce changes, which would be noisy for a counting number.
- **Page data (RSC payload):** the description of the page that React sends alongside, or instead of, the HTML. A client-side navigation fetches it with the `RSC: 1` header.
- **`--stage-height`:** a CSS variable for the screen space between the header and, on phones, the bottom bar. `svh` is the screen height with the phone's address bar showing, so it doesn't jump when that bar hides.
- **Hoisting (`vi.mock`):** Vitest moves `vi.mock` calls to the top of the file before running it. `vi.doMock` isn't moved, so it runs where you write it.
- **Order-dependent test:** a test that passes or fails depending on which tests ran before it. Running in a shuffled order exposes it.
- **Bento grid:** a grid of tiles of different sizes, like a Japanese lunch box.

## Check that it works

Real output on 2026-10-27, with Node 24 (trimmed). `npm run check` is from the final code, after the review fixes; the build's route list is from before them (no route changed):

```bash
npm run check
```
```
 Test Files  45 passed (45)
      Tests  768 passed (768)
```

`npm run build` lists the routes. `○ /en` means the home page is still built ahead of time:
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

How big is GSAP? After the build, this finds the chunks that contain it and measures them as they are and compressed (`gzip -9` is maximum compression, close to what a server sends):
```bash
cd .next/static/chunks && for f in $(grep -l "gsapVersions\|ScrollTrigger" *.js); do raw=$(wc -c < "$f"); gz=$(gzip -9 -c "$f" | wc -c); echo "$f raw=$raw gzip=$gz"; done
```
```
0q8wftpbx6kmh.js raw=   70919 gzip=   27352
26u9e1w9hw4i_.js raw=   46223 gzip=   18556
```
Together: 117,142 bytes, 45,908 compressed. That matches MASTER.md's "about 117 KB, 46 KB compressed".

The shuffled-order check from bump 11 (`--sequence.shuffle` runs the tests in random order; `--sequence.seed` picks which order, so it can be repeated). All five seeds printed the same result:
```bash
for seed in 1 2 3 4 5; do npx vitest run src/components/site/scroll-scene.test.tsx --sequence.shuffle --sequence.seed=$seed; done
```
```
 Test Files  1 passed (1)
      Tests  7 passed (7)
```

The browser suites, from the work session's final runs after the review fixes:
- `npm run test:e2e` (production build): `58 passed (1.1m)`.
- `npm run test:design` (under `next dev`, plus the screenshots): `39 passed (1.6m)`.

To look for yourself, run `npm run dev` and open http://localhost:3000. You should see the stats and reviews with "Sample" badges. Production (`npm run build && npm run start`) has neither.

## Checks and reviews

- **SEO check:** the `seo-reviewer` agent checked `/`, `/dev/design` and the 404 on the production build. **All pass.** It confirmed:
  - one `h1` with "Kiwale, Pune" and a clean heading outline;
  - all text in the server HTML;
  - CLS 0 on load and while scrolling, and the `h1` as the largest paint (about 0.5 s on a phone, localhost);
  - GSAP not in the first-load scripts;
  - no sample text anywhere in the build.

  It also found three things, which the owner asked us to fix in this task:
  1. **Blank sections after a resize.** Sections waiting below the fold stayed invisible if the window grew taller without scrolling. That happens when someone maximises a browser window, or when a renderer such as Google's uses a very tall window. A resize listener now reveals them, and an e2e test proves it: without the fix, 179 elements stayed hidden.
  2. **A fuller meta description** that names bikes, the area and what visitors get.
  3. **A missing space:** from 768px the Call link read "Call+91 97647 50567".
- **`ce-code-review`: "Ready with fixes".** Nine reviewer personas confirmed the owner's rule holds: no path lets a sample stat or review reach a production build. One P1, all fixed:
  - **The P1:** if the lazily loaded effects file failed to download (weak signal, an old file after a redeploy, a content blocker) or threw, Next.js's error screen replaced the whole home page. Now the loader falls back to no motion, an error boundary renders nothing on error, and a setup error reverts anything already hidden.
  - **How it was proven:** in tests `next/dynamic` first resolved to the Pages Router version, which swallowed the failure and hid the bug. The test now uses the App Router version that the real build uses.
  - **Other fixes:**
    - `/dev/design` read the sample lists behind `devOnly()`; it now goes through `showSamples()`, and a test fails if any other file uses the lists directly;
    - the mid-story scale check couldn't fail; it now compares readings and requires a scale below 1;
    - the shell spec now uses reduced motion on `/`, because it fixes the clock;
    - a duplicated test helper was removed, and a comment corrected.
- **`code-reviewer` agent:** *Pending.*
- **Compound:** *Pending.* Candidates so far: testing animated pages with Playwright (the clock, `toBeVisible()`), and `vi.mock` with `vi.resetModules()`. Both are already rules in `CLAUDE.md` or the code's comments, which may be enough.
- **Pull request and merge:** *Pending*, after the reviews and the owner's go-ahead.

## Common mistakes

- **A link or button inside a reveal target.** Focus could land on something invisible. Keep `HomeActions` outside every `sceneMark("reveal")`.
- **Importing GSAP in a section.** It breaks the prerender and puts 117 KB on the first load. Mark the markup with `sceneMark(...)` instead; `gsap-imports.test.ts` catches it.
- **Gating samples with `devOnly()` or `NODE_ENV !== "production"`.** The first may be loosened for staging. The second is also true in tests. Read through the selectors in `src/content/home.ts`.
- **Fixing the Playwright clock with motion on.** Nothing reveals, and screenshots show empty sections while tests pass.
- **`toBeVisible()` on animated content.** It passes at opacity 0. Use `effectiveOpacities`.
- **Tailwind `scale-*` or `translate-*` on a reveal target or the story drawing.** GSAP sets the transform inline and overrides them.
- **`overflow: hidden` on anything around the story.** It quietly turns `sticky` off.
- **`vi.mock` plus `vi.resetModules()`, expecting the factory to run again.** It doesn't. Use `vi.doMock` in `beforeEach`.
- **A filtered Playwright run (`-g`) before collecting screenshots.** It empties the output folder.
- **Committing after a failed check.** Chain the commit on a passing check with `&&`.

## Try it yourself

About 10 minutes. Predict each answer first, and finish with `git status` showing a clean tree.

1. The plan's fixed tones were: stats white, reviews grey, call to action white, after hero white, story dark, services grey. For each of the four on/off combinations of stats and reviews, write the colours top to bottom, footer (grey) included. Which combinations put two equal colours next to each other? Then run the `homeTones` command from step 9 and compare.
2. Add `import gsap from "gsap";` as the first line of `src/components/site/service-tile.tsx`. Run `npx vitest run src/lib/gsap-imports.test.ts`. Remove the line.
3. Run `npm run dev` and open http://localhost:3000. In DevTools' console, type `window.gsapVersions`. Then open the Rendering panel, set "Emulate CSS media feature prefers-reduced-motion" to `reduce`, reload, and type it again.

Answers. (1) Stats only gives grey → white → white; reviews only gives grey → grey. `homeTones()` makes the call to action black in both. (2) is from a real run in a throwaway copy of the repo, so nothing in the repo was edited:
```
 FAIL  |node| src/lib/gsap-imports.test.ts > only the scroll scene's effects and dev pages import GSAP > the scan finds today's importers, and they're all allowed
AssertionError: load GSAP only in scroll-scene-effects.tsx (mark the markup with scroll-scene-attributes.ts instead): expected [ Array(1) ] to deeply equal []
      Tests  1 failed | 15 passed (16)
```
(3) With motion allowed you get an array holding GSAP's version (`3.15.0` in `package.json`), because the effects loaded after the page did. With `reduce` you get `undefined`: GSAP never downloaded. `e2e/home.spec.ts` checks both on a production build. (This one wasn't run in a browser for this doc.)

## Learn more

- Next.js (read the bundled copy first, in `node_modules/next/dist/docs/01-app/`): [lazy loading and `ssr: false`](https://nextjs.org/docs/app/guides/lazy-loading), [`Image`](https://nextjs.org/docs/app/api-reference/components/image) (`loading`, `fetchPriority`), and `03-api-reference/03-file-conventions/02-route-segment-config/ensureStatic.md` (bundled only).
- GSAP: [ScrollTrigger](https://gsap.com/docs/v3/Plugins/ScrollTrigger/), [`gsap.matchMedia()`](https://gsap.com/docs/v3/GSAP/gsap.matchMedia()), [GSAP with React (`useGSAP`)](https://gsap.com/resources/React/).
- MDN: [`position: sticky`](https://developer.mozilla.org/en-US/docs/Web/CSS/position), [`prefers-reduced-motion`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion), [`aria-hidden`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-hidden), [`aria-live`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-live).
- Vitest: [`vi.mock` and `vi.doMock`](https://vitest.dev/api/vi.html#vi-domock).
- Playwright: [the clock](https://playwright.dev/docs/clock) and [`toBeVisible()`](https://playwright.dev/docs/api/class-locatorassertions#locator-assertions-to-be-visible).
- web.dev: [Cumulative Layout Shift (CLS)](https://web.dev/articles/cls), the "nothing jumps" measure the e2e tests keep below 0.01.
