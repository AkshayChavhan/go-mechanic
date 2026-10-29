"use client";

// The name form on /account (task 21): asked once, right after the first
// login.
//
// A client component ("island") like the login form: it keeps the action's
// answer (useActionState) and moves the cursor after an error. It reads no
// messages: /account reads them on the server and passes every label as a
// prop.

import { LoaderCircleIcon } from "lucide-react";
import { unstable_rethrow } from "next/navigation";
import { type ReactNode, useActionState, useEffect, useId, useRef } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { initialNameFormState, type NameFormState } from "@/lib/account-forms";

/** The saveName Server Action with the locale already bound: saveName.bind(null, locale). */
export type NameAction = (previous: NameFormState, formData: FormData) => Promise<NameFormState>;

/** Every word the form shows, from the Account messages. The page reads them. */
export type NameFormLabels = {
  heading: string;
  note: string;
  label: string;
  submit: string;
  saving: string;
  /** What a failed call says: no network, or the server broke. */
  connection: string;
};

/**
 * Wraps the Server Action into the function useActionState runs on each
 * submit. A saved name makes the action redirect to /account, which reaches
 * the browser as a rejected promise: unstable_rethrow() must come first and
 * pass it on to Next.js. Any other failure (no network) becomes the
 * `connection` message, with what was typed kept.
 */
export function nameSubmitter(action: NameAction, connectionText: string) {
  return async function submit(previous: NameFormState, formData: FormData): Promise<NameFormState> {
    try {
      return await action(previous, formData);
    } catch (error) {
      unstable_rethrow(error);
      const typed = formData.get("name");
      return {
        submission: previous.submission + 1,
        nameTyped: typeof typed === "string" ? typed : "",
        error: connectionText,
      };
    }
  };
}

export function NameForm({ action, labels }: { action: NameAction; labels: NameFormLabels }) {
  const [state, formAction] = useActionState(nameSubmitter(action, labels.connection), initialNameFormState);
  const id = useId();
  const input = useRef<HTMLInputElement>(null);

  // After an answer (always an error: a saved name leaves the page), the
  // cursor goes back to the field. Not when the page opens: on a phone that
  // would pop the keyboard over the page.
  useEffect(() => {
    if (state.submission > 0) input.current?.focus();
  }, [state.submission]);

  return (
    <section aria-labelledby={`${id}-heading`} className="flex max-w-md flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 id={`${id}-heading`} className="type-title">
          {labels.heading}
        </h2>
        <p className="type-body text-pretty text-muted-foreground">{labels.note}</p>
      </div>
      {/* Keyed by the answer: the form remounts after each one, with what
          was typed as its value, so an error never empties it. */}
      <form key={state.submission} action={formAction} className="flex flex-col gap-6">
        <Field data-invalid={state.error ? true : undefined}>
          <FieldLabel htmlFor={`${id}-name`}>{labels.label}</FieldLabel>
          <Input
            ref={input}
            id={`${id}-name`}
            name="name"
            autoComplete="name"
            required
            defaultValue={state.nameTyped}
            aria-invalid={state.error ? true : undefined}
            aria-describedby={state.error ? `${id}-error` : undefined}
          />
          {state.error && <FieldError id={`${id}-error`}>{state.error}</FieldError>}
        </Field>
        <SubmitButton pendingLabel={labels.saving}>{labels.submit}</SubmitButton>
      </form>
    </section>
  );
}

/** "Save name", with a spinner and `pendingLabel` while it's being sent. */
function SubmitButton({ pendingLabel, children }: { pendingLabel: string; children: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-fit">
      {pending && <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />}
      {pending ? pendingLabel : children}
    </Button>
  );
}
