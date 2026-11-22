---
title: "Playwright e2e: find a page block by its own label, never with locator(\"section\").filter()"
date: 2026-11-22
category: conventions
module: e2e/admin.spec.ts
problem_type: convention
component: testing_framework
severity: medium
applies_when:
  - A spec in e2e/ looks for one block of a page (a report, a card group, a form) that sits inside a page wrapped by Section
  - The block's contents depend on rows other specs may write to the shared database
tags: [playwright, e2e, locators, strict-mode, section, flaky-test, shared-state]
---

# Playwright e2e: find a page block by its own label, never with locator("section").filter()

## Context

Our `Section` component (`src/components/site/section.tsx`) renders a `<section>`, and every page puts its content inside one. A block inside that page, like one report on `/admin/reports`, is another `<section>` nested in it.

Task 41's browser test looked for the bookings report like this:

```ts
const bookingsBlock = page.locator("section").filter({
  has: page.getByRole("heading", { level: 2, name: "Bookings" }),
});
await bookingsBlock.getByRole("link", { name: /CSV/ }).getAttribute("href");
```

The page's outer `<section>` also contains that heading, so the filter matches it too, and the link lookup searches every report. The first full run passed, because the other reports for the booking's day were empty and only one CSV link existed. On a rerun, another spec's booking landed on the same random day, and top services and workload got rows and CSV links. Playwright's strict mode then failed with "resolved to 3 elements". Whether the test passed depended on what the other specs happened to book.

## Guidance

- Give each block a stable label and locate it by that label:

  ```ts
  const bookingsBlock = page.locator('section[aria-labelledby="report-bookings"]');
  ```

  `reports-view.tsx` sets `aria-labelledby={`report-${report}`}` on each report's section, pointing at its heading.
- Or match exact accessible names, such as `getByRole("link", { name: "Download Bookings (CSV)" })`, not a pattern like `/CSV/` that other blocks share.
- `filter({ has })` keeps every ancestor that contains the match, not only the closest one. Never use it to choose between nested elements of the same tag.

## Why This Matters

The broken locator passes whenever the neighbouring blocks are empty, so it gets through review and the first run. It fails later, by chance, when parallel specs share one database (see `playwright-spec-that-saves-shared-data-runs-in-last-project.md`). A test that only works on an empty page is checking the data, not the code.

## When to Apply

Any spec that reaches into one part of a page that has other parts of the same kind: report blocks, booking cards, price group cards, review lists.

## Examples

- `e2e/admin.spec.ts`, the task 41 reports check (fixed in task 41).

## Related

- `document/solutions/conventions/playwright-spec-that-saves-shared-data-runs-in-last-project.md`
