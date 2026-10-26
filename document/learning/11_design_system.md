# 11_design_system: one calm, Apple-like look, defined once

> **Branch:** `11_design_system` · **Date:** 2026-10-26 · **Status:** In progress

## In one minute

The site now has a **design system**: one agreed set of fonts, colours, text sizes, corner radii, shadows, spacing and motion timings. Each one is a **design token**, a named value such as `--primary` or `type-title`, kept in `src/app/globals.css`. Six shadcn components were restyled to use the tokens (pill buttons, 44px touch targets, flat tiles), and we added two components of our own: `Wordmark` (the brand name as a logo) and `Section` (one page band). A development-only page, `/dev/design`, shows all of it on one page. The owner approved the look there on 2026-10-26, with no changes. Full details: [the plan](../plans/2026-10-26-1312-feat-design-system-plan.md) (R1–R17, KTD1–KTD15, units U1–U11) and the spec written for people, [MASTER.md](../../design-system/go-mechanic/MASTER.md).

## Why: the problem we solved

Before this task the app still used shadcn's grey defaults and an unused `.dark` theme. Its font, Geist, has no Hindi letters (found in task 09's SEO check). Tasks 12 and 13 build the first pages visitors see: the header, the footer and the home page. Without shared tokens, each section would choose its own blue, its own text sizes and its own spacing, and the pages would slowly stop matching. Three facts about this garage shaped the work:

- **Most visitors use Android phones, often on 4G.** Fonts must stay small, and every control must be big enough for a thumb.
- **Hindi is coming.** We need a Devanagari font (the alphabet Hindi uses) that English pages never download.
- **The name "GoMechanic" is a trademark risk.** The owner chose to keep it for now, but a rename must stay a small change.

## What: what changed

| File or folder | Change | Why it exists |
| --- | --- | --- |
| `src/app/fonts.ts` | Changed | Inter (preloaded) and Noto Sans Devanagari (not preloaded) replace Geist. Exports one class string for both `<html>` tags |
| `src/app/globals.css` | Changed | Every token: colours in three tones, the `type-*` scale, radius, shadows, spacing, `frosted`, motion, the focus outline, reduced motion |
| `src/app/[locale]/layout.tsx`, `src/app/global-not-found.tsx` | Changed | Use the shared font classes |
| `src/lib/color-contrast.ts` + test | Added | WCAG contrast ratio, plus `blend()` for see-through fills |
| `src/app/design-tokens.test.ts` | Added | Checks every colour pair in every tone, reading the real `globals.css` |
| `src/lib/motion.ts` + test | Added | Durations and eases for GSAP. The test keeps them equal to the CSS variables |
| `src/components/ui/` (8 files) | Added, then changed | shadcn's button, badge, card, input, field, label, separator and sheet. Six were restyled; label and separator are untouched |
| `src/components/ui/restyle.test.tsx` | Added | Fails if `shadcn add --overwrite` brings the default styles back |
| `src/components/site/wordmark.tsx`, `section.tsx` + tests | Added | The brand name as a logo; a page band with a tone and a width |
| `src/app/icon.svg`, `src/app/icon.test.ts` | Changed, Added | The letter icon. The test checks it's square and has a `<path>` and no `<text>` |
| `src/i18n/brand-name.test.ts` | Added | Fails if the brand name is typed anywhere in `src/` or `public/` |
| `messages/en.json`, `src/i18n/messages.test.ts` | Changed | New `Brand.name` and `Common.close` |
| `src/lib/dev-only.ts` + test | Added | `devOnly()`: a 404 everywhere except `npm run dev` |
| `src/app/[locale]/dev/design/` | Added | The preview page, plus `color-pair.tsx`, `font-switch.tsx` and `motion-demo.tsx` in `_components/` |
| `eslint.config.mjs`, `src/i18n/lint-guards.test.ts` | Changed | Dev pages may type demo text, and stock `text-*` sizes are rejected |
| `e2e/smoke.spec.ts`, `e2e/i18n.spec.ts` | Changed | Font checks, and `/dev/design` is a 404 with `noindex` in production |
| `playwright.dev.config.ts`, `e2e/dev/design-preview.spec.ts`, `package.json`, `playwright.config.ts` | Added, Changed | `npm run test:design` runs against `next dev`; the main config skips `e2e/dev/` |
| `design-system/go-mechanic/MASTER.md` | Added | The design system written out for people, with a rename checklist |
| `CLAUDE.md`, `readme.md`, `features.md`, the master plan, `skills.md`, `task.md` | Changed | "Design system" and "Development-only pages" rules, the brand decision, the tracker |

