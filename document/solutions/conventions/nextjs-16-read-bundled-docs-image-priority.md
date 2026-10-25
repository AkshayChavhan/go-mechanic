---
title: "Next.js 16: read the bundled docs before using an API from memory (next/image `priority` is deprecated)"
date: 2026-10-25
last_updated: 2026-10-25
category: conventions
module: next/image
problem_type: convention
component: frontend
related_components: [tooling]
severity: medium
applies_when:
  - Adding a hero or other above-the-fold image with next/image (task 13 home page, and every page task)
  - Using any Next.js API from memory (image, metadata, caching, proxy)
  - Writing an agent checklist, plan or review comment that names a Next.js API
  - Taking a Next.js rule from the ui-ux-pro-max skill data
tags: [nextjs-16, next-image, lcp, deprecated-api, fetchpriority, bundled-docs, seo, core-web-vitals]
---

# Next.js 16: read the bundled docs before using an API from memory

## Context

This repo pins Next.js 16.4.3, which is newer than the model's training data. Code or advice written from memory can use an API that has changed.

It happened in task 08 (branch `08_seo_reviewer`). The `seo-reviewer` agent's checklist was written from memory and said the hero image should load "with priority". In its first end-to-end run, the agent told the owner to use `next/image` "with `width`, `height`, `sizes` and `priority`". The `code-reviewer` agent read the docs bundled with Next.js and flagged it: Next.js 16 deprecated `priority`. Commit `f50fe8b` on the task branch (not yet merged into `main` when this was written; the `--no-ff` merge keeps the SHA) fixed `.claude/agents/seo-reviewer.md` and the master plan. A re-run then recommended `loading="eager"` and `fetchPriority="high"`. See `document/learning/08_seo_reviewer.md`, steps 8 and 11.

Nothing else would have caught it:

- **It still works.** In `node_modules/next/dist/shared/lib/get-img-props.js`, `priority` is just treated as `preload` (`preload: preload || priority`). No build error, no runtime error.
- **The only marker is a type comment.** `get-img-props.d.ts` has `@deprecated Use \`preload\` prop instead.` on `priority`. TypeScript doesn't fail on that; editors only strike it through.
- **A skill we use still teaches the old rule.** `ui-ux-pro-max` (CLAUDE.md says to use it for UI work) has a row in `.claude/skills/ui-ux-pro-max/data/stacks/nextjs.csv`: "Use priority for LCP images", example `<Image priority src={hero}/>`, labelled `nextjs 16.2`. Its search can hand this to any UI task. Don't edit the skill file (CLAUDE.md forbids it); this lesson overrides it.

## Guidance

1. **Before using a Next.js API, read its guide in `node_modules/next/dist/docs/`.** This includes images, metadata, caching and Cache Components, `proxy`, routing and fonts. `grep -rl "<api name>" node_modules/next/dist/docs/` finds the page. Read the deprecation notes and the version history table at the end of each page. `node_modules/next/AGENTS.md`, shipped with Next.js, says the same: "This is NOT the Next.js you know ... Read the relevant guide in `dist/docs/` before writing any code. Heed deprecation notices." Since task 09 the repo has its own `AGENTS.md`, and `CLAUDE.md` imports it with `@AGENTS.md`.
2. **Advice counts too.** Agent checklists, plans, reviews and learning docs that name a Next.js API must be checked against the bundled docs. This slip started in a checklist, not in app code.
3. **Hero (LCP) image in Next.js 16.** Source: `node_modules/next/dist/docs/01-app/03-api-reference/02-components/image.md`, the `preload`, `priority` and `loading` sections (lines 266–310 in 16.4.3):
   - **Never use `priority`.**
   - **One hero image:** set `loading="eager"`, and add `fetchPriority="high"` if you like. The docs: "In most cases, you should use `loading="eager"` or `fetchPriority="high"` instead of `preload`."
   - **`fetchPriority="high"` alone is not enough for a single hero.** `isLazy` in `get-img-props.js` checks only `priority`, `preload` and `loading`, so the `<img>` still gets `loading="lazy"`. A lazy-loaded LCP image loads later.
   - **A different hero image per screen size** (art direction with `getImageProps()` and `<picture>`): use only `fetchPriority="high"`. The same docs page (around line 1322) says `preload` and `loading="eager"` would make both images load.
   - **`preload`:** only when one image is the LCP on every screen size, and without `loading` or `fetchPriority` on the same image. Setting both `preload` and `priority` throws an error outside production builds (the check sits inside `process.env.NODE_ENV !== 'production'` in `get-img-props.js`).

## Why This Matters

The hero image is usually the home page's Largest Contentful Paint (LCP) element. LCP is one of the Core Web Vitals that Google uses for ranking, so a lazy-loaded hero hurts both speed and SEO. Deprecated props also tend to disappear in a later major version. The wider cost: every API written from memory risks a review round and a fix commit, as in task 08. The reviewer only caught this one because it read the docs.

## When to Apply

- Task 13 (`13_home_page`, with its hero image) and every page task after it.
- Whenever `ui-ux-pro-max` or another skill names a Next.js API: check it against the bundled docs first.
- **When `node_modules/next/dist/docs/` is missing** (a fresh clone before `npm install`): install the dependencies first (`npm ci` with Node 24, see `.nvmrc`) instead of falling back to memory. The online docs at nextjs.org may describe a newer version than 16.4.3.

## Examples

Before (from memory, deprecated):

```tsx
<Image src={hero} alt="Mechanic servicing a car at the garage" sizes="100vw" priority />
```

After:

```tsx
<Image src={hero} alt="Mechanic servicing a car at the garage" sizes="100vw" loading="eager" fetchPriority="high" />
```

The `seo-reviewer` checklist rule, fixed in commit `f50fe8b`:

- Before: "the main hero image is loaded with priority"
- After: "the hero (LCP) image loads early with `loading="eager"` or `fetchPriority="high"` (or `preload`). Next.js 16 **deprecated** the `priority` prop, so never suggest it"

## Related

- `document/learning/08_seo_reviewer.md`: steps 8 (the end-to-end run) and 11 (the review that caught it)
- `.claude/agents/seo-reviewer.md`: the "read the Next.js docs" rule and the image rule (updated after this lesson: `loading="eager"`, since `fetchPriority` alone still lazy-loads)
- `document/plans/2026-10-24-gomechanic-master-plan.md`: line 84 (Core Web Vitals rule)
- `document/solutions/conventions/run-commands-before-documenting-output.md`: the same idea for command output; write from the real source, not memory
- Next.js Image reference (online, may be newer than 16.4.3): https://nextjs.org/docs/app/api-reference/components/image
- MDN `fetchPriority`: https://developer.mozilla.org/docs/Web/API/HTMLImageElement/fetchPriority
