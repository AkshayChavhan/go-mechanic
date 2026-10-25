# 09_app_setup: A working Next.js app, and one command that checks it

> **Branch:** `09_app_setup` · **Date:** 2026-10-25 · **Status:** In progress (review pending)

## In one minute

Until now the repo had plans, rules and agents, but no website. This task put a Next.js 16.4.3 app at the repo root, running on Node 24. It comes with shadcn/ui (on Radix), GSAP, Vitest unit tests and one Playwright browser test. It also added `npm run check`, one command that runs lint, type checks and unit tests and stops at the first failure. Tasks 10–46 build on this app and run that command before calling any work done. Full details: [the plan](../plans/2026-10-25-1300-chore-app-setup-plan.md).

## Why: the problem we solved

Every later task needs an app to build on, plus one command that says "everything still works". An earlier attempt at this task was reverted after review, for three reasons:

- type checking failed on a fresh clone;
- lint and type checks also checked the third-party skill files in `.claude/`;
- the font variable didn't match what shadcn's theme reads, so text fell back to a serif font.

This attempt fixes all three, and a check or test now guards each one. Planning found a fourth problem: the newest Vitest and jsdom no longer run on Node 20, the version this machine's shell was using. Node 20 has had no security fixes since 2026-04-30.

## What: what changed

| File or folder | Change | Why it exists |
| --- | --- | --- |
| `.nvmrc`, `package.json` (`engines`) | Added | Pin Node 24. fnm reads `.nvmrc`, and npm warns if `engines` doesn't match. |
| `package.json`, `package-lock.json` | Added | Dependencies and the scripts `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:watch`, `check`, `test:e2e` |
| `next.config.ts`, `AGENTS.md` | Added | From the scaffold. Cache Components, partial prefetching and the Tailwind loader. Next.js's notes for AI agents. |
| `tsconfig.json`, `eslint.config.mjs` | Added | From the scaffold, plus rules to skip `.claude/` |
| `.gitignore` | Changed | Adds Playwright output, `.vercel` and `*.pem` |
| `components.json`, `src/lib/utils.ts` | Added | shadcn's settings and its `cn()` helper |
| `src/app/layout.tsx`, `page.tsx`, `globals.css` | Added | Placeholder page and metadata, Geist font on `--font-sans`, shadcn theme, Tailwind limited to `src/` (minus test files) |
| `src/app/icon.svg` | Added | Placeholder site icon. Without it, `/favicon.ico` returned 404. |
| `vitest.config.mts`, `vitest.setup.ts` | Added | Two test projects (Node and jsdom), and cleanup between component tests |
| `src/lib/utils.test.ts`, `src/app/page.test.tsx` | Added | One logic test file and one component test file (5 tests) |
| `playwright.config.ts`, `e2e/smoke.spec.ts` | Added | 4 browser checks against a production build in your installed Chrome |
| `CLAUDE.md`, `readme.md` | Changed | Stack versions, commands, code conventions, `@AGENTS.md` import, how to run |
| `document/plans/2026-10-25-1300-chore-app-setup-plan.md`, `document/task/task.md` | Added / Changed | The plan, and the tracker row and ticks |

## How: step by step

1. **Branch and plan.** `ce-plan` wrote the plan. Its reviewer agents suggested four fixes, and all four went in before the commit:
   - compare the Playwright browser cache before and after the e2e run;
   - limit which files `shadcn init` may change;
   - require `test:e2e` to pass before every merge;
   - clean up between component tests.

2. **Choose the Node version (the owner's decision).** Planning asked npm which Node versions the test tools accept. Re-run for this doc:
   ```bash
   npm view vitest@5.0.5 engines.node
   npm view jsdom@30.1.3 engines.node
   ```
   ```
   ^22.12.0 || ^24.0.0 || >=26.0.0
   ^22.22.2 || ^24.15.0 || >=26.0.0
   ```
   Node 20 is in neither range. Switching Node is a machine-wide change, so Claude asked first, and the owner chose **Node 24 LTS**. `fnm install 24` printed `Installing Node v24.22.1 (arm64)`, then `warning: Version already installed at ...`. Node 24 was already installed, and was even fnm's default, so nothing new was installed. The version is pinned in `.nvmrc` (`24`) and in `engines` (`^24.15.0 || >=26.0.0`: jsdom's lowest Node 24, and skipping Node 25, which Vitest and jsdom reject). `@types/node` moved to `^24`, because Vitest 5 expects `^22 || >=24`.

