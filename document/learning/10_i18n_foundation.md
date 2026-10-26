# 10_i18n_foundation: English now, Hindi later, without moving pages

> **Branch:** `10_i18n_foundation` · **Date:** 2026-10-26 · **Status:** In progress

## In one minute

The site launches in English only, but the owner wants Hindi later "without rework". This task added **next-intl** (a translation library for Next.js) and moved every page under a `src/app/[locale]/` folder. All the text people read now lives in `messages/en.json`. It also added tested helpers that show money as `₹1,23,456` and dates in India time, wherever the server runs. The home page looks the same: `/` is still `/`, with the same heading. Full details: [the plan](../plans/2026-10-25-1448-feat-i18n-foundation-plan.md) (requirements R1–R11, decisions KTD1–KTD12).

## Why: the problem we solved

Before this task, the app had one layout with `lang="en"` typed in, and the home page text typed straight into the JSX. Three problems were waiting:

- **Adding Hindi later would mean moving every page.** In Next.js, a language in the URL (`/hi/services`) needs a folder such as `[locale]` above every page. A **locale** is a language code, like `en` or `hi`. Today that move touches two files (`layout.tsx` and `page.tsx`). After tasks 11–46 it would touch dozens, plus a hunt for every hard-coded sentence.
- **Indian numbers look wrong by default.** JavaScript's built-in formatter, **`Intl`**, groups digits the Western way for plain `en`: `₹123,456`. Indians write `₹1,23,456`. A **lakh** is 1,00,000 (one hundred thousand) and a **crore** is 1,00,00,000 (ten million).
- **Servers don't live in India.** Vercel's servers run in UTC, the world's reference clock, 5½ hours behind India. A booking at 01:30 on 26 Oct in India is still 20:00 on 25 Oct in UTC. Without care, the site would show the wrong day.

There was also a technical risk. The usual next-intl setup reads a request header, and reading headers makes a page render on every request instead of once at build time. With Cache Components (task 09) that would throw away our fast static pages.

## What: what changed

| File or folder | Change | Why it exists |
| --- | --- | --- |
| `package.json`, `package-lock.json` | Changed | Adds `next-intl` pinned to exactly `4.14.9` (no `^`) |
| `next.config.ts` | Changed | Wraps the config with next-intl's plugin; turns on `experimental.globalNotFound` |
| `src/proxy.ts` | Added | Runs before each page request: sends `/` to the English pages, redirects `/en` to `/` |
| `src/i18n/config.ts` | Added | The locale list (`["en"]`), the `en` → `en-IN` formatting map, and `GARAGE_TIME_ZONE` |
| `src/i18n/routing.ts` | Added | next-intl routing with `localePrefix: "as-needed"` |
| `src/i18n/request.ts` | Added | Per request: which locale, which messages, which time zone. Unknown locale → 404 |
| `src/i18n/navigation.ts` | Added | Language-aware `Link`, `redirect`, `useRouter`, `usePathname` |
| `src/i18n/global.ts` | Added | Types for message keys, so a typo fails `npm run typecheck` |
| `src/i18n/format.ts` + test | Added | `formatRupees`, `formatDate`, `formatTime` |
| `src/i18n/localized-text.ts` + test | Added | `LocalizedText` type and `localize()` for text stored in the database |
| `src/i18n/messages.test.ts` | Added | Every message in `en.json` is a non-empty string |
| `src/i18n/lint-guards.test.ts` | Added | Lints bad and good snippets with the real config, so the lint guards can't quietly stop working (added after review) |
| `src/i18n/test-utils.tsx` | Added | `renderWithIntl`: renders a component with the real English messages |
| `messages/en.json` | Added | All UI text, in three groups: `Metadata`, `HomePage`, `NotFound` |
| `src/app/layout.tsx` | Removed | Replaced by `src/app/[locale]/layout.tsx`, the new root layout |
| `src/app/[locale]/layout.tsx` | Added | `<html lang>` from the locale, the font, the next-intl provider, metadata from messages |
| `src/app/[locale]/page.tsx` + test | Moved | Same page, text now from `useTranslations("HomePage")` |
| `src/app/fonts.ts` | Added | One Geist font definition shared by the layout and the 404 page |
| `src/app/global-not-found.tsx` | Added | The 404 page for any URL that matches no route |
| `eslint.config.mjs` | Changed | Guards: no plain `next/link` or locale-dropping redirects, no text typed into JSX (between tags, in conditions, in reader-facing attributes) |
| `e2e/i18n.spec.ts` | Added | 7 browser tests: `/en` and `/en/<page>` redirects, 404s, the icon, prerendering |
| `e2e/smoke.spec.ts` | Changed | Reads the expected heading from `messages/en.json` |
| `document/solutions/conventions/lint-guards-test-real-jsx-shapes.md` | Added | The compound lesson (step 16) |
| `CLAUDE.md`, `readme.md`, `document/task/task.md` | Changed | Repo map, the new language rules, tracker ticks; task 12's 404 step now names `global-not-found.tsx` |