`document/learning/10_i18n_foundation.md` and two lines of `task.md` also differ from `main`, but those changes come from `af0fa3f`, task 10's "mark done" commit. Since task 10, that commit is the first one on the next task's branch.

## How: step by step

1. **Plan.** `ce-plan` wrote the plan. Its automatic document review then improved it: `--input` became `#808085`, the font switch was added to `/dev/design`, and more contrast pairs were checked. After that the process hung again, as it did in task 10. The plan file stopped changing for 10 minutes while the process kept running. A background watcher spotted the hang this time, so we stopped the process and used the plan as written.

2. **Add the shadcn components, untouched.** We added button, badge, card, input, field (which brings label), separator and sheet with the project's own shadcn CLI (version 4.22.1 from `package.json`): `npx shadcn add button badge card input field separator sheet -y` (`-y` skips the confirmation). It created 8 files and changed nothing else: no `globals.css` or `package.json` edits. Commit `b9d018a` holds them exactly as generated, so `git diff b9d018a HEAD -- src/components/ui/` shows only our changes.

3. **Fonts.** A **font stack** is a list the browser tries from left to right, for each character:
   ```css
   --font-sans-stack: -apple-system, BlinkMacSystemFont, var(--font-inter), var(--font-devanagari), sans-serif;
   ```
   - `-apple-system` (Safari) and `BlinkMacSystemFont` (Chrome) mean San Francisco, Apple's system font. Other devices don't have it, so they skip to Inter.
   - In `fonts.ts`, `subsets: ["latin"]` decides which Inter file is **preloaded**, meaning requested from `<head>` before the page needs it. Noto Sans Devanagari has `preload: false`.
   - Google's font CSS gives every file a `unicode-range`. The browser downloads a file only when the page uses a character in that range, so the Hindi file loads only when Devanagari text appears.
   - **Order trap:** Noto's files also cover ₹ (U+20B9). If Noto came before Inter, every price on an Android phone would download the Hindi font. Inter comes first, and its `latin-ext` file draws the ₹. An e2e test proves it.
   - The wordmark uses `--font-brand-stack`, which starts at Inter, so the logo looks the same on every device.
   - **Surprise:** Chrome on a Mac reports `BlinkMacSystemFont` as `system-ui` in the computed `font-family`, so the font test treats the two as equal.

4. **Colours in three tones.** The values are hex codes on shadcn's own variable names, set in three scopes. `:root` is the white page, `.surface-grey` the grey band and `.dark` the black showcase band. Each scope redefines only what changes, so any component inside a band repaints itself. The site is light only: `.dark` is a band, not a dark mode. `design-tokens.test.ts` requires 4.5:1 contrast for text and 3:1 for field borders and focus outlines, in every tone. It also checks see-through fills such as `bg-destructive/90`, using `blend()`. Where apple.com's colours failed, we used a darker or lighter shade of the same colour. Measured for this doc with `src/lib/color-contrast.ts`:

   | Pair | apple.com's value | Ours |
   | --- | --- | --- |
   | Field border on the `#e8e8ed` fill (needs 3:1) | `#86868b`: 2.97 | `--input` `#808085`: 3.22 |
   | Small blue text on the grey band | `#0071e3`: 4.31 | `--link` `#0066cc`: 5.11 |
   | White text on the hovered button | lighter blue (fails) | `--primary-hover` `#0060c0`: 6.11 |
   | Secondary text on `#e8e8ed` | `#6e6e73`: 4.15 | `--muted-foreground` `#636366`: 4.90 |

   The test caught two more failures. shadcn's destructive button is red text on a 10% red tint, which measures 4.15:1 on a grey tile. So destructive buttons and badges are now solid red, with a new `--destructive-foreground`: white, or black inside `.dark`, where white on `#ff453a` is only 3.41:1. And the input's grey fill inside `.dark` was removed, because placeholder text on it was 3.89:1.