3. **Delete the leftovers.** A removed scaffold had left `node_modules/`, `.next/`, `next-env.d.ts` and `tsconfig.tsbuildinfo` behind. Before deleting them, we checked that git ignores them and tracks none. The command (re-run now that the install has created them again):
   ```bash
   git check-ignore -v node_modules .next next-env.d.ts tsconfig.tsbuildinfo
   ```
   ```
   .gitignore:2:node_modules/	node_modules
   .gitignore:5:.next/	.next
   .gitignore:10:next-env.d.ts	next-env.d.ts
   .gitignore:9:*.tsbuildinfo	tsconfig.tsbuildinfo
   ```
   `-v` shows which `.gitignore` line matches each path.

4. **Scaffold in a scratch folder and copy it in.** `create-next-app` refuses to run in a folder that isn't empty, so we ran it somewhere else, on Node 24:
   ```bash
   npx create-next-app@16.4.3 go-mechanic --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --cache-components --agents-md --disable-git --empty --yes
   ```
   - `--ts --tailwind --eslint --app --src-dir` choose TypeScript, Tailwind, ESLint, the App Router and a `src/` folder.
   - `--import-alias "@/*"` lets you write `@/lib/utils` instead of `../../lib/utils`.
   - `--cache-components` turns on Cache Components, and `--agents-md` writes `AGENTS.md`.
   - `--disable-git` skips creating a git repo inside the scratch folder.
   - `--empty` gives a bare page with no sample images.
   - `--yes` accepts the defaults without asking.

   We copied in `package.json`, `package-lock.json`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `AGENTS.md` and `src/app/`, but **not** its `README.md` (see Common mistakes). Then we:
   - excluded `.claude/` from ESLint and TypeScript;
   - made `typecheck` run `next typegen` first;
   - wrote an honest placeholder page.

   `npm install` (npm 11) printed `npm warn install-scripts 1 package has install scripts not yet covered by allowScripts: unrs-resolver@1.12.2 (postinstall: node postinstall.js)`. We left that script unapproved, and lint works without it. (On a fresh clone `npm ci` also lists `fsevents`, a macOS file-watching helper; it stays unapproved too. `npm ci` also warns that ESLint 9 is end-of-life. Upgrading to ESLint 10 is on the backlog, for when `eslint-config-next`'s plugins support it.)

5. **shadcn/ui and GSAP.** We ran `shadcn init` with these flags:
   - `--base radix`: use the Radix primitives;
   - `--preset nova`: the look, saved as `"style": "radix-nova"`;
   - `--pointer`: a pointer cursor on buttons;
   - `--no-monorepo` and `-y`: no questions asked.

   It added `components.json`, `src/lib/utils.ts`, the theme in `globals.css` and the Geist font on `--font-sans` in `layout.tsx`. Then we installed `gsap` and `@gsap/react`. We checked that each new package comes from the project it claims to be (`npm view <pkg> repository.url`). For example, `cn` printed `git+https://github.com/shadcn-ui/cn.git` and `radix-ui` printed `git+https://github.com/radix-ui/primitives.git`.

6. **Limit Tailwind to `src/`.** Tailwind builds CSS only for class names it finds in your files. By default it reads every file git doesn't ignore, and that includes `.claude/` skill data. Before the fix, the built CSS was **44,029 bytes**. It contained `animate-pulse`, `bg-gradient-to-r` and `space-y-4`, which appear in 7, 2 and 3 files under `.claude/` and in none under `src/`. One line at the top of `src/app/globals.css` fixed it: `@import "tailwindcss" source("../");`. The path is relative to the CSS file, so it means `src/`. Right after the fix the CSS was 12,564 bytes.

   While writing this doc, a re-build showed 12,673 bytes: `px-2` and `px-4` had appeared, and they come only from `src/lib/utils.test.ts`. **Tailwind reads test files under `src/` too.** A second line excludes them:
   ```css
   @import "tailwindcss" source("../");
   @source not "../**/*.test.{ts,tsx}";
   ```
   After that, `npm run build` and the same checks printed (real output):
   ```bash
   wc -c .next/static/chunks/*.css
   grep -c '\.px-[0-9]' .next/static/chunks/*.css
   ```
   ```
      12564 .next/static/chunks/<hash>.css
   0
   ```
   Back to 12,564 bytes, and no test-only classes. `font-sans` is still there.

7. **Vitest and `npm run check`.** `.ts` tests run in Node, and `.tsx` tests run in jsdom (see `vitest.config.mts`). `vitest.setup.ts` registers `afterEach(cleanup)`. We left out `@vitejs/plugin-react`, which the Next.js Vitest guide uses: installing it failed with npm `ERESOLVE`. Its optional chain of dependencies (`@rolldown/plugin-babel`, then `@babel/plugin-transform-runtime` 8) wants `@babel/core` 8, and `@shadcn/registry` uses `@babel/core` 7. We don't need the plugin anyway: Vite 8 already turns JSX into JavaScript using tsconfig's `"jsx": "react-jsx"`, and `resolve.tsconfigPaths` handles `@/`. To prove that `check` fails loudly, we added one mistake at a time, then reverted each:

   | Mistake added | Where `check` stopped | Exit code |
   | --- | --- | --- |
   | A `var` (lint rule `no-var`) | ESLint | 1 |
   | A type error (`TS2322`) | `tsc` | 2 |
   | A wrong assertion | Vitest, "1 failed" | 1 |

   A fresh clone of the branch passed `npm ci` and `npm run check`, with no `.next/` folder.

8. **Playwright smoke test.** `channel: 'chrome'` uses the Google Chrome already installed (version 155). The `webServer` setting builds the site and starts it on port 3210. The `~/Library/Caches/ms-playwright` listing was the same before and after the run, so no browser was downloaded. The "no console errors" test failed at first with `Failed to load resource: the server responded with a status of 404 (Not Found)`. Browsers ask for `/favicon.ico`, and the `--empty` scaffold has no icon. Adding `src/app/icon.svg` fixed it. That uses Next.js's icon file convention (bundled docs: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/app-icons.md`). Then 4 of 4 passed. The test caught a real bug on its first run.

9. **Docs.** `CLAUDE.md` gained:
   - the `@AGENTS.md` import and the installed stack versions;
   - repo-map rows;
   - a **Commands** section: `check` before calling work done, `test:e2e` before every merge, never `npx playwright install`;
   - **Code conventions**: bundled docs first, Server Components by default, `@/` imports, the code layout, tests next to code, Tailwind scans `src/` only, no secrets in `NEXT_PUBLIC_`, and the install-scripts rule.

   `readme.md` gained a "Run the website" section, plus Node 24 and Chrome as prerequisites.

10. **Learning doc.** This file. The outputs marked "re-run" were run again while writing it. Steps 2, 4, 6, 7 and 8 also quote output from the work session that wasn't re-run, because re-running it would install packages or change files.

11. **SEO check.** The page files were new, so we ran the SEO hook script by hand (it records what it reviewed, as the automatic hook would) and then the `seo-reviewer` agent. It built the site, fetched the pages with `curl` as a visitor and as Googlebot, and reported **2 pages checked: 2 pass, 0 need work**:
    - **`/`: Pass.** One `<h1>`, real text in the HTML, `lang="en"`, and the page is built ahead of time, so Google gets the same HTML as a visitor.
    - **404 page: Pass.** It returns status 404 with `noindex`. *Nice to have:* it has two `<title>` tags (Next.js's built-in 404 title plus ours). Task 12's custom `not-found.tsx` fixes that.
    - **Heads-up for task 11:** Geist has no Hindi (Devanagari) letters, so task 11 should load a Devanagari font too.
    - **Waiting for task 42:** title template, longer description, canonical URL, social tags, sitemap, robots, JSON-LD.

    No fixes were applied (they're the owner's choice); the two follow-ups went into tasks 11 and 12 in `task.md`.

12. **Review.** (filled in after it happens)

13. **Compound.** (filled in after it happens)

## Decisions worth knowing

| Choice | Why | What it costs |
| --- | --- | --- |
| Node 24, not Node 20 | Current Vitest and jsdom need it, and Node 20 gets no more security fixes | Everyone needs Node 24 (`fnm use`) |
| Scaffold in a scratch folder | `create-next-app` refuses a non-empty folder | A copy step that's easy to get wrong (README) |
| `test:e2e` outside `check` | It needs a production build, which is slow | You must remember to run it before merging |
| No `@vitejs/plugin-react` | Its dependency clash broke `npm install`, and Vite 8 handles JSX without it | We differ from the Next.js Vitest guide |
| Installed Chrome, not Playwright's browsers | Downloading browsers would be a machine-wide install | Machines without Chrome can't run e2e |
| `unrs-resolver` script left unapproved | Nothing breaks without it, and fewer scripts means less risk | Revisit if lint gets slow or breaks |

## New ideas in this task

- **Scaffold:** a starter project made by a generator (`create-next-app`). It's like a house shell you then fit out.
- **Lockfile (`package-lock.json`):** records the exact version of every installed package, so `npm ci` installs the same versions everywhere. Always commit it.
- **`engines`:** the field in `package.json` that says which Node versions the project needs.
- **`.nvmrc` and fnm:** `.nvmrc` holds the Node version. fnm (Fast Node Manager) lets several Node versions live side by side, and `fnm use` switches to the one in `.nvmrc`.
- **LTS and end of life:** an LTS (long-term support) Node version gets fixes for about three years. After its end of life it gets none, like a phone that no longer receives updates.
- **Cache Components:** a Next.js mode where data is fetched fresh unless you mark it `"use cache"`. Pages get a static shell that shows at once, and dynamic parts stream in.
- **Partial prefetching:** with Cache Components on, a `<Link>` downloads the target page's static shell in advance, so navigation feels instant.
- **Route types and `next typegen`:** Next.js generates types such as `LayoutProps<"/">` from your folders into git-ignored files. `next typegen` writes them without a full build, so `tsc` can find them.
- **Tailwind source detection:** how Tailwind finds class names, by reading your files as plain text. `source("../")` tells it which folder to read.
- **shadcn and Radix:** Radix provides unstyled, accessible building blocks (menus, dialogs). shadcn copies styled components built on them into your code, so you own and can edit them.
- **Unit, component and end-to-end tests:** a unit test checks one function (`cn()`). A component test renders one React component. An end-to-end (e2e) test opens the real site in a real browser. A *smoke test* is the most basic e2e test: does it even start?
- **jsdom:** a fake browser page written in JavaScript, so component tests can run without opening a browser.
- **Playwright channel:** which browser Playwright drives. `chrome` means the Google Chrome installed on your machine.
- **Peer dependency and `ERESOLVE`:** a peer dependency is a package that a package expects you to install alongside it. npm stops with `ERESOLVE` when two packages want versions that can't both be installed.

## Check that it works

Re-run while writing this doc, with Node 24:

```bash
npm run check
```
```
> go-mechanic@0.1.0 check
> npm run lint && npm run typecheck && npm run test

> go-mechanic@0.1.0 lint
> eslint

> go-mechanic@0.1.0 typecheck
> next typegen && tsc --noEmit

Generating route types...
✓ Types generated successfully

> go-mechanic@0.1.0 test
> vitest run

 RUN  v5.0.5 /Users/rtlecl910010/Desktop/Projects/Project/go-mechanic

 Test Files  2 passed (2)
      Tests  5 passed (5)
```

```bash
npm run test:e2e
```
```
Running 4 tests using 4 workers

  ✓  3 e2e/smoke.spec.ts:16:5 › text uses the sans-serif theme font, not the browser default (2.3s)
  ✓  1 e2e/smoke.spec.ts:5:5 › home page loads with its heading (2.3s)
  ✓  4 e2e/smoke.spec.ts:11:5 › the page language is English (2.3s)
  ✓  2 e2e/smoke.spec.ts:25:5 › no errors in the browser console (2.7s)

  4 passed (16.5s)
```

(Both outputs trimmed: blank lines, timing lines and npm's header lines.) To see the installed versions, run `npm ls next react tailwindcss shadcn radix-ui gsap vitest jsdom @playwright/test --depth=0`. It lists next 16.4.3, react 19.3.0, tailwindcss 4.3.3, shadcn 4.22.1, radix-ui 1.8.1, gsap 3.15.0, vitest 5.0.5, jsdom 30.1.3 and @playwright/test 1.64.1. You can also run `npm run dev` and open http://localhost:3000: you should see "GoMechanic" in a sans-serif font.

## Common mistakes

- **Copying `README.md` over `readme.md` on a Mac.** macOS file names ignore case by default, so the two names are the same file. Even checking is tricky. Re-run here:
  ```
  $ ls README.md
  README.md
  $ ls -1 | grep -i readme
  readme.md
  ```
  `ls` reports a `README.md` that doesn't exist. Only the real listing shows the true name. Use `ls -1 | grep -i` or `git status` instead.
- **Running plain `tsc` on a fresh clone.** The route types don't exist yet. In a scratch clone, `npx tsc --noEmit` printed `src/app/layout.tsx(19,50): error TS2304: Cannot find name 'LayoutProps'.`, while `npm run typecheck` passed. Always use the script.
- **Linting or type-checking `.claude/`.** It holds committed third-party code that isn't ours. Keep the ignores in `eslint.config.mjs` and `tsconfig.json`.
- **Running `npx playwright install`.** It downloads browsers into a per-user cache, which is a machine-wide install. The tests use your Chrome.
- **Putting secrets in `NEXT_PUBLIC_` variables.** Their values are built into the JavaScript that every visitor downloads.

## Try it yourself

About 10 minutes. Predict each result before you run it, and finish with `git status` showing a clean tree.

1. In `src/lib/utils.ts`, add `export const n: number = "one";` and run `npm run check`. Which stage stops it, and with which error code? Revert the line.
2. Add `className="animate-bounce"` to the `<h1>` in `src/app/page.tsx`, then run `npm run build` and `grep -c animate-bounce .next/static/chunks/*.css`. Then put the same text in a new file outside `src/` and remove it from `page.tsx`. Does the class survive the next build? Revert everything.
3. Rename `src/lib/utils.test.ts` to `utils.test.tsx` and run `npm run test`. Which test fails, and why? Rename it back.

Answers from a real run in a scratch clone: (1) `tsc` stops it with `error TS2322: Type 'string' is not assignable to type 'number'.`; (2) the count is `1`, then `0`, because Tailwind reads only `src/`; (3) the file now runs in the jsdom project, so "runs in the node environment" fails with `expected 'object' to be 'undefined'`.

## Learn more

- [create-next-app](https://nextjs.org/docs/app/api-reference/cli/create-next-app) and [the `next` CLI (`next typegen`)](https://nextjs.org/docs/app/api-reference/cli/next): every flag used above.
- [Next.js: Vitest](https://nextjs.org/docs/app/guides/testing/vitest) and [Playwright](https://nextjs.org/docs/app/guides/testing/playwright) guides: the setup we followed, and changed where noted.
- [Next.js: app icons](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/app-icons): how `src/app/icon.svg` works.
- [Tailwind: detecting classes in source files](https://tailwindcss.com/docs/detecting-classes-in-source-files): `source()` and what Tailwind scans.
- [shadcn/ui: Next.js installation](https://ui.shadcn.com/docs/installation/next): what `init` does.
- [Vitest: projects](https://vitest.dev/guide/projects): running Node and jsdom tests side by side.
- [Playwright: browsers and channels](https://playwright.dev/docs/browsers): `channel: 'chrome'`.
- [Testing Library: React](https://testing-library.com/docs/react-testing-library/intro): `render`, `screen` and `cleanup`.
- [Node.js releases](https://nodejs.org/en/about/previous-releases), [npm `engines`](https://docs.npmjs.com/cli/v11/configuring-npm/package-json) and [fnm](https://github.com/Schniz/fnm): Node versions and how to pin them.
