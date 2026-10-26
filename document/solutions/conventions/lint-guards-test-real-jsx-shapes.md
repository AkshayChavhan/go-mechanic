---
title: "Test a lint guard against the shapes real code uses, not just <p>Hello</p>"
date: 2026-10-26
category: conventions
module: eslint.config.mjs
problem_type: convention
component: tooling
related_components: [frontend, testing]
severity: medium
applies_when:
  - Adding or changing a rule in eslint.config.mjs that is meant to block something (a "lint guard")
  - Task 12 (12_layout_shell), whose open-now badge and mobile menu button use the shapes jsx-no-literals misses
  - Adding a no-restricted-syntax selector, or a new config block for files under src/app/ or src/components/
  - Writing a plan that says a lint rule will be "checked by hand"
tags: [eslint, lint-guards, jsx-no-literals, no-restricted-syntax, esquery, flat-config, i18n, next-intl, vitest]
---

# Test a lint guard against the shapes real code uses

## Context

Task 10 (branch `10_i18n_foundation`) added a lint guard: text typed into JSX fails lint, so it goes in `messages/en.json` and can be translated. The plan said to check it by hand (`document/plans/2026-10-25-1448-feat-i18n-foundation-plan.md`, U4): add `<p>Hello</p>` to a page, see `npm run lint` fail, then revert. That check passed, but the guard still let most real text through.

The rule was `react/jsx-no-literals` (eslint-plugin-react 7.37.5) with `{ noStrings: true, ignoreProps: true }`. It only checks a string whose parent or grandparent is a JSX node (`standardJSXNodeParentTypes` and `getParentAndGrandParent` in `node_modules/eslint-plugin-react/lib/rules/jsx-no-literals.js`). So it misses:

- **Text chosen by a condition:** `{isOpen ? "Open now" : "Closed"}`, `{error && "Oops"}`, `{name ?? "Guest"}`. The string's parent is the condition, not JSX.
- **A condition inside a condition:** `{a ? t("x") : b ? "Closed today" : "Closed"}`.
- **Every prop, because of `ignoreProps`.** That's right for `className` and `href`, but it also skips text people read or hear: `alt`, `title`, `placeholder`, `aria-label`, `aria-description`, `aria-valuetext`, `aria-roledescription` and `aria-placeholder`. That includes `aria-label={isOpen ? "Close menu" : "Open menu"}`.

It took two review rounds to find all of these. First `ce-code-review` found the condition and attribute gaps, fixed in commit `d22e8e7`. After that fix, the `code-reviewer` agent found three more (a condition inside a condition, a condition inside `aria-label`, and `aria-roledescription`/`aria-placeholder`), fixed in `92f4a86`. Real UI code uses every one of these shapes.

## Guidance

