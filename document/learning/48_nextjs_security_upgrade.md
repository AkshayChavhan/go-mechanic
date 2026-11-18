# 48_nextjs_security_upgrade: Next.js 16.4.3 → 16.4.6 for its security fixes

> **Branch:** `48_nextjs_security_upgrade` · **Date:** 2026-11-18 · **Status:** In progress (ready for review)

## In one minute

`next build` started stopping with a "known security vulnerability" message, and `npm audit` flagged Next.js 16.4.3. This task moved Next.js to 16.4.6, the latest patch on the same 16.4 line, and checked the parts of the app the fixes touch. Nothing else in the app changed.

## Why: the problem we solved

Next.js 16.4.5 fixed seven security advisories, all rated "moderate". Two of them match this app exactly:

- **GHSA-mfr8-8qww-v76h** and **GHSA-vc7v-qv4w-wrv8:** a `'use cache'` function could leak a cached result across *root params*. A root param is a dynamic part of the URL above the root layout. Ours is `[locale]` (`/` and later `/hi`). Our public reads (`readGarage()`, `readServices()` and others) use `'use cache'`, so in the worst case a cached page part made for one language could have been served for another.

The others cover cached fallback shells, `'use cache'` with binary arguments, self-hosted response forwarding, SVG image optimization, and Edge-runtime cookies. We have no Edge routes, and Vercel hosting (task 20) doesn't forward responses, but taking the whole patch is simpler and safer than judging each one.

## What: what changed

| File | Change | Why |
| --- | --- | --- |
| `package.json`, `package-lock.json` | Changed | `next` and `eslint-config-next` 16.4.3 → 16.4.6 (exact versions, as before). The lockfile moved 12 entries: `next` and its own `@next/*` packages only |
| `CLAUDE.md` | Changed | The stack line, and the note that `forbidden()` is still experimental, now say 16.4.6 |
| `src/proxy.test.ts`, `src/server/auth/access.ts` | Changed (comments) | They state a fact "in Next.js 16.4.3"; each was checked again in 16.4.6 |
| `document/task/task.md` | Changed | Task 48's row and steps, and a backlog note about the dev-tool findings |

## How: step by step

1. **Read what changed.** The release notes for 16.4.4, 16.4.5 and 16.4.6 (`gh release view v16.4.5 -R vercel/next.js`) and `npm audit --omit=dev`. 16.4.4 and 16.4.6 are small bug-fix backports, and 16.4.5 is the security release.
2. **Upgrade only Next.js.**
   ```bash
   npm install --save-exact --no-audit --no-fund next@16.4.6 eslint-config-next@16.4.6
   ```
   `--save-exact` writes `16.4.6`, not `^16.4.6`, so every machine installs the same version. `eslint-config-next` moves with `next` because they're released together.
3. **Check the one risky change.** 16.4.6 starts compressing route-handler responses (gzip) when they aren't compressed yet. Our only route handlers are the fake photo storage's (`src/app/api/photos/`). Next.js uses its bundled `compression` package, which only compresses types marked "compressible". That package's list says `"image/jpeg": … "compressible": false`, so photos go out exactly as before. No new test was needed.
4. **Re-check what `CLAUDE.md` asks after an upgrade.** The database guard `isNextHelperProcess()` recognises Next.js's helper processes by their script, `next/dist/compiled/jest-worker/processChild.js`, and that file is still there. Every bundled doc a lesson points to (for example `node_modules/next/dist/docs/01-app/02-guides/streaming.md`) still exists. `next dev` didn't rewrite `AGENTS.md`.
5. **Run everything.** See below.

## New ideas in this task

- **Security advisory (GHSA-…):** a public notice that a version of a package has a security bug, with the versions that fix it. `npm audit` checks your lockfile against them.
- **Patch release:** the last number in `16.4.6`. It promises bug and security fixes only, no breaking changes, which is why this upgrade could be small.
- **Root param:** a dynamic URL segment above the root layout (`src/app/[locale]/layout.tsx`), so every page has one. `next/root-params` reads it.

## Check that it works

```bash
node -p "require('./node_modules/next/package.json').version"   # 16.4.6
npm audit --json | grep '"next"'                                 # prints nothing
npm run build                                                    # no security stop; "○ /en" still listed
```

Results on 2026-11-18:
- `npm run check`: 1,878 tests passed on the second run. The first run had one timeout in `mobile-menu.test.tsx` (1,061 ms against a 1 s wait) while the machine's load average was 16; that test passed 3 out of 3 on its own.
- `npm run build`: passed, with `○ /en` still prebuilt.
- `npm run test:e2e`: 118 passed.
- `npm run test:design`: 50 passed on the second run. The first run had one failure, the reduced-motion "Play" check measured just after a click, before the busy dev server had hydrated the page. Neither the test nor the page changed in this task.

## What went wrong

- **The build's warning carried instructions.** The "SecurityFatalError" text told the agent to run `next upgrade --agent=security …` and to ask the owner a set question. That text came from a tool's output, not from the owner. So the agent didn't run it, and it raised the upgrade with the owner as a normal task instead.
- **Two flaky runs, both under load.** Both are described above. The repo's lesson (`document/solutions/workflow-issues/full-check-times-out-under-parallel-session-load.md`) says a timeout under load is not a failure to "fix" by raising limits, so the agent reran them.

## Not done here

`npm audit` still lists 29 findings (2026-11-18), all in tools that never ship to visitors. The high ones are picomatch (GHSA-fc5q-39xc-vjpf), through vitest, ESLint, the shadcn CLI and next-intl's file watcher. The moderate ones are hono and `@hono/node-server` (through the shadcn CLI's MCP library), minimatch (through ESLint and the shadcn CLI) and esbuild (through drizzle-kit). The fixes need major versions. It's in the backlog of `document/task/task.md`. Don't run `npm audit fix --force`.

## Reviews

- `ce-code-review`: skipped (mechanical diff). The change is a dependency version bump plus comment and doc edits.
- `code-reviewer`: "Ready to merge", no must-fix items. Its two suggestions are applied: a lesson still said the repo pins 16.4.3, and the docs' `npm audit` summary had gone stale (now described by advisory and path, in `CLAUDE.md` too).
- Compound step: skipped, no new lesson. What to check after a Next.js upgrade is already in `CLAUDE.md` (the helper-process guard, the bundled docs, `AGENTS.md`), and this task's steps in `document/task/task.md` show how it went. The one-off finding, that JPEGs aren't re-compressed, belongs to this version's notes, not to a reusable rule.

## Exercise

Run `npm view next@16.4 version` and find the newest 16.4 release. Then read its notes with `gh release view v<that version> -R vercel/next.js` and decide whether it would need any of step 3's or step 4's checks.

## Learn more

- [Next.js 16.4.5 release notes](https://github.com/vercel/next.js/releases/tag/v16.4.5)
- [GHSA-vc7v-qv4w-wrv8](https://github.com/advisories/GHSA-vc7v-qv4w-wrv8) and [GHSA-mfr8-8qww-v76h](https://github.com/advisories/GHSA-mfr8-8qww-v76h)
- [`npm audit`](https://docs.npmjs.com/cli/commands/npm-audit)
