---
title: "A page that streams through <Suspense> never shows its content with JavaScript fully off: test 'works without JavaScript' by blocking the page's script files"
date: 2026-11-20
category: conventions
module: e2e/admin.spec.ts
problem_type: convention
component: testing_framework
related_components: [frontend]
severity: medium
applies_when:
  - A browser test checks that a page or form "works without JavaScript"
  - "The page reads the session or other request data inside <Suspense> (Cache Components: /admin/*, /account, /book, /estimate)"
  - Code comments, docs or a learning doc promise that a form works without JavaScript
symptoms:
  - "A Playwright context with javaScriptEnabled: false stays on the Suspense fallback (the loading line) forever"
  - The forms the test wants to post never appear, so the test times out looking for them
resolution_type: test_fix
retire_when: "Next.js or React reveals streamed Suspense content without an inline script (check: open /admin/bookings as the owner in a context with javaScriptEnabled: false and see whether the board appears)"
tags: [suspense, streaming, no-javascript, playwright, server-actions, nextjs-16, e2e]
---

# A page that streams through <Suspense> never shows its content with JavaScript fully off: test "works without JavaScript" by blocking the page's script files

## Context

Task 27 put the staff board's actions (Confirm, Cancel, No-show, Assign) in plain Server Action forms, `<form action={action.bind(null, locale, bookingId, boardView)}>`, so a slow phone could use them before the page's JavaScript arrived. The browser test first opened `/admin/bookings` in a Playwright context with `javaScriptEnabled: false`. The page stayed on its loading line and the test timed out.

The reason: with Cache Components, the board renders inside `<Suspense>` after the access check (`requirePermission` reads the session). The server first sends the fallback, then streams the real content later in the same response as hidden HTML. A small **inline** `<script>` that React writes into the page moves that hidden HTML into place. With JavaScript fully turned off, that script never runs, so streamed content never shows. Task 26's "works without JavaScript" claim for the board had the same gap and was never tested that way.

## Guidance

- For a page whose content streams in, "works without JavaScript" really means **"works before the page's JavaScript files load"**. The inline reveal script runs; the bundles (hydration, client components) haven't arrived. That is the case that matters on a slow phone.
- Test it by blocking the bundles, not by turning JavaScript off:

  ```ts
  const noScript = await browser.newContext({ ...phone, storageState: await page.context().storageState() });
  await noScript.route("**/_next/static/**/*.js", (route) => route.abort());
  const staff = await noScript.newPage();
  ```

  (`e2e/admin.spec.ts`, the owner test.) A plain `<form action={serverAction}>` still posts and redirects in that context, because the browser submits it natively.
- Say it the same way in comments and docs: "works before its JavaScript loads", not "works without JavaScript". With JavaScript fully off, a page that reads cookies inside `<Suspense>` shows only its loading fallback.
- A form whose `useActionState` gets a browser-side wrapper doesn't post even then (see `react-19-form-islands-hydration-action-activity.md`): blocking the bundles only helps forms that pass the Server Action itself.

## When this applies

Any page under Cache Components that reads request data inside `<Suspense>`. A fully prerendered page with no streamed part does show its content with JavaScript off, so `javaScriptEnabled: false` is still a fair test there.