5. **Type scale, and the CSS-order trap.** Text sizes are `@utility type-*` classes (`type-hero` down to `type-caption`), not `--text-*` theme keys. That's because `cn()` would think an unknown `text-display` was a colour and drop it next to `text-muted-foreground`. Sizes use `clamp(min, rem + vw, max)`, so text grows with the screen and with browser zoom. Letter-spacing is set in `em`, so it scales with the size. Under `:lang(hi)` the letter-spacing goes back to 0 and lines get taller, because tight tracking breaks the line that joins Devanagari letters.

   **The trap:** Tailwind writes utilities that set many properties before those that set few, and when two rules are equally specific, the later one wins. We checked the order for this doc with a throwaway script that compiles `globals.css` with Tailwind (it's not in the repo):
   ```
   .type-body
   .text-sm
   .leading-tight
   .font-medium
   .text-muted-foreground
   ```
   So `text-sm` beats `type-body` on the same element. shadcn's Card used `text-sm`, so Card now uses `type-callout` and `type-title`. A new lint rule rejects stock sizes (`text-xs` to `text-9xl`). Real output for a component with `type-body text-sm` on line 7, `type-body text-[17px]` on line 8 and `type-body leading-tight` on line 9, piped in with `--stdin` so no file was edited:
   ```
     7:20  error  Use a type-* class (type-body, type-callout, type-title...) for text size. Tailwind puts text-sm, text-lg... after type-* in the CSS, so they would win  no-restricted-syntax

   ✖ 1 problem (1 error, 0 warnings)
   ```
   Lines 8 and 9 passed. That gap is known and written down in `CLAUDE.md`: reviewers check those by hand.

6. **Shape, depth, space and focus.**
   - **Radius:** each step is pinned to a fixed size: `rounded-xl` is 18px for tiles and `rounded-4xl` is a pill for badges. Buttons get `rounded-full` inside `button.tsx`, because turning `rounded-lg` into a pill would round the inputs too.
   - **Shadows:** `shadow-xs` is none. The soft shadows are only for layers that float over the page.
   - **Space:** `--section-space`, `--gutter`, `max-w-content` (980px) and `max-w-wide` (1280px). The `frosted` class makes a see-through, blurred bar for the header.
   - **Focus** is one `:focus-visible` rule outside any `@layer`: a 2px solid `--ring` outline, 2px away from the control. CSS outside a cascade layer beats everything inside one, and Tailwind's classes live in a layer, so this rule overrides shadcn's `outline-none` without `!important`. shadcn's half-transparent ring measures 2.09:1 on white, under the 3:1 a focus indicator needs.

7. **Motion.** `src/lib/motion.ts` holds the durations (in seconds) and the GSAP ease names. `globals.css` repeats them as `--duration-*` and `--ease-*`, and `motion.test.ts` fails if the two ever differ. When a visitor asks for reduced motion, durations become `0.01ms`, not `animation: none`: the animation still runs for an instant, so its end state applies and `animationend`/`transitionend` still fire. With `none`, an element that animates in from invisible would stay invisible, and code waiting for those events would never run. (The first version of this doc said Radix needed it to remove a closed Sheet. The code-reviewer checked Radix's code: with no animation, Radix removes it at once.) GSAP code goes inside `gsap.matchMedia()` with `motionAllowed` and `motionReduced`. `motion-demo.tsx` is the pattern task 13 will copy.

8. **Restyle the components.**
   - **Button:** a pill. `default` is 44px tall (`h-11`: one Tailwind step is 4px) and `lg` is 48px. `sm` (36px) and `xs` (32px) grow to 44px under `pointer-coarse:`, which matches when the main pointer is a finger.
   - **Card:** flat, with no ring or shadow. **Input:** 44px tall with 17px text. **Badge:** a new `success` variant.
   - **Sheet:** shadcn typed `<span className="sr-only">Close</span>`, English inside a folder lint skips. It's now a `closeLabel` prop, required unless `showCloseButton={false}`. The prop's type is a **union** (either-or) of those two cases, so forgetting the label fails `npm run typecheck`. Callers pass `t("close")` from `Common`.
   - Every edited file starts with an "Our changes to shadcn's ..." comment, and `restyle.test.tsx` checks the classes.

9. **Brand.**
   - **`Wordmark`** shows `Brand.name` in Inter, semibold, with `-0.025em` letter-spacing and `translate="no"`. Chrome offers Indian visitors automatic Hindi translation, which would otherwise translate the name.
   - **`Section`** takes `tone` (white, grey or dark) and `width`. It's the only file that writes `surface-grey` or `dark`.
   - **The icon** is an Inter Bold "G", converted to an SVG `<path>` by a throwaway script (not committed, and no new dependency). It's white on a `#1d1d1f` tile, with a light edge under `prefers-color-scheme: dark`. It has no `<text>`, because browsers draw favicon text with whatever font they happen to have.
   - **The brand-name guard** caught 7 files on its first run: the plan's own "GoMechanic changes" headers in five shadcn files, a comment in `globals.css` and the old icon's `aria-label`. The owner's rule (the name in one place) won, and the headers now say "Our changes".

10. **The dev-only gate.**
    ```ts
    export function devOnly(): void {
      if (process.env.NODE_ENV !== "development") notFound();
    }
    ```
    Next.js writes the value of `NODE_ENV` into the code at build time, so the production build prerenders the page as a static 404, and `notFound()` adds `noindex`. The page also exports `robots: { index: false }`, in case the gate ever changes. In `eslint.config.mjs`, `src/app/*/dev/**` joined the text guard's `ignores`. It wasn't added as a new block, because a second block's `no-restricted-syntax` list would replace the first one (lesson `lint-guards-test-real-jsx-shapes.md`). `*` matches exactly one folder, `[locale]`, so `src/app/[locale]/services/dev/` still follows the text rules, and `next/link` stays banned on dev pages. `lint-guards.test.ts` proves all three.

11. **The `/dev/design` page.** It shows the brand, every colour pair with its live contrast number, type samples with real garage copy (plus a Hindi line and a `formatRupees` price), the spacing, radius and shadow ladders, the motion demo, every component, and do-and-don't pairs. It also has a font switch. The owner works on a Mac, which always shows San Francisco. The switch removes the two Apple names from the stack so they can see Inter, the font most Android visitors get. It uses an inline style, so none of it reaches the production CSS.

12. **Browser checks against `next dev`.** `npm run test:design` uses `playwright.dev.config.ts` and `e2e/dev/`. It runs on port 3000 with `reuseExistingServer: true`: it reuses a running `npm run dev`, or starts one and stops it afterwards. (The owner's dev server had stopped, so the run started its own.) A second `next dev` in the same folder would just exit, because Next.js 16 locks the dev folder. The run measures touch targets, contrast, the focus outline, sideways scrolling, the Hindi font and reduced motion, and saves screenshots. Three bumps on the way:
    - **Screenshots:** Chrome full-page screenshots taller than 16,384px repeat the top of the page, so the page is saved in parts of at most 12,000px. That gives 11 PNGs in `test-results/design/screenshots/` (git-ignored), such as `design-375-inter-1-of-3.png`.
    - **A flaky test** (one that passes or fails by chance): "Play moves the tile over time" checked that the tile was still moving after about 300ms. The ease-out curve covers most of the distance early, and on a busy machine the check came too late. Now the page records the tile's position on every animation frame, and the test requires at least two frames partway along (commit `46a8ad4`). It passed 3 runs out of 3. The work session also made the demo jump instantly, and the test failed with `Expected: >= 2`, `Received: 0`, so it really catches a jump.
    - **A full disk:** `ENOSPC` (no space left) twice. We deleted 4.4 GB of old scratch copies.

13. **Stale CSS (not reproduced).** The work session saw four production builds use an old `globals.css`, served from Turbopack's on-disk build cache (`.next/cache/turbopack`). Deleting that folder fixed it. Three deliberate tries later never reproduced it, so the cause is unknown. `CLAUDE.md` now has a troubleshooting line for it.

14. **The owner's approval.** The owner reviewed `/dev/design` and the screenshots, and approved the look as it is on 2026-10-26. They said it "looks so good to see all at one place for developer" and asked whether the page stays. It does. The code stays, production answers it with a 404, and `CLAUDE.md` now makes it the **living catalogue**: any task that changes a token, a `type-*` style, or a `ui/` or `site/` component updates its sample there and runs `npm run test:design`.

15. **Docs.** We wrote MASTER.md by hand. ui-ux-pro-max's two searches suggested slate and red, then black and gold, which both contradict the brief, so its `--persist` option wasn't used. `CLAUDE.md` gained the "Design system" and "Development-only pages" rules. `features.md` and the master plan record the brand decision.

16. **SEO check.** Every page passed. We didn't apply the two suggestions (repo rule); they're filed for later tasks:
    - **Task 12:** add `src/app/[locale]/not-found.tsx`. Pages that call `notFound()` (`/dev/design` in production, and later unknown service pages) show a bare, unbranded page today.
    - **Task 42:** an `apple-icon` PNG (180×180) from the same letter design, plus `theme-color`.

17. **Review.**
    - **`ce-code-review`: "Ready with fixes".** Eight reviewer personas, nothing serious, four medium and three small findings. All fixed, with no change to the approved look:
      - An invalid field's red border was 50% see-through inside black sections: about 2.2:1, under the 3:1 minimum. shadcn's `dark:aria-invalid:border-destructive/50` is gone from Input and Button.
      - The contrast test checked a hand-typed list of see-through colours, so a component edit could slip past it. It now reads every see-through colour class in `src/components/ui/` and fails unless each is contrast-checked or on a commented "decorative" list. Changing `/90` to `/70` turned it red.
      - `restyle.test.tsx` didn't guard every change the file headers promise, and its pill check missed prefixed radius classes like `in-data-[slot=button-group]:rounded-lg`. Both are fixed, and small buttons now stay pills inside button groups.
      - The text-size rule banned a weight next to `type-*`, but Button, Wordmark and the preview page all do that, on purpose. We settled it: a weight is allowed (it wins, which is the point); stock sizes, and `leading-*`/`tracking-*` next to `type-*`, are not. `CLAUDE.md` and MASTER.md now say the same.
      - The Inter switch didn't reach the Sheet, which renders outside the page wrapper. It now sets the font on `<html>`.
      - Two testing gaps closed: every page under `src/app/*/dev/` must call `devOnly()` (task 15's `/dev/outbox` will show fake OTP codes), and `Section`'s paint classes are tested.
    - **`code-reviewer` agent: "Needs changes".** No code bugs, and it confirmed each `ce-code-review` fix. Five must-fixes, all in docs and the tracker, and all fixed:
      - The tracker didn't link or tick the learning doc.
      - This doc said the branch hadn't been pushed, but GitHub had it (step 19).
      - The Decisions table still banned the weight next to `type-*` that we had just allowed.
      - The reduced-motion reason was wrong. We had written that Radix needs an animation to remove a closed Sheet; the reviewer read Radix's code, and with no animation Radix removes it at once. The real reason is in step 7. A reason written from memory, never checked, had reached the code, this doc and the plan.
      - "Seven components restyled" contradicted the What table's six.

      We also took four of its five suggestions:
      - A new rule: never pass a `type-*` class to a component that sets its own. Tailwind's CSS order picks the winner, so `<CardTitle className="type-headline">` silently stays `type-title`.
      - The stock-size lint now also covers `.ts` files and dev pages.
      - Line swatches on `/dev/design` draw their contrast label in the text colour; it was 3.2–4.3:1.
      - The focus outline covers six more ARIA roles and `[tabindex]`.

      The fifth (gating Route Handlers under `dev/`) is noted under task 15, which creates the first one.

18. **Compound.** Would a future session repeat this without a written lesson? For one thing, clearly yes: `ce-plan` hung after writing its plan in both task 10 (about 21 hours lost) and task 11 (caught by a watcher in 10 minutes). We ran `ce-compound` (lightweight). It wrote `document/solutions/workflow-issues/ce-plan-child-session-hangs-use-idle-watcher.md`: start ce-plan in the background, start an idle watcher on the plan file at once, and stop the process when the file has been quiet for 10 minutes. Its watcher script was new, so we tested it before committing (exited, idle and still-waiting cases). The `type-*` ordering and the reduced-motion reason didn't get lessons: `CLAUDE.md`, MASTER.md, lint and the corrected comments now carry them.

19. **Pull request.** The owner pushed the branch to GitHub four times during the task, from VS Code, right after Claude's commits (13:36, 15:22, 15:31 and 15:39 on 2026-10-26; the first came before the look was approved). Claude didn't push during the task. The plan's "no push before approval" rule bound Claude, and the owner may push their own branch whenever they like. After the reviews, Claude asked who should push the rest, and the owner chose Claude. The owner then opens and merges the pull request on GitHub (CLAUDE.md step 11).

## Decisions worth knowing

| Choice | Why | What it costs |
| --- | --- | --- |
| Light only; `.dark` is a black band, not a dark mode | One look to get right, like apple.com's marketing pages | No dark theme that follows the phone's setting |
| Hex values, not OKLCH | The contrast test reads hex directly | Mixing colours in OKLCH isn't available |
| `type-*` utilities, not `--text-*` keys | `cn()` won't drop them | Never put a stock `text-*` size, or `leading-*`/`tracking-*`, next to them (a weight is fine), and never pass a second `type-*` to a component that sets one; lint catches only stock sizes |
| Inter preloaded for everyone | Android needs it; the wordmark uses it on Apple devices too | Apple visitors download one font file mostly used by the logo |
| Solid destructive buttons and badges | shadcn's tinted version failed 4.5:1 | A louder red than shadcn's default |
| A `devOnly()` gate, not `pageExtensions` or a proxy rule | One tested function, and the route stays static | Showing dev pages on staging later means changing it (tasks 15 and 20) |
| Typed demo text on dev pages | Messages currently ship to every visitor (task 12 trims that) | A narrow lint exception |
| MASTER.md written by hand | The skill's output contradicted the brief | It can drift from `globals.css`; the code wins |

## New ideas in this task

- **Design token:** a named design value (`--primary`, `rounded-xl`, `type-title`). Like paint codes in a garage: everyone asks for "brand blue" instead of mixing their own.
- **Font stack and `unicode-range`:** the list of fonts a browser tries, and the characters each font file covers. The browser downloads a file only when the page needs one of its characters.
- **Preload:** asking for a file from `<head>` before the page needs it, so text doesn't change font once it arrives.
- **Contrast ratio (WCAG AA):** how far apart two colours are in brightness, from 1:1 to 21:1. AA, the usual accessibility target, needs 4.5:1 for normal text and 3:1 for borders and focus outlines.
- **`clamp(min, preferred, max)`:** a CSS size that follows the screen but never goes below `min` or above `max`.
- **Cascade layer (`@layer`):** a named group of CSS rules. A rule outside every layer beats rules inside one, whatever their order.
- **`:focus-visible`:** the focus style that shows when you use the keyboard, not when you tap or click.
- **`pointer-coarse:`:** a Tailwind variant for screens where the main pointer is a finger.
- **Reduced motion:** a device setting (`prefers-reduced-motion`) for people who get dizzy or distracted by animation.
- **Touch target:** the area a finger can hit. 44px is Apple's minimum.
- **`NODE_ENV`:** `development` under `npm run dev`, `production` in a build, `test` under Vitest.
- **Living catalogue:** a page that shows every piece of the design, kept up to date as the design changes. Like a parts catalogue, but for UI.

## Check that it works

Real output from the work session (trimmed). `check`, `test:e2e` and `test:design` ran on the final code, after the review fixes (commit `23741ee`); the build's route list is from commit `01b2ebf` (no route changed since).

```bash
npm run check
```
```
 Test Files  15 passed (15)
      Tests  389 passed (389)
```

`npm run build` lists the preview page. Under production it's a static 404:
```
├   /[locale]/dev/design
│ ├ ◐ /[locale]/dev/design
│ └ ○ /en/dev/design
```

```bash
npm run test:e2e      # production build: fonts, 404s, the icon
```
```
  ✓   4 e2e/i18n.spec.ts:37:7 › pages that don't exist › /dev/design is a 404 with noindex in production (it exists only under next dev) (7.5s)
  ✓  14 e2e/smoke.spec.ts:138:5 › a price (₹) is drawn in Inter, so it never downloads the Hindi font (4.4s)
  16 passed (20.9s)
```

```bash
npm run test:design   # /dev/design under next dev, plus the screenshots
```
```
Running 17 tests using 2 workers
  ✓   8 e2e/dev/design-preview.spec.ts:170:7 › on a phone (375px, touch screen) › every visible button, button link and field is at least 44px tall; icon buttons are 44px wide (2.4s)
  17 passed (38.7s)
```

To look for yourself, run `npm run dev` and open http://localhost:3000/dev/design.

## Common mistakes

- **`type-body text-sm` on one element.** `text-sm` wins. To change a size, give the component a variant or size.
- **`text-[17px]` or a stacked `leading-*`.** Lint doesn't catch these, so look for them in review.
- **Raw colours** (`bg-blue-500`, `#0071e3` in a component). Use tokens: `bg-primary`, `text-link`.
- **Two blue buttons side by side.** One `default` button per group; the others are `secondary`, `outline` or `ghost`.
- **`npx shadcn add --overwrite` on an edited component.** It wipes the restyle, and `restyle.test.tsx` fails.
- **Typing the brand name.** Use `Wordmark` or `t()`, or `brand-name.test.ts` fails.
- **`animation: none` for reduced motion.** Animations then never reach their end state, so something that fades in from invisible stays invisible. Use the `0.01ms` rule in `globals.css`.
- **Passing a `type-*` class to a component that sets its own** (`<CardTitle className="type-headline">`). Tailwind's CSS order decides the winner, not your class order, so it silently stays `type-title`. Use a variant or size prop.
- **Expecting to see Inter on a Mac.** Your Mac picks San Francisco first. Use the font switch on `/dev/design`.
- **A CSS change missing from a build.** Delete `.next/cache/turbopack` and build again.
- **Timing an animation with waits in a test.** Sample it frame by frame, as `e2e/dev/design-preview.spec.ts` does.

## Try it yourself

About 10 minutes. Predict each answer first, and finish with `git status` showing a clean tree.

1. Secondary text was once going to be `#8e8e93`. Which surfaces would it fail on?
   ```bash
   fnm exec --using=24 -- node --no-warnings --input-type=module -e 'import { contrastRatio } from "./src/lib/color-contrast.ts"; for (const bg of ["#ffffff", "#f5f5f7", "#e8e8ed"]) console.log(bg, contrastRatio("#8e8e93", bg).toFixed(2), contrastRatio("#636366", bg).toFixed(2))'
   ```
   Node 24 runs a `.ts` file by stripping its types. `--input-type=module` lets `-e` use `import`, and `--no-warnings` hides a notice about the module type.
2. In `src/app/[locale]/page.tsx`, add `className="type-body text-sm"` to a `<p>` and run `npm run lint`. Then try `text-[17px]` instead. Revert.
3. Run `npm run dev` and open `/dev/design`. In Chrome DevTools, open the Rendering panel (⋮ → More tools → Rendering) and set "Emulate CSS media feature prefers-reduced-motion" to `reduce`. Press Play. Then press Tab until the first blue button has focus.

Answers: (1) from a real run, the first column is `#8e8e93` and the second `#636366`:
```
#ffffff 3.26 5.99
#f5f5f7 2.99 5.50
#e8e8ed 2.67 4.90
```
`#8e8e93` fails 4.5:1 everywhere. (2) `text-sm` fails with `no-restricted-syntax`, and `text-[17px]` passes (the gap shown in step 5). (3) The tile jumps straight to the end, and the button shows a solid 2px blue outline with a gap. `npm run test:design` checks both.

## Learn more

- Next.js (read the bundled copy first, in `node_modules/next/dist/docs/01-app/`): [`next/font`](https://nextjs.org/docs/app/api-reference/components/font) (subsets, `preload`, variables) and [`notFound()`](https://nextjs.org/docs/app/api-reference/functions/not-found).
- Tailwind CSS 4: [theme variables](https://tailwindcss.com/docs/theme), [custom utilities with `@utility`](https://tailwindcss.com/docs/adding-custom-styles#adding-custom-utilities) and [pointer variants](https://tailwindcss.com/docs/hover-focus-and-other-states#pointer-and-any-pointer).
- shadcn/ui: [theming with CSS variables](https://ui.shadcn.com/docs/theming).
- WCAG 2.2: [contrast (minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) and [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).
- MDN: [`unicode-range`](https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face/unicode-range), [`clamp()`](https://developer.mozilla.org/en-US/docs/Web/CSS/clamp), [`@layer`](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer), [`prefers-reduced-motion`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion).
- GSAP: [`gsap.matchMedia()`](https://gsap.com/docs/v3/GSAP/gsap.matchMedia()) and [React and `useGSAP`](https://gsap.com/resources/React).
- Playwright: [running a web server before the tests](https://playwright.dev/docs/test-webserver).
