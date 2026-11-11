"use client";

// What the account's form islands share (NameForm, VehicleForm; task 21):
// the submit button, the wrapper that starts a form fresh on every visit,
// and the submit function useActionState runs. LoginForm keeps its own: its
// two steps and countdowns need more.

import { LoaderCircleIcon } from "lucide-react";
import { unstable_rethrow } from "next/navigation";
import { Fragment, type ReactNode, useLayoutEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

/** A form's Server Action with the locale already bound: saveName.bind(null, locale). */
export type FormAction<State> = (previous: State, formData: FormData) => Promise<State>;

/**
 * Wraps a Server Action into the function useActionState runs on each
 * submit. A save that worked makes the action redirect, which reaches the
 * browser as a rejected promise: unstable_rethrow() must come first and pass
 * it on to Next.js. Any other failure (no network, a server error) becomes
 * the state `whenFailed` builds, so the form keeps what was typed and says
 * what happened.
 */
export function submitterWithFallback<State>(
  action: FormAction<State>,
  whenFailed: (previous: State, formData: FormData) => State,
): FormAction<State> {
  return async function submit(previous, formData) {
    try {
      return await action(previous, formData);
    } catch (error) {
      unstable_rethrow(error);
      return whenFailed(previous, formData);
    }
  };
}

/**
 * Starts its children fresh on every visit to the page. Next.js hides a page
 * you leave instead of unmounting it (React's <Activity>), which would keep
 * the last draft, its errors and the action's answer for the next visit,
 * even for the next customer on a shared phone. When the page is hidden, a
 * layout effect's cleanup gives the children a new key, so they remount
 * empty before the page shows again (node_modules/next/dist/docs/01-app/
 * 02-guides/preserving-ui-state.md). It also runs on a real unmount, where
 * the new key does nothing, and once on mount in development, where React's
 * Strict Mode runs effects twice: the children then mount twice.
 */
export function FreshOnEachVisit({ children }: { children: ReactNode }) {
  const [visit, setVisit] = useState(0);
  useLayoutEffect(() => () => setVisit((count) => count + 1), []);
  return <Fragment key={visit}>{children}</Fragment>;
}

/** The form's submit button: a spinner and `pendingLabel` while the form is being sent. */
export function SubmitButton({ pendingLabel, children }: { pendingLabel: string; children: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-fit">
      {pending && <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />}
      {pending ? pendingLabel : children}
    </Button>
  );
}