## How: step by step

1. **Plan.** `ce-plan` wrote the plan, then its session hung for about 21 hours (the computer went to sleep) before its automatic document review. We stopped it and used the written plan as it was. So, honestly: **the plan was never reviewed by the plugin's reviewer personas.** A spike (a quick throwaway trial in a scratch copy of the repo) had already shown the approach works.

2. **Install next-intl, pinned.** Real output when this doc was written (path shortened):
   ```bash
   npm ls next-intl @swc/core @parcel/watcher
   ```
   ```
   go-mechanic@0.1.0 …/go-mechanic
   └─┬ next-intl@4.14.9
     ├── @parcel/watcher@2.6.0
     └── @swc/core@1.16.20
   ```
   next-intl brings two helpers with install scripts. npm 11 skipped their scripts, and we left them unapproved: `check` and `test:e2e` pass without them. `CLAUDE.md`'s install-scripts rule now names them next to `unrs-resolver` and `fsevents`.

3. **Two kinds of locale.** URLs use short codes (`en`, later `hi`). Formatting uses `en-IN` (later `hi-IN`), through `intlLocales` in `src/i18n/config.ts`. Why two? Re-run for this doc on Node 24:
   ```bash
   fnm exec --using=24 -- node -e 'for (const l of ["en", "en-IN"]) console.log(l, new Intl.NumberFormat(l, { style: "currency", currency: "INR" }).format(1234567.5))'
   ```
   ```
   en ₹1,234,567.50
   en-IN ₹12,34,567.50
   ```
   Using `en-IN` in the URL instead would make Hindi URLs `/hi-IN/...`. (`fnm exec --using=24 --` runs one command with Node 24, whatever your shell is on.)

4. **Move the pages under `[locale]`.** `src/app/[locale]/layout.tsx` is now the root layout (the outermost one, with `<html>`). There is deliberately **no** `src/app/layout.tsx` above it. If there were, that would become the root, and `locale` would stop being a **root param** (a URL segment Next.js lets any server code read). The layout's `generateStaticParams` returns `[{ locale: "en" }]`: with Cache Components, every root param needs at least one value known at build time, or the build fails. The page stays a plain, non-async function using `useTranslations`, so unit tests can render it.

5. **Read the locale without headers.** `src/i18n/request.ts` takes the locale from `next/root-params` (new in Next.js 16.3). Next.js treats it as part of the cache key, so pages stay static. We rejected next-intl's older way, calling `setRequestLocale` in every page and layout: next-intl calls it legacy, and one forgotten call makes that page dynamic. Then:
   ```ts
   if (!hasLocale(routing.locales, locale)) notFound();
   ```
   **Bug this caught:** before that line existed, `/favicon.ico` was treated as a page in a language called `"favicon.ico"` and answered 200 with the home page. Now it's a 404.

6. **The proxy.** Next.js 16 renamed "middleware" to **proxy**: code that runs before a request reaches a page. `src/proxy.ts` is next-intl's middleware with this matcher:
   ```ts
   matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
   ```
   `(?!...)` means "unless the path starts with". So the proxy skips `/api...`, Next.js internals (`/_next`, `/_vercel`) and **any path with a dot**, because those are files (`/icon.svg`, later `/robots.txt`). That's why page slugs must never contain a dot (now a `CLAUDE.md` rule). `localePrefix: "as-needed"` means the default language gets no prefix: `/` is English, `/hi/...` will be Hindi, and `/en` redirects to `/`.