1. **List the shapes before you write the guard.** Ask "how would real code break this rule?", not "what's the simplest example?". For JSX text, list text between tags, text in `{"..."}` or a template string, text in each kind of condition (`?:`, `&&`, `||`, `??`), a condition inside a condition, and every attribute a person reads or hears. Also list what must stay allowed: `t("key")`, `t(isOpen ? "a" : "b")`, `className={isOpen ? "..." : "..."}`, numbers, `aria-hidden="true"`, `aria-current="page"`.
2. **Fill the gaps with `no-restricted-syntax`, next to the plugin rule.** The text guard block in `eslint.config.mjs` does this. Its selectors use child combinators (`>`) that start at JSX (`JSXElement > JSXExpressionContainer > condition > text`), so a string is flagged only when JSX shows it. `t(isOpen ? "a" : "b")` stays allowed because the condition's parent is the `t()` call, not the `JSXExpressionContainer`. `className={...}` stays allowed because the attribute selectors only name reader-facing attributes.
3. **Name the reader-facing attributes one by one. Don't widen the list to `aria-.*`.** That would flag `aria-hidden="true"`, `aria-current="page"` and `aria-live="polite"`. Those are settings, not text.
4. **Write one selector per nesting depth. A combinator inside `:matches()` doesn't add a level.** In esquery 1.7.0 (the selector engine ESLint 9 uses), each outer `>` checks the matched node's direct parent. A `>` inside `:matches(...)` checks more ancestors, but it doesn't move the outer chain up past them. So in `JSXExpressionContainer > :matches(C, C > C) > Literal`, the literal's grandparent still has to be the container, and the condition-inside-a-condition case passed lint. That's why the config has two separate selectors: `container > condition > text` and `container > condition > condition > text`. A `:matches()` that lists plain node types, like `:matches(ConditionalExpression, LogicalExpression)`, is fine. Seen for real in task 10: a first try, `JSXAttribute[...] > JSXExpressionContainer > :matches(text, condition > text)`, still let `aria-label={isOpen ? "Close menu" : "Open menu"}` through, and the lint-guards test caught it before the commit.
5. **Keep every `no-restricted-syntax` selector in one config block.** In flat config, when two blocks match the same file and both give options for one rule, the later block's options replace the earlier ones. They aren't merged. Only a severity-only setting like `"warn"` keeps the earlier options (see `rulesSchema.merge` in `node_modules/eslint/lib/config/flat-config-schema.js`). So a later block that adds one selector for, say, `src/components/admin/**` would quietly switch off every text selector for those files. Add new selectors to the existing list instead. `eslint-config-next` doesn't set this rule today, so nothing collides yet.
6. **Lock every guard in with a test, then prove the test.** `src/i18n/lint-guards.test.ts` lints snippets with the real config and writes no files: `new ESLint({ cwd: repoRoot }).lintText(code, { filePath: "src/app/[locale]/example.tsx" })`. The `filePath` decides which config blocks apply, so these tests also cover the `files` and `ignores` globs. Add one "rejects" case for each bad shape and one "allows" case for each good one. Then switch the rule off for a moment and make sure the tests go red: a test that stays green without the rule proves nothing. Checked when this doc was written: switching `no-restricted-syntax` off failed exactly the 7 "rejects" cases that expect it (`Tests  7 failed | 14 passed (21)`).
7. **Don't settle for a hand check in the plan.** "Add `<p>Hello</p>` and see lint fail" only proves the easiest case. A plan for a lint guard should list the shapes from step 1 as test cases.

## Why This Matters

A lint guard that misses common shapes is worse than none, because everyone trusts a green `npm run lint` and stops looking. The missed text would have stayed in English when Hindi arrives, and screen-reader labels would never have been translated. In task 10, each gap cost a review round and a fix commit. The final config doesn't tell the next person that the plugin rule alone had these holes, or why the selectors are split by depth.

## When to Apply

- **Task 12 (`12_layout_shell`):** the open-now badge (`{isOpen ? ... : ...}`) and the mobile menu button (an `aria-label` that changes with the menu) are exactly these shapes. Use `t()` for both. Lint should reject the typed versions.
- **Any new lint guard:** a banned import, a banned pattern or a required wrapper.
- **Any change to the text guard's `files` or `ignores`,** or a new config block that matches files in `src/app/` or `src/components/`.

## Examples

These passed lint when only `jsx-no-literals` was on:

```tsx
<p>{isOpen ? "Open now" : "Closed"}</p>
<button aria-label={isOpen ? "Close menu" : "Open menu"} />
```

This is the right way (the message keys are made-up examples):

```tsx
<p>{isOpen ? t("openNow") : t("closed")}</p>
<button aria-label={isOpen ? t("closeMenu") : t("openMenu")} />
```

The matching case in `src/i18n/lint-guards.test.ts`:

```ts
["an aria-label chosen by a condition", component('<button aria-label={isOpen ? "Close menu" : "Open menu"} />'), "no-restricted-syntax"],
```

## Related

- `eslint.config.mjs`: the text guard block and its selector pieces (`readAttributes`, `condition`, `text`)
- `src/i18n/lint-guards.test.ts`: the guard tests
- `CLAUDE.md`, "Languages (next-intl)": the same rule, written for people
- `document/learning/10_i18n_foundation.md`: the task 10 learning doc
- `document/plans/2026-10-25-1448-feat-i18n-foundation-plan.md`: U4, the hand check that wasn't enough
- `document/solutions/conventions/run-commands-before-documenting-output.md`: the same idea, applied to docs: check what really happens, not what should happen
- ESLint selectors: https://eslint.org/docs/latest/extend/selectors
- `react/jsx-no-literals`: https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/jsx-no-literals.md
