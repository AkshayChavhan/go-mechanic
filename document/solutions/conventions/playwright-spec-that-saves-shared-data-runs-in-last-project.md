---
title: "Playwright e2e: a spec that saves data other specs read runs in its own last project, and undoes its change"
date: 2026-11-21
category: conventions
module: playwright.config.ts
problem_type: convention
component: testing_framework
severity: medium
applies_when:
  - A spec in e2e/ saves something every visitor sees (a real price, the garage's details, an offer, page content)
  - Another spec asserts the opposite state (no price, no offer, the seed's text)
retire_when: "test:e2e stops sharing one next start and one in-memory database across specs (for example a server per worker)"
tags: [playwright, e2e, projects, dependencies, shared-state, pglite, test-isolation]
---

# Playwright e2e: a spec that saves data other specs read runs in its own last project, and undoes its change

## Context

`npm run test:e2e` builds once and starts one `next start` (`webServer` in `playwright.config.ts`). In a build and in `next start`, the app uses one in-memory PGlite database per process. So every spec, running in parallel, reads and writes the same database.

Task 39's `e2e/prices.spec.ts` saves a real price as the test owner. One real price turns off every sample price (`selectPrices` is all or nothing) and puts a `₹` on public pages. Other specs expect no real price: `services.spec.ts` scans the production HTML for `₹`, and the booking specs expect "price confirmed at the garage" lines. If those specs run while the price is saved, they fail, or pass by luck depending on timing.

## Guidance

- Put the spec that saves shared data in its own Playwright project, which depends on the project that holds every other spec:

  ```ts
  projects: [
    { name: "site", testIgnore: ["**/e2e/dev/**", "**/prices.spec.ts"] },
    { name: "prices", testMatch: "**/prices.spec.ts", dependencies: ["site"] },
  ],
  ```

- A project's `testIgnore` replaces the top-level one instead of adding to it. So the `site` project lists the dev-spec ignore again, plus the saving spec.
- End the saving spec by putting the data back (task 39 clears both prices and checks that the page says "call for price" again). A later saving spec added to the same last project then starts from the seed's state.
- If two saving specs touch the same data, run them in serial in that project, or give each its own row (another service, another price group).
- Running the saving spec alone (`npx playwright test e2e/prices.spec.ts`) runs the whole `site` project first. Add `--no-deps` to skip it.

## Why This Matters

The failure depends on timing. A parallel run may pass locally and fail on another machine or after a new spec is added. Nothing in the failing spec points to the spec that saved the data.

## When to Apply

- Any spec in a later task that saves visible shared data: garage details (task 28), the offer banner (task 38), owner content (task 40), more prices.
- It is not needed for data that only its own spec reads (a fresh customer from `freshNumber()`, that customer's bookings).

## Examples

- `playwright.config.ts`: the `projects` block and its comment.
- `e2e/prices.spec.ts`: it saves a hatchback price and a diesel price, checks the public pages, then clears both.

## Related

- `document/solutions/conventions/playwright-networkidle-hangs-after-second-page-load.md`: on parallel specs reading rows the app wrote.