7. **A 404 page outside `[locale]`.** With the root layout inside `[locale]`, a URL like `/this-page-does-not-exist` has no layout to render a normal 404 inside. The Next.js docs name this exact case for `global-not-found.tsx`. It renders its own `<html>` and `<body>`, imports the CSS and font itself, and passes the locale explicitly (it can't read it from the URL). It's still experimental, so `next.config.ts` turns on `experimental.globalNotFound`, and the e2e tests guard it. Two bumps on the way:
   - ESLint's `@next/next/no-html-link-for-pages` rejected a plain `<a href="/">`, so it uses `next/link`. Our own lint rule (step 10) then exempts this one file.
   - A spike moved `icon.svg` into `[locale]/`. Its URL became the broken `/-/icon.svg`, so it stays at `src/app/icon.svg`. It's still linked in `<head>`, and an e2e test checks that.

8. **Money, dates and database text (tests first).** In `src/i18n/format.ts`:
   - `formatRupees(paise, locale)` takes **paise** (100 paise = ₹1) as a whole number. Computers store decimals inexactly (`0.1 + 0.2` is `0.30000000000000004`), so money is never a decimal. Input that isn't a **safe integer** (a whole number JavaScript stores exactly, up to 2⁵³ − 1) throws a `RangeError`.
   - `formatDate` and `formatTime` pass `timeZone: "Asia/Kolkata"` on every call. One test sets `process.env.TZ = "America/Los_Angeles"` to prove the computer's own time zone doesn't matter.
   - `localize(text, locale)` picks the Hindi text from a `LocalizedText` (`{ en, hi? }`), falling back to English when it's missing or blank.

   The expected strings were copied from a real run: `"₹1,23,456"`, `"₹1,00,00,000"`, `"₹499.50"`, `"₹1"`, `"₹0"`, `"-₹100"`, `"26 Oct 2026"`, `"25 Oct 2026"`, `"10:00 am"`, `"6:15 pm"`. The plan guessed Node might use a special narrow space before "am". It doesn't: the character is a normal space.

9. **Typed message keys.** `src/i18n/global.ts` tells TypeScript the shape of `en.json` (this is called **module augmentation**: adding our types to a library's types). Checked for this doc with a scratch file containing `t("titel")`, outside the repo:
   ```
   typo.ts(4,12): error TS2345: Argument of type '"titel"' is not assignable to parameter of type 'NamespacedMessageKeys<{ Metadata: { title: string; description: string; }; HomePage: { title: string; tagline: string; }; NotFound: { title: string; description: string; backHome: string; }; }, "HomePage">'.
   ```

10. **Lint guards** (`eslint.config.mjs`):
    - `no-restricted-imports` blocks `next/link`, and `redirect`, `permanentRedirect`, `useRouter` and `usePathname` from `next/navigation`. Use `@/i18n/navigation` instead. A plain link would silently drop `/hi` once Hindi exists, and on an English-only site nobody would notice.
    - `react/jsx-no-literals` (`noStrings`, `ignoreProps`) rejects text typed between tags in `src/app/**` and `src/components/**`, except test files and shadcn's `src/components/ui/`. `ignoreProps` lets `className` and `href` through, because they aren't text people read.
    - `no-restricted-syntax` fills the holes `jsx-no-literals` leaves (both reviews found them, step 15): text chosen by a condition (`{isOpen ? "Open now" : "Closed"}`, `{error && "Oops"}`, and one condition inside another), and text in attributes people read or hear: `alt`, `title`, `placeholder`, `aria-label` and four other `aria-` text attributes, typed or chosen by a condition. Not all `aria-*`: `aria-hidden="true"` is a setting, not text.
    - `src/i18n/lint-guards.test.ts` lints small snippets with the real config (`new ESLint().lintText(...)`), so a later config change can't switch the guards off unnoticed.

    Checked for this doc, before the review added the `no-restricted-syntax` part, by piping a bad page into ESLint (`--stdin` lints text as if it were that file, so nothing was edited):
    ```
       2:1   error  'next/link' import is restricted from being used. Use the version from @/i18n/navigation: it keeps the language prefix (/hi/...) in the URL         no-restricted-imports
       3:10  error  'useRouter' import from 'next/navigation' is restricted. Use the version from @/i18n/navigation: it keeps the language prefix (/hi/...) in the URL  no-restricted-imports
       9:10  error  Strings not allowed in JSX files: "Hello"                                                                                                           react/jsx-no-literals
      10:11  error  Strings not allowed in JSX files: ""Wrapped""                                                                                                       react/jsx-no-literals

    ✖ 4 problems (4 errors, 0 warnings)
    ```
    The same page's `href="/x"` and `className="a"` were not flagged.

11. **Prove it's still prerendered.** To **prerender** is to build a page's HTML once, at build time, instead of on every visit. Real output of the work session's `npm run build`:
    ```
    Route (app)
    ┌ ○ /_not-found
    ├   /[locale]
    │ ├ ◐ /[locale]
    │ └ ○ /en
    └ ○ /icon.svg


    ƒ Proxy (Middleware)

    ○  (Static)             prerendered as static content
    ◐  (Partial Prerender)  prerendered as static HTML with dynamic server-streamed content
    ```
    The key line is `○ /en`: the English home page is static HTML. `/_not-found` is the 404 page, built from `global-not-found.tsx`. The browser test then checks the response headers of `/`. **Surprise:** Next.js 16.4 sends `x-nextjs-prerender` twice, so Playwright reads `"1, 1"` and the first version of the test failed. It now matches `/^1(, 1)*$/`.

12. **A dotted path ends on a plain error page.** `/foo.bar` skips the proxy (it has a dot), reaches `[locale]` as locale `"foo.bar"`, and `request.ts` calls `notFound()`. That happens inside the root layout itself, so Next.js falls back to its bare error page (`<html id="__next_error__">`), not our 404 design. It is still status 404 with `noindex`, so we accepted it. The "no dots in slugs" rule keeps real pages away from it.

13. **Docs.** `CLAUDE.md` gained repo-map rows and a "Languages (next-intl)" list of rules. `readme.md` gained one line on languages. `task.md` ticks the build steps and points task 12's 404 at `global-not-found.tsx`. The work session also ran `npm run dev`: `/` gave 200, `/en` 307 and `/nope` 404, and `next dev` didn't rewrite `AGENTS.md`.

14. **SEO check.** The SEO Stop hook listed the changed page files, and the `seo-reviewer` agent checked `/`, the 404 page and the language URLs on the production build. **All three pass**, with only nice-to-have suggestions. None was applied (repo rule); they were added to later tasks in `task.md` instead:
    - Every page ships all of `messages/en.json`, because `NextIntlClientProvider` gets every message by default. Pass only what client components need (task 12).
    - The 404 title is just "Page not found": `global-not-found.tsx` doesn't get the layout's title template, so add the brand (task 12).
    - `/foo.bar` (or an old `/index.html` link) shows a blank error page. Narrowing the proxy matcher to real file extensions would send those to the designed 404 (task 12).
    - When Hindi ships, next-intl's proxy starts sending an hreflang `Link` header. Pick one source of hreflang, that header or metadata, not both (task 42).
    - Title, description, canonical, Open Graph, JSON-LD, robots and sitemap are waiting for task 42, as planned.

15. **Review.** Two reviews, in order:
    - **`ce-code-review`: "Ready with fixes".** Seven reviewer personas, no serious findings, three medium and two small. Fixed:
      - The text guard let `{isOpen ? "Open now" : "Closed"}` and typed `alt`, `aria-label`, `placeholder` and `title` through. Added `no-restricted-syntax`, widened the guard to all of `src/components/` except `ui/`, and added `src/i18n/lint-guards.test.ts`. Switching the new parts off (the selectors and the wider folder list) made 5 of its tests fail, which proves they test something.
      - `../fonts` imports instead of `@/app/fonts`, and a time-zone test that left the text `"undefined"` in `process.env.TZ`.
      - Two of its "residual risks", each with a test written first and seen failing: `formatRupees(-0)` printed `"-₹0"` (fixed with `signDisplay: "negative"`), and `localize(text, "constructor")` crashed instead of falling back to English (fixed with `Object.hasOwn`).
      - A new browser test: `/en/services` redirects to `/services`.
      - One finding was a choice: dotted URLs like `/foo.bar` get Next's bare error page (step 12). We kept next-intl's standard matcher. The alternative, a hand-made list of file extensions, would make any public file type missing from the list return 404 with no warning. The trade-off is noted under task 12.
    - **`code-reviewer` agent: "Needs changes".** The code passed, including security checks: no open redirect, and a URL can't load any file except a messages file. Two must-fixes: this doc still described the code before the fixes above, and the tracker's "Write the learning doc" box wasn't ticked. Both are fixed. We also took its suggestions: the guard now catches a condition inside a condition, `aria-label={isOpen ? "Close menu" : "Open menu"}`, `aria-roledescription` and `aria-placeholder`. `CLAUDE.md` adds "slugs never start with `api`" and lists `global.ts`. It agreed with the dotted-URL decision. My first try at the conditional-`aria-label` selector was wrong, and the new lint-guards test caught it before the commit.

16. **Compound.** Would a future session repeat this without a written lesson? Yes. The plan's hand check ("add `<p>Hello</p>`, see lint fail") passed while the guard missed most real text, and it took two review rounds to find every hole. So we ran `ce-compound` (lightweight). Its helper session wasn't allowed to write into the repo and left a draft. We copied it to `document/solutions/conventions/lint-guards-test-real-jsx-shapes.md` after re-running its two unchecked claims: switching the rule off fails exactly 7 tests, and the `:matches` selector mistake above really happened. The doubled `x-nextjs-prerender` header and the dotted-URL 404 didn't get lessons: the test comment, this doc and the task 12 note already cover them.

17. **Hand-over through a pull request.** GitHub had moved on: the owner had merged task 09 there as PR #2, from an older copy of its branch, and had opened PR #3 for this task. Asked how to merge, the owner chose the pull request. So from this task on, Claude pushes the task branch (after asking) and the owner merges the pull request on GitHub, instead of Claude running `git merge --no-ff` locally. The "mark done" commit becomes the first commit on the next task's branch, so `main` only changes through pull requests. `CLAUDE.md` step 11, `task.md`'s "How to add a task" and the `code-reviewer` agent now say so.

## Decisions worth knowing

| Choice | Why | What it costs |
| --- | --- | --- |
| `[locale]` now, before real pages | Two files to move today, dozens later | A slightly more complex folder tree for an English-only site |
| `localePrefix: "as-needed"` | English URLs stay clean (`/`) | `/en` must redirect (307) to `/` |
| Route `en`, format with `en-IN` | Indian grouping and dates, short Hindi URLs | Always format through our helpers, not raw `Intl` with the route locale |
| `next/root-params`, not `setRequestLocale` | Pages stay static with no per-page call to forget | Server Actions and Route Handlers can't read it: they pass the locale themselves |
| Money as integer paise | No rounding errors | Every price is ×100 in the database and code |
| `global-not-found.tsx` (experimental) | The only clean 404 when the root layout is under `[locale]` | It might change in a later Next.js; e2e tests guard it |
| Dotted URLs get Next's bare 404 | Still a 404 with `noindex`; fixing it means more routing code | Never use a dot in a page slug |
| next-intl pinned exactly | Root-params support is new; no surprise upgrades | Upgrades are a deliberate task |

## New ideas in this task

- **i18n:** short for "internationalization" (18 letters between the i and the n). Building an app so it can show more than one language.
- **Locale:** a code for a language, sometimes with a region: `en`, `hi`, `en-IN` (English as written in India).
- **`Intl`:** JavaScript's built-in formatter for numbers, money and dates in any locale.
- **Paise, lakh, crore:** 100 paise make ₹1. A lakh is 1,00,000 and a crore is 1,00,00,000.
- **Time zone (`Asia/Kolkata`):** the official name for India Standard Time (UTC + 5:30). Like setting a wall clock to Delhi time, whichever city the server sits in.
- **Messages and namespaces:** `messages/en.json` holds every sentence by key. A namespace (`HomePage`) is a group of keys, like a chapter in a phrasebook.
- **Proxy:** Next.js 16's name for middleware: code that runs before a request reaches a page, like a receptionist who sends you to the right room.
- **Root layout and root param:** the outermost layout (it renders `<html>`). A dynamic folder above it, like `[locale]`, becomes a root param any server code can read.
- **Prerender:** build the page's HTML once at build time and serve the same copy to everyone, like printing flyers instead of handwriting each one.
- **Safe integer:** a whole number JavaScript stores exactly (up to 9,007,199,254,740,991).
- **Module augmentation:** adding your own types to a library's types, here to make message keys type-checked.

## Check that it works

Re-run on the final code after the review fixes, with Node 24 (output trimmed):

```bash
npm run check
```
```
 Test Files  6 passed (6)
      Tests  49 passed (49)
```

```bash
npm run test:e2e
```
```
Running 11 tests using 4 workers
  ...
  11 passed (15.4s)
```

That is the 4 smoke tests plus 7 in `e2e/i18n.spec.ts`. To poke the production server yourself, run `npm run build`, then `npm run start -- -p 3213` (`--` passes `-p 3213`, the port, through to `next start`), and in a second terminal:

```bash
curl -sI http://localhost:3213/      # -I: headers only
curl -sI http://localhost:3213/en
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3213/foo.bar   # print only the status code
```

Real output when this doc was written (selected headers):

```
HTTP/1.1 200 OK
x-nextjs-cache: HIT
x-nextjs-prerender: 1
x-nextjs-prerender: 1
x-nextjs-stale-time: 300
Cache-Control: s-maxage=31536000

HTTP/1.1 307 Temporary Redirect
location: /

404
```

`s-maxage=31536000` lets a CDN cache the page for a year (31,536,000 seconds), which only makes sense for a prerendered page. `/this-page-does-not-exist` and `/hi` also gave 404, `/icon.svg` 200.

## Common mistakes

- **`import Link from "next/link"` in a page.** Lint stops it. Use `Link` from `@/i18n/navigation`, or `/hi` visitors will be sent to English pages.
- **Typing a sentence into JSX.** Lint stops it too. Add a key to `messages/en.json` and use `t("key")`.
- **Passing rupees as a decimal**, like `formatRupees(19.99 * 100, "en")`. `19.99 * 100` isn't exactly 1999, so it throws. Store and pass paise from the start.
- **`date.toLocaleDateString()` without a `timeZone`.** It uses the server's zone and shows the wrong day near midnight. Use `formatDate`.
- **Formatting with `"en"` directly.** You get `₹123,456`. Go through `formatRupees`, which maps to `en-IN`.
- **Adding `src/app/layout.tsx` "to share something".** It would become the root layout, and `locale` would stop being a root param.
- **A dot in a page slug** (`/v1.2-notes`), **or a slug starting with `api`** (`/apiary`). The proxy skips both, so the first part of the path is read as a language and the page returns 404. Use dashes, and another first word.
- **Asserting an exact `x-nextjs-prerender` value.** It arrives as `1, 1`.
- **Trusting a lint guard tested only with `<p>Hello</p>`.** Test the shapes real code uses (conditions, `aria-label`), as `src/i18n/lint-guards.test.ts` does.
- **Moving `icon.svg` into `[locale]/`.** Its URL becomes `/-/icon.svg`.

## Try it yourself

About 10 minutes. Predict each answer before you run it. Finish with `git status` showing a clean tree.

1. Why does `formatRupees` refuse decimals?
   ```bash
   fnm exec --using=24 -- node -e 'console.log(19.99 * 100, Number.isSafeInteger(19.99 * 100))'
   ```
2. Which day is it in India at 20:00 UTC on 25 Oct?
   ```bash
   fnm exec --using=24 -- node -e 'const d = new Date("2026-10-25T20:00:00Z"); for (const tz of ["UTC", "Asia/Kolkata"]) console.log(tz, d.toLocaleString("en-IN", { timeZone: tz }))'
   ```
3. In `src/app/[locale]/page.tsx`, change `t("title")` to `t("titel")` and run `npm run typecheck`. Which error code? Revert.
4. In the same file, add `<p>Hello</p>` and run `npm run lint`. Then move "Hello" into `messages/en.json` as `HomePage.hello`, show it with `t("hello")`, and run lint again. Revert both files.

Answers from real runs: (1) `1998.9999999999998 false`; (2) `UTC 25/10/2026, 8:00:00 pm` and `Asia/Kolkata 26/10/2026, 1:30:00 am`; (3) `TS2345` (checked with a scratch file, see step 9); (4) `react/jsx-no-literals` flags `"Hello"` (step 10). The `t("hello")` version passes, just like the page's existing `t("title")`.

## Learn more

- [next-intl: App Router setup with locale routing](https://next-intl.dev/docs/getting-started/app-router/with-i18n-routing) and [routing configuration (`localePrefix`)](https://next-intl.dev/docs/routing/configuration): the setup we followed.
- [next-intl: Next.js root params](https://next-intl.dev/blog/nextjs-root-params): why `next/root-params` replaces `setRequestLocale`.
- [next-intl: TypeScript](https://next-intl.dev/docs/workflows/typescript) and [testing](https://next-intl.dev/docs/environments/testing): typed keys and `renderWithIntl`'s pattern.
- Next.js (read the bundled copy first, in `node_modules/next/dist/docs/01-app/`): [internationalization](https://nextjs.org/docs/app/guides/internationalization), [`next/root-params`](https://nextjs.org/docs/app/api-reference/functions/next-root-params), [proxy](https://nextjs.org/docs/app/api-reference/file-conventions/proxy), [`not-found` and `global-not-found`](https://nextjs.org/docs/app/api-reference/file-conventions/not-found).
- MDN: [`Intl.NumberFormat`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat), [`Intl.DateTimeFormat`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat) (`timeZone`), [`Number.isSafeInteger`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/isSafeInteger).
- ESLint: [`no-restricted-imports`](https://eslint.org/docs/latest/rules/no-restricted-imports) and [`react/jsx-no-literals`](https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/jsx-no-literals.md).
