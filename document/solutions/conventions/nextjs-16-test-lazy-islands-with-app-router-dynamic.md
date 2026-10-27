---
title: "Testing a next/dynamic island in Vitest: use the App Router dynamic, and vi.doMock per test"
date: 2026-10-27
category: conventions
module: next/dynamic
problem_type: convention
component: frontend
related_components: [testing]
severity: high
applies_when:
  - Lazy-loading a client component with next/dynamic or React.lazy (task 18's phone menu panel, any later island)
  - Writing a Vitest test for what happens when a lazily loaded module fails to download or throws
  - Writing a test that says a module is never loaded, with vi.mock and vi.resetModules()
  - Adding an optional extra (motion, a widget) whose failure must not take the page down
symptoms:
  - A test for a failed lazy load passes even without the fix
  - In the real build, one failed chunk turns the whole page into Next.js's error screen
  - Tests that say a module is never loaded pass only in one test order
tags: [nextjs-16, next-dynamic, react-lazy, error-boundary, vitest, vi-mock, test-isolation, lazy-loading]
---

# Testing a next/dynamic island in Vitest: use the App Router dynamic, and vi.doMock per test

## Context

In task 13 (branch `13_home_page`), `ScrollScene` (`src/components/site/scroll-scene.tsx`) loads the GSAP effects (`scroll-scene-effects.tsx`) lazily with `next/dynamic` and `ssr: false`. `ce-code-review` raised a P1: if that chunk failed to download (weak signal, a content blocker, an old file name after a redeploy) or the effects threw, Next.js's error screen replaced the whole home page. The repo has no `error.tsx` or `global-error.tsx`, so nothing in between catches it.

The unit tests gave false confidence in two ways.

**1. Vitest loads a different `next/dynamic` from the one the build uses.**

- In Vitest, `next/dynamic` is `node_modules/next/dynamic.js`, which is `require('./dist/shared/lib/dynamic')`. That's the Pages Router version, built on `loadable.shared-runtime.js`. Its `load()` catches the loader's rejection and stores it (`state.error = err`, line 55). The component then renders the `loading` component with that error. The default `loading` in `dist/shared/lib/dynamic.js` (lines 62–79) shows the error message outside production and `null` in production. Either way, the error never reaches React, and the rest of the page stays.
- The App Router build swaps it out. `createAppRouterApiAliases` in `node_modules/next/dist/build/create-compiler-aliases.js` maps `dynamic` to `next/dist/api/app-dynamic` (line 273). That file re-exports `dist/shared/lib/app-dynamic`, which calls `dist/shared/lib/lazy-dynamic/loadable.js`: `React.lazy(() => opts.loader().then(convertModule))` inside `Suspense`, with no `.catch`. A rejected load, or a component that throws, goes to the nearest error boundary.

So the first test written for the fix (load fails, the page stays) passed even without the fix. The test file used the Pages Router version, which handled the failure by itself.

**2. `vi.mock` plus `vi.resetModules()` doesn't give each test a fresh mock.**

`vi.mock` is hoisted to the top of the file. Its factory ran once, in whichever test first imported the effects. `vi.resetModules()` clears the module cache but, in its own words (`node_modules/vitest/dist/index.d.ts`, Vitest 5.0.5), "does not reset mocks registry". The factory, which called `effects.loaded()`, never ran again. So `expect(effects.loaded).not.toHaveBeenCalled()` held in later tests no matter what the component did. The "never loaded under reduced motion" tests passed because an earlier test had already loaded the stand-in.

## Guidance

1. **Make the test file use the App Router `next/dynamic`.** It's a CommonJS file whose export is the function itself:

   ```ts
   // The App Router build swaps next/dynamic for its own version, React.lazy
   // underneath (create-compiler-aliases.js maps it to next/dist/api/app-dynamic).
   vi.mock("next/dynamic", async () => {
     const appDynamic = await import("next/dist/shared/lib/app-dynamic");
     return { default: appDynamic.default ?? appDynamic };
   });
   ```

   Hoisting is fine here, because this mock never needs to change between tests.

2. **Guard an optional island in two places:** the loader and an error boundary.

   ```tsx
   const ScrollSceneEffects = dynamic(
     () =>
       import("./scroll-scene-effects")
         .then((module) => module.ScrollSceneEffects)
         .catch(() => NoMotion), // the file couldn't be downloaded: render nothing
     { ssr: false },
   );

   class WithoutMotionOnError extends Component<{ children: ReactNode }, { failed: boolean }> {
     state = { failed: false };
     static getDerivedStateFromError() {
       return { failed: true };
     }
     render() {
       return this.state.failed ? null : this.props.children;
     }
   }

   // in render:
   <WithoutMotionOnError>
     <ScrollSceneEffects scope={scope} />
   </WithoutMotionOnError>
   ```

   The boundary is the part you can't skip. Under `React.lazy`, a failed download is thrown while rendering too, so the boundary catches both failures. `.catch` turns a failed download into "no motion" before React sees an error. Then the expected case never goes through the error path.

3. **Write one test for each failure, and check it fails without the fix.** In `scroll-scene.test.tsx`, "the effects file fails to load" mocks the module with a factory that throws. "The effects throw while setting up" mocks a component whose `useLayoutEffect` throws. Both check the page's own text is still there. The task 13 session reported that both tests failed with the fix removed (commit `bb2ca49`). This doc's run couldn't re-check that: running Vitest needed approval.

4. **Mock a module you check for loading with `vi.doMock` in `beforeEach`, not `vi.mock`:**

   ```ts
   beforeEach(() => {
     vi.resetModules();
     mockEffects(); // vi.doMock("./scroll-scene-effects", async () => { effects.loaded(); ... })
     effects.loaded.mockClear();
   });
   afterEach(() => {
     vi.doUnmock("./scroll-scene-effects");
   });
   // and import the component inside each test: (await import("./scroll-scene")).ScrollScene
   ```

   `vi.doMock` isn't hoisted, so it runs where you write it. After `resetModules()`, the next import runs the factory again.

5. **Add a positive control.** Where the module should load, check `expect(effects.loaded).toHaveBeenCalledTimes(1)`. That proves the factory really runs in each test, so a `not.toHaveBeenCalled()` elsewhere means something.

6. **Shuffle the tests to catch order dependence:**

   ```bash
   for seed in 1 2 3 4 5; do npx vitest run src/components/site/scroll-scene.test.tsx --sequence.shuffle --sequence.seed=$seed; done
   ```

   The learning doc records `Tests  9 passed (9)` for every seed after the review fixes.

## Why This Matters

A lazy chunk can fail in production for reasons no test reproduces: a dropped connection, a blocker, a deploy that renamed the chunk while a visitor still had the old page open. With the Pages Router `next/dynamic` in Vitest, every test of that failure passes whether the guard exists or not. The bug only shows in the built app, as a blank error screen in place of the home page. The final code shows the guard but not why the test mocks `next/dynamic`. Without this lesson, the next island (task 18's menu panel) would likely get a test that passes the same way.

## When to Apply

- **Task 18 (`18_services_pricing`):** loading the phone menu's panel with `next/dynamic` on the first tap (task.md backlog line, from the task 12 SEO check). The menu isn't an optional extra, so "render nothing" is the wrong fallback there. Choose one that still lets people get to the links, and test it with the App Router dynamic as above.
- Any `React.lazy` or `next/dynamic` island in this repo, and any test that says a module is "never loaded".
- **Limit of the boundary:** an error boundary catches errors thrown while rendering and in a component's effects. It doesn't catch errors thrown later from a GSAP callback, a timer or an event listener. GSAP re-runs `media.add` setups from its own listener on a breakpoint change. That gap is a separate task 18 item (move the `try`/`catch` in `scroll-scene-effects.tsx` inside the callback).
- **After a Next.js upgrade,** check that `create-compiler-aliases.js` still maps `dynamic` to `next/dist/api/app-dynamic` and that `next/dist/shared/lib/app-dynamic` still exists, or the mock in step 1 breaks or stops matching the build.

## Examples

Before: a test that passes with or without the guard, because Vitest's `next/dynamic` swallows the failure:

```ts
// no next/dynamic mock: Vitest uses dist/shared/lib/dynamic (Pages Router)
vi.doMock("./scroll-scene-effects", () => {
  throw new Error("Failed to load chunk");
});
render(<ScrollScene><h2>How it works</h2></ScrollScene>);
await settle();
expect(screen.getByText("How it works")).toBeTruthy(); // green even with no .catch and no boundary (task 13 session)
```

After: the same test, with the App Router `next/dynamic` mocked at the top of the file (step 1). It fails while both the `.catch` and the boundary are missing.

## Related

- `src/components/site/scroll-scene.tsx`: the loader fallback and `WithoutMotionOnError`
- `src/components/site/scroll-scene.test.tsx`: the `next/dynamic` mock, `mockEffects()`, the two failure tests
- `document/learning/13_home_page.md`: step 11 ("Tests that passed only by luck of order"), "Checks and reviews" (the P1 and how it was proven), "Common mistakes"
- `document/task/task.md`, `18_services_pricing`: the menu panel and the GSAP re-run guard items
- `document/solutions/conventions/nextjs-16-read-bundled-docs-image-priority.md`: read Next.js's own files before trusting memory. Here the answer was in `node_modules/next/dist/build/`, not the docs
- `document/solutions/conventions/lint-guards-test-real-jsx-shapes.md`: the same rule for tests: switch the fix off and make sure the test goes red
- `node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md`: `next/dynamic` and `ssr: false` in the App Router
- Vitest `vi.doMock` and `vi.resetModules`: https://vitest.dev/api/vi.html#vi-domock
- React error boundaries: https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary
