---
title: "Next.js 16: after unstable_rethrow, catch only the one error you expect (root params in request.ts)"
date: 2026-10-27
category: conventions
module: src/i18n/request.ts
problem_type: convention
component: frontend
related_components: [testing]
severity: medium
applies_when:
  - Wrapping a Next.js request API (next/root-params, cookies(), headers()) in try/catch
  - A Server Action, Route Handler or "use cache" function catches errors and also calls redirect() or notFound() (tasks 14, 15, 22 and 23)
  - Writing a fallback for how you think Next.js behaves, before you have seen it behave that way
  - Changing src/i18n/request.ts
symptoms:
  - A Server Action or Route Handler that forgot to pass the locale silently got English, with every English-only test green
root_cause: logic_error
resolution_type: code_fix
tags: [nextjs-16, unstable-rethrow, error-handling, root-params, server-actions, route-handlers, next-intl, error-digest]
---

# Next.js 16: after `unstable_rethrow`, catch only the one error you expect

## Context

`src/i18n/request.ts` picks the language for each request. It reads the URL's `[locale]` segment with `locale()` from `next/root-params`, inside a `try`/`catch`. The task 12 plan (`document/plans/2026-10-26-1937-feat-layout-shell-plan.md`, KTD7) expected that read to fail in the global 404 under `next dev`, so the first version did this:

```ts
try {
  return await rootLocale();
} catch (error) {
  unstable_rethrow(error);
  return undefined; // falls back to the default language
}
```

`unstable_rethrow` does not pass on every Next.js error. In Next.js 16.4.3 (`node_modules/next/dist/client/components/unstable-rethrow.js`) it rethrows only Next.js's control signals: `notFound()`, `redirect()` and the other router errors, the "bail out to client rendering" error, the dynamic-rendering and prerender interruption errors, and the same signals found in an error's `cause`. Everything else falls through to your code.

`node_modules/next/dist/server/request/root-params.js` throws a plain `Error` when root params are used in the wrong place: inside a Server Action, a Route Handler, `unstable_cache`, or `"use cache"` nested inside `unstable_cache`. The broad catch turned all of those into "no locale", so the request fell back to English. In tasks 15, 22 and 23, a Server Action or Route Handler that forgot to pass `locale` would have shown English to everyone, and to Hindi visitors too once Hindi ships. Every test is in English, so all of them stayed green. `ce-code-review` caught it (P2). It was fixed in commit `f871aa6` on branch `12_layout_shell` (not yet merged when this was written).

A second lesson came from the same code. A logged probe showed that `rootLocale()` does not fail in the global 404 under `next dev`. It resolves to `undefined`, as in a production build. The `?? routing.defaultLocale` fallback does the work, and the catch is only insurance. The fallback the plan designed was for a failure that doesn't happen.

## Guidance

1. **Call `unstable_rethrow(error)` first in every `catch` that can see a Next.js error.** The bundled docs (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/unstable_rethrow.md`) say to call it "at the top of the catch block". Without it, a `try` around `redirect()` or `notFound()` swallows the redirect or the 404.
2. **Then handle only the error you expect, and rethrow the rest.** `unstable_rethrow` only removes Next.js's control signals. What's left still includes Next.js's own "you used this API in the wrong place" errors and real bugs. Ending with `return fallback` hides all of them.
3. **Recognise a Next.js error by its `digest`, not by `instanceof` or its message.** Next.js does this itself: `isInstantValidationError` in `node_modules/next/dist/server/app-render/instant-validation/instant-validation-error.js` checks `err.digest === 'INSTANT_VALIDATION_ERROR'`. A digest is a plain string, so it still matches when the error class was loaded from a different bundle (where `instanceof` would say no), and Next.js changes error wording more often than digests. Find the digest in `node_modules/next/dist/`, not from memory.
4. **If no error has an expected fallback, don't catch at all.** The docs suggest letting the caller handle the exception instead. `INSTANT_VALIDATION_ERROR` is expected in `request.ts` only because a page without a locale has a sensible answer (the default language). It is also thrown for `cookies()`, `headers()`, `params` and `searchParams` that are missing from a segment's `unstable_samples` (`instant-samples.js`). For those, it usually means "add the sample", so let it through.
5. **Prove each "must fail" case with a test that rejects.** `src/i18n/request.test.ts` has a `test.each` with the real messages from `root-params.js` (Server Action, Route Handler, `unstable_cache`) and expects each to reject with the same error. The task 12 learning doc records that these three tests failed against the old catch, which shows they test the catch.
6. **Probe Next.js before you build a fallback for it.** Log what the call really returns or throws in the real place (`next dev` and a production build), then write the code. A fallback for an imagined failure is how the broad catch got in.

## Why This Matters

A broad catch that falls back to a default is silent. Nothing logs, nothing fails, and the default is what the tests expect, because English is both the default and the only language today. The cost appears later, in another task's code: an action that forgot its locale, or a `redirect()` that never redirects. That's far from the `catch` that caused it. The final `request.ts` shows the narrow catch, but not that the broad one passes every test until Hindi exists.

## When to Apply

- **Task 14 (`14_database_setup`):** data-access helpers that catch database errors around code that may also call `notFound()` or read `cookies()`.
- **Task 15 (`15_auth_otp_login`):** OTP Server Actions that catch provider errors and then `redirect()`.
- **Tasks 22 and 23 (`22_slot_engine`, `23_booking_flow`):** booking actions and Route Handlers. They must pass `locale` to `getTranslations({ locale, namespace })` themselves (CLAUDE.md, "Languages"). The rethrow in `request.ts` is the only runtime check that they do.
- **Any change to `src/i18n/request.ts`:** keep the digest check narrow and the `test.each` cases.
- **After a Next.js upgrade:** check that `INSTANT_VALIDATION_ERROR` and the `root-params.js` messages still exist (`grep -rn "INSTANT_VALIDATION_ERROR" node_modules/next/dist/server/`), and update the test messages if the wording changed.

## Examples

Before (catches everything that isn't a control signal):

```ts
} catch (error) {
  unstable_rethrow(error);
  return undefined;
}
```

After (`src/i18n/request.ts`):

```ts
} catch (error) {
  unstable_rethrow(error);
  if ((error as { digest?: unknown }).digest === "INSTANT_VALIDATION_ERROR") return undefined;
  throw error;
}
```

The same shape for a future Server Action that expects one error of its own (a sketch: `isDuplicateBooking` and `slotTaken` are made-up names):

```ts
try {
  await reserveSlot(input);
  redirect("/book/done");
} catch (error) {
  unstable_rethrow(error); // lets redirect() through
  if (isDuplicateBooking(error)) return { error: t("slotTaken") };
  throw error;
}
```

## Related

- `src/i18n/request.ts`, `src/i18n/request.test.ts`: the code and its tests
- `document/learning/12_layout_shell.md`: step 12 (the 404s and the probe) and the code-review section
- `document/plans/2026-10-26-1937-feat-layout-shell-plan.md`: KTD7 and its "Implemented differently" note
- `document/solutions/conventions/nextjs-16-read-bundled-docs-image-priority.md`: the same rule for APIs. Read `node_modules/next/`, not memory
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/unstable_rethrow.md` and `next-root-params.md` ("Restrictions")
