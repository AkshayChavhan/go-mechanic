---
title: "React 19 form islands under Next.js 16: hydration resets, browser-only actions, hidden pages"
date: 2026-11-03
last_updated: 2026-11-19
category: conventions
module: "src/components/site/vehicle-picker.tsx, src/components/account/, src/components/estimate/estimate-form.tsx"
problem_type: convention
component: frontend
severity: medium
applies_when:
  - "A client form island reads a controlled select, radio or input that the visitor may change before the page's JavaScript loads"
  - "A form passes a browser-side wrapper to useActionState"
  - "A page can be hidden and shown again with React's Activity, as Next.js does on navigation"
  - "A client island starts its state from per-customer props (saved vehicles, a phone number) on a page a customer can leave and come back to after logging out elsewhere"
tags:
  - react-19
  - hydration
  - use-action-state
  - activity
  - next-16
  - forms
  - shared-phone
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

**Restore values, never structure, while hydrating (task 32).** The estimate form read a pre-hydration "Another vehicle" radio the same way, and showed the vehicle picker at once because of it. `hydrateRoot` then failed: "Hydration failed because the server rendered HTML didn't match the client". A different value is fine; a different element tree is not. Keep the read choice in state, but render what the server rendered until hydration is done, and let the next render add the extra part:

```tsx
const subscribeToNothing = () => () => {};
const hydrated = useSyncExternalStore(subscribeToNothing, () => true, () => false);
const [choice, setChoice] = useState(() => choiceInPage(groupId) ?? (values.vehicleChoice || null));
const shownChoice = hydrated ? choice : values.vehicleChoice || null; // the server's view while hydrating
const usePicker = !hasSaved || shownChoice === OTHER_VEHICLE;
```

The tapped radio stays checked (it reads `choice`), and the picker appears one render later. The test is "keeps a saved vehicle tapped before the page's JavaScript loaded" in `src/components/estimate/estimate-form.test.tsx`: it fails with the hydration error if the picker is shown during hydration, and loses the tap if `choiceInPage` is dropped.

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

### 3b. `FreshOnEachVisit` remounts with the props the page had when it was hidden

Found in task 47 (`/book`) by a browser test, after the unit tests passed. Customer A opens `/book` while logged in, goes to `/account`, logs out, and follows "Book a service" again. Next.js shows the `/book` it kept hidden. `FreshOnEachVisit` did remount the wizard, but at hide time, with A's props. The fresh props (`account: null`) arrive later, and a mounted island keeps the state it started with (`useState(account)`). So the page showed A's saved vehicle and number plate to the next person.

Keying the island by user id is the fix for most forms. It doesn't work for an island that changes the login itself: the booking wizard logs a customer in inline and must keep every choice, and the page's re-render after its own action still reads the old cookie (`server-action-login-invisible-until-next-request.md`). The wizard uses `FollowPageLogin` (`src/components/booking/booking-wizard.tsx`):

- A `useLayoutEffect` keyed on the login identity (`account?.phoneDisplay`) bumps a key that remounts the island when the identity changes. Layout effects don't run while the page is hidden and do run before paint when it shows, so the old customer is never painted.
- A ref, set just before the island's own login or "Not you?" action is sent, makes that change not count. Use a ref, not state: state set inside an async action may only commit after the action, which is too late.

Test it the way Next.js runs it: render the island inside `<Activity>`, hide it, show it with stale props, then fresh ones (`booking-wizard.test.tsx`, "the page's login changes under it"). Then check it in a real browser too (`e2e/booking.spec.ts`, "the next customer on a shared phone"): the unit tests had passed before the browser test found the leak.

## Why This Matters

- Trap 1 loses a visitor's choice silently. Nothing errors, and the form posts the wrong vehicle.
- Trap 2 breaks the "works without JavaScript" promise the comments made. The break is invisible in the browser when JavaScript is on, so only a no-JS check or reading the server HTML shows it.
- Trap 3 leaks one customer's draft to the next on a shared phone, and it re-opens the keyboard on a phone. 3b leaks their saved data (vehicles, plates, phone number) the same way, even with `FreshOnEachVisit` in place.

## When to Apply

- Any client form that uses a controlled field and can be used before hydration finishes.
- Any island where that field decides what else renders (a "show more fields" choice): render the server's tree until hydrated.
- Any `useActionState` call: decide first whether the form must post without JavaScript.
- Any form on a page with `<Activity>` (every Next.js page you can leave and come back to).

## Related

- `document/learning/21_customer_vehicles.md`: the task's learning doc, which has the first failing test.
- `document/learning/47_book_wizard.md`: where 3b was found and fixed.
- `document/solutions/conventions/server-action-login-invisible-until-next-request.md`: why an island that logs in inline can't trust its page's props.
- `document/solutions/conventions/nextjs-16-dev-server-is-not-one-process-use-cache-probe.md`: another Next.js 16 surprise, from task 14.
