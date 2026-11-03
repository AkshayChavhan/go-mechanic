---
title: "React 19 form islands under Next.js 16: hydration resets, browser-only actions, hidden pages"
date: 2026-11-03
category: conventions
module: "src/components/site/vehicle-picker.tsx, src/components/account/"
problem_type: convention
component: frontend
severity: medium
applies_when:
  - "A client form island reads a controlled select, radio or input that the visitor may change before the page's JavaScript loads"
  - "A form passes a browser-side wrapper to useActionState"
  - "A page can be hidden and shown again with React's Activity, as Next.js does on navigation"
tags:
  - react-19
  - hydration
  - use-action-state
  - activity
  - next-16
  - forms
---

# React 19 form islands under Next.js 16: hydration resets, browser-only actions, hidden pages

## Context

Task 21 (branch `21_customer_vehicles`, not yet merged) added two client form islands, the name form and the add-vehicle form, plus a vehicle picker made of native selects and radios. Three behaviours surprised us. Each was found by a test or by review, not by reading the docs first:

1. **Hydration reset.** A visitor who picked a model before the page's JavaScript loaded lost the choice when React hydrated the page. A `hydrateRoot` test failed with `expected '' to be 'car-honda-city'`.
2. **No-JavaScript posting.** Passing a browser-side wrapper to `useActionState` meant the server's HTML had no real form address to post to, so the form could not post without JavaScript. Our first comments said it could.
3. **Hidden pages keep state.** Next.js hides a page you leave (React's `<Activity>`) instead of unmounting it. Drafts, errors and the action's last answer came back on the next visit, and a focus effect moved the cursor, which on a phone pops up the keyboard.

## Guidance

### 1. Read controlled fields in the first render, through `useId`

React 19 sets a controlled `select`, radio or input back to what its first render says when it hydrates. A choice made before hydration is therefore lost unless the first render reads it. Read the fields already in the page inside the `useState` initializer, and find them with the id from `useId`, which is the same on the server and during hydration:

```tsx
const id = useId();
const [selection, setSelection] = useState(() => {
  const inPage = fieldsInPage(id, name); // reads document, only in the browser
  return inPage ? normalizeSelection(catalogue, inPage) : start;
});
```

`fieldsInPage` returns `null` on the server (`typeof document === "undefined"`). React logs no hydration warning for a value or `checked` that differs from the server's HTML, so this needs no suppression. The regression test is `vehicle-picker.test.tsx`: it renders the server HTML, changes a field, then calls `hydrateRoot`.

### 2. Pass the Server Action itself when posting without JavaScript matters

`useActionState(wrapper, initial)` makes the form post to a browser-side function. The server then renders `action="javascript:throw..."` in place of a real URL. If a page must work without JavaScript, pass the Server Action directly:

```tsx
const [state, formAction] = useActionState(saveName, initial); // works without JS
```

Use a wrapper only when you need its extra behaviour, such as `unstable_rethrow(error)` for a redirect or a "no connection" message. Those forms need JavaScript, so say so in the code and in the docs, not "works without JavaScript". Task 21 chose the wrapper for the account forms, so they need JavaScript, as the login form does.

### 3. Give each visit a fresh form, and keep per-user forms keyed by user

A hidden page keeps its state. Wrap a form that must start empty on every visit in a component that changes its key when the page is hidden:

```tsx
export function FreshOnEachVisit({ children }: { children: ReactNode }) {
  const [visit, setVisit] = useState(0);
  useLayoutEffect(() => () => setVisit((count) => count + 1), []);
  return <Fragment key={visit}>{children}</Fragment>;
}
```

The `useLayoutEffect` cleanup runs when the page is hidden, so the children remount empty before the page shows again. The test renders the form inside `<Activity mode="hidden">`, then `mode="visible"`, and checks that the draft and the error are gone (`form-parts.test.tsx`, `name-form.test.tsx`, `vehicle-form.test.tsx`).

Two more rules come with this:

- Effects run again when a hidden page is shown. A focus effect would therefore re-run on every visit. Run it only after an answer (`state.submission > 0`), and reset the submission count with the remount.
- A form shown per user takes the user's id in its `key`, so the next customer on a shared phone never sees the last one's draft.

## Why This Matters

- Trap 1 loses a visitor's choice silently. Nothing errors, and the form posts the wrong vehicle.
- Trap 2 breaks the "works without JavaScript" promise the comments made. The break is invisible in the browser when JavaScript is on, so only a no-JS check or reading the server HTML shows it.
- Trap 3 leaks one customer's draft to the next on a shared phone, and it re-opens the keyboard on a phone.

## When to Apply

- Any client form that uses a controlled field and can be used before hydration finishes.
- Any `useActionState` call: decide first whether the form must post without JavaScript.
- Any form on a page with `<Activity>` (every Next.js page you can leave and come back to).

## Related

- `document/learning/21_customer_vehicles.md`: the task's learning doc, which has the first failing test.
- `document/solutions/conventions/nextjs-16-dev-server-is-not-one-process-use-cache-probe.md`: another Next.js 16 surprise, from task 14.
