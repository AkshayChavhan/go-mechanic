---
title: "Next.js 16: an `icons` metadata export drops the root icon.svg link, so list it yourself"
date: 2026-11-19
category: conventions
module: Next.js metadata (icons)
problem_type: convention
component: frontend
related_components: [tooling]
severity: medium
applies_when:
  - "A layout or page's metadata (`metadata` or `generateMetadata`) sets `icons`, for example `icons.apple` for an apple-touch-icon"
  - "Adding home-screen icons, Open Graph images or favicons to one part of the site (task 26 /admin; task 42 SEO)"
  - "A page's browser-tab icon disappeared while other pages keep theirs"
tags: [nextjs-16, metadata, icons, favicon, apple-touch-icon, file-conventions, generatemetadata]
---

# Next.js 16: an `icons` metadata export drops the root icon.svg link

## Context

The site's browser-tab icon comes from the file convention `src/app/icon.svg`: Next.js links it from every page by itself. In task 26 the staff area's layout (`src/app/[locale]/admin/layout.tsx`) needed an apple-touch-icon for "Add to home screen", so its `generateMetadata` set `icons: { apple: [...] }`. That one field made every `/admin` page lose its `icon.svg` link. No test failed and nothing logged a warning. The helper building the icons found it by reading Next.js's source, not the docs.

The cause is in `node_modules/next/dist/lib/metadata/resolve-metadata.js` (Next.js 16.4.6, around line 417). After merging every segment's metadata, Next.js adds the static icon files (`icon.*`, `apple-icon.*`) only when the merged result has no `icons` at all:

```js
if (leafSegmentStaticIcons.icon.length > 0 || leafSegmentStaticIcons.apple.length > 0) {
    if (!resolvedMetadata.icons) {
        resolvedMetadata.icons = { icon: [], apple: [] };
        // ...the static icon files are added here, and only here
    }
}
```

So any `icons` export in the chain, even one that names only `apple`, switches the file-convention icons off for those pages.

## Guidance

When a layout or page sets `icons`, list the root icon in the same export:

```ts
icons: {
  // An `icons` export here replaces the link Next.js makes for
  // src/app/icon.svg, so the tab's favicon is listed again.
  icon: [{ url: "/icon.svg", type: "image/svg+xml", sizes: "any" }],
  apple: [{ url: HOME_SCREEN_ICONS.apple, type: "image/png", sizes: "180x180" }],
},
```

Then check the result in a test that reads the metadata (task 26's `src/app/[locale]/admin/layout.test.tsx` asserts the exact `icons` object), or in the built HTML (`<link rel="icon" href="/icon.svg...">` on an affected page).

A generated `apple-icon.tsx` next to the admin layout looks like the cleaner fix, but in this repo it doesn't work for `/admin`: its URL has no file extension, so the proxy would send a logged-out browser's request for it to `/login`. Task 26 serves the icons from Route Handlers at paths ending in `.png` instead.

## When this applies

Whenever `icons` appears in any `metadata` or `generateMetadata` below `src/app/`, including task 42's SEO work and any later home-screen or favicon change. Re-check the line in `resolve-metadata.js` after a Next.js upgrade.
