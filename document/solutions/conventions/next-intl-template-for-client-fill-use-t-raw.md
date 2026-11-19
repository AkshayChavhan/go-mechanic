---
title: "next-intl: pass a template the browser fills (\"{count} of {max} characters\") with t.raw, never t() without values"
date: 2026-11-19
category: conventions
module: "src/app/[locale]/(site)/account/reviews/[bookingId]/page.tsx"
problem_type: convention
component: frontend
related_components: [testing_framework]
severity: medium
applies_when:
  - "A server page builds a label for a client island, and the island replaces {placeholders} itself (a character counter, a live count)"
  - "Any getTranslations()/useTranslations() call on a message with {placeholders} but no values passed"
tags: [next-intl, use-intl, icu, t-raw, labels, client-island, formatting-error, dev-only-bug]
---

# A template the browser fills goes through t.raw

## Context

Forms in this repo get every label from their server page as a prop, because client islands read no messages. A character counter needs a template the island fills on every keystroke: `"{count} of {max} characters"`. The island's own `fill()` replaces the placeholders.

Task 37's review page passed it as `commentCount: t("commentCount")`, with no values. The code review caught it (the correctness reviewer, confirmed by a validator with a read-only repro against use-intl 4.14.9 under `node --conditions=development`):

- **use-intl's development build** compiles the ICU message when `t()` is called. It throws `FORMATTING_ERROR` for the missing `{count}` and `{max}`, and `t()` returns its fallback. With no `getMessageFallback` set (`src/i18n/request.ts`), that fallback is the key, so under `npm run dev` the counter would read "ReviewPage.commentCount" and log an error on every render. This comes from the library's code; it wasn't seen in a running dev server, because no test opens this page under `next dev`.
- **The production build** skips compiling when no values are passed, and returns the raw template. So `next build`, `test:e2e` and the design suite all passed.
- **The component test** passed the raw string straight from `messages/en.json`, so it never went through `t()` at all.

The estimate page already did it right: `descriptionCount: t.raw("descriptionCount") as string` (`src/app/[locale]/(site)/estimate/page.tsx`).

## Guidance

Read a message whose placeholders the browser fills with `t.raw`:

```ts
// src/app/[locale]/(site)/account/reviews/[bookingId]/page.tsx
// Raw: the form fills {count} and {max} itself, on every keystroke.
commentCount: t.raw("commentCount") as string,
```

Use `t("key", { ...values })` only when the server fills every placeholder itself. `t("key")` with no values on a message that has placeholders is always a bug, even though production hides it.

Test the label the page builds, not only the island with hand-typed labels. The page test in `src/app/[locale]/(site)/account/reviews/[bookingId]/page.test.tsx` renders the page with next-intl's real translator. It checks that the gate receives `labels.commentCount === messages.ReviewPage.commentCount`, and it fails when `t()` is put back.

## When to apply

Whenever a server page hands a client island a string that still contains `{placeholders}`: counters, "{n} of {total}", "{field} set to {value}" announcements. Look for `t("…")` calls with no second argument on messages that contain `{`.
