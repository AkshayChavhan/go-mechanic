"use client";

// One price group's card in the staff price editor (task 39): the group's
// price for every fuel, a fold with a box per fuel when the group has more
// than one, and its own Save button. /admin/prices/[serviceId] shows one per
// price group, each posting to savePrices with its service and group bound.
//
// A client island like the account forms: it keeps the action's answer
// (useActionState), shows a "no connection" message when the call fails
// (submitterWithFallback), moves the cursor to the first box with an error,
// and starts fresh on every visit (FreshOnEachVisit: a shared staff phone).
// It needs JavaScript: the page renders it inside <Suspense>, which only
// shows once React's script has run. It reads no messages: the gate passes
// every label as a prop.

import { Fragment, useActionState, useEffect, useId, useRef } from "react";

import { type FormAction, FreshOnEachVisit, ids, SubmitButton, submitterWithFallback } from "@/components/account/form-parts";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { PriceBox } from "@/domain/services";
import type { Fuel } from "@/domain/vehicles";
import {
  initialPriceFormState,
  type PriceFormState,
  type PriceFormValues,
  priceFieldName,
  readPriceForm,
} from "@/lib/price-form";

/** savePrices with the locale, service and group bound by the page. */
export type PriceAction = FormAction<PriceFormState>;

/** Every word a card shows. The gate reads them; `save` already names the group. */
export type PriceGroupFormLabels = {
  groupLabel: string;
  groupHint: string;
  fuelsSummary: string;
  fuelsHint: string;
  /** "Save Hatchback prices": each card's button says which group it saves. */
  save: string;
  saving: string;
  saved: string;
  /** What a failed call says: no network, or the server broke. */
  connection: string;
  /** The rupee sign shown before each box (rupeeSymbol()). */
  currency: string;
};

type PriceGroupFormProps = {
  action: PriceAction;
  /** The price group's name: the card's heading. */
  heading: string;
  /** The fuels the group is shown for (groupFuels), with their names. A fold of boxes only for two or more. */
  fuels: readonly { fuel: Fuel; label: string }[];
  /** The saved amounts, as the boxes show them ("1,500"). */
  initial: PriceFormValues;
  labels: PriceGroupFormLabels;
};

/**
 * What useActionState runs on each submit: a failed call (no network)
 * becomes the `connection` message, with what was typed kept.
 */
function priceSubmitter(action: PriceAction, connectionText: string) {
  return submitterWithFallback(action, (previous, formData) => ({
    submission: previous.submission + 1,
    values: readPriceForm(formData),
    errors: { form: connectionText },
    saved: null,
  }));
}

/** One price group's card. It starts fresh on every visit. */
export function PriceGroupForm(props: PriceGroupFormProps) {
  return (
    <FreshOnEachVisit>
      <PriceGroupFormVisit {...props} />
    </FreshOnEachVisit>
  );
}

function PriceGroupFormVisit({ action, heading, fuels, initial, labels }: PriceGroupFormProps) {
  const [state, formAction] = useActionState(priceSubmitter(action, labels.connection), initialPriceFormState);
  const id = useId();
  const form = useRef<HTMLFormElement>(null);

  // After an error answer, the cursor goes to the first box with an error.
  // Not when the page opens (on a phone that pops up the keyboard), and not
  // after a save (the saved line is announced instead).
  useEffect(() => {
    if (state.submission > 0 && Object.keys(state.errors).length > 0) {
      form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
  }, [state.submission, state.errors]);

  const values = state.submission > 0 ? state.values : initial;
  const showFuels = fuels.length >= 2;
  const fuelFilled = showFuels && fuels.some(({ fuel }) => (values[fuel] ?? "") !== "");

  const box = (name: PriceBox, label: string, hint?: string) => {
    const boxId = `${id}-${name}`;
    const error = state.errors[name];
    return (
      <Field data-invalid={error ? true : undefined}>
        <FieldLabel htmlFor={boxId}>{label}</FieldLabel>
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="type-body text-muted-foreground">
            {labels.currency}
          </span>
          <Input
            id={boxId}
            name={priceFieldName(name)}
            inputMode="numeric"
            autoComplete="off"
            defaultValue={values[name] ?? ""}
            aria-invalid={error ? true : undefined}
            aria-describedby={ids(hint && `${boxId}-hint`, error && `${boxId}-error`)}
          />
        </div>
        {hint && <FieldDescription id={`${boxId}-hint`}>{hint}</FieldDescription>}
        {error && <FieldError id={`${boxId}-error`}>{error}</FieldError>}
      </Field>
    );
  };

  return (
    <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-4 rounded-xl bg-card p-5 shadow-sm">
      <h2 id={`${id}-heading`} className="type-title">
        {heading}
      </h2>
      {/* Keyed by the answer: the card remounts after each one, with the
          answer's values as its starting values, so an error never empties it. */}
      <form key={state.submission} ref={form} action={formAction} className="flex flex-col gap-4">
        {box("group", labels.groupLabel, labels.groupHint)}
        {showFuels && (
          <details open={fuelFilled || undefined} className="flex flex-col gap-4">
            <summary className="flex min-h-11 cursor-pointer items-center rounded-md type-callout font-medium text-link outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
              {labels.fuelsSummary}
            </summary>
            <div className="flex flex-col gap-4">
              <p className="type-caption text-pretty text-muted-foreground">{labels.fuelsHint}</p>
              {fuels.map(({ fuel, label }) => (
                <Fragment key={fuel}>{box(fuel, label)}</Fragment>
              ))}
            </div>
          </details>
        )}
        {state.errors.form && (
          <p role="alert" className="type-callout text-destructive">
            {state.errors.form}
          </p>
        )}
        {state.saved && (
          <div role="status" className="flex flex-col gap-1 type-callout">
            <p className="font-semibold">{labels.saved}</p>
            <ul className="text-muted-foreground">
              {state.saved.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        )}
        <SubmitButton pendingLabel={labels.saving}>{labels.save}</SubmitButton>
      </form>
    </section>
  );
}
