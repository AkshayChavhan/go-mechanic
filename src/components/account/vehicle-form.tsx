"use client";

// The add-vehicle form on /account/vehicles/new (task 21): the vehicle
// picker, the registration number and two optional expiry dates.
//
// A client component ("island") like the login form: it keeps the action's
// answer (useActionState) and moves the cursor after an error. It reads no
// messages: the page reads them on the server and passes every label as a
// prop.
//
// Two things make it start fresh, and keep it in step with what it posted:
// - After each answer, the form remounts (keyed by the answer's submission
//   counter) with what was posted as its starting values. Everything typed
//   and picked stays after an error, and React's own reset after an action
//   restores those same values.
// - Each visit starts empty. Next.js hides a page you leave instead of
//   unmounting it (React's <Activity>), which would keep the last draft, its
//   errors and the action's answer for the next visit, even for the next
//   customer on a shared phone. When the page is hidden, a layout effect's
//   cleanup gives the form a new key, so it remounts empty.

import { LoaderCircleIcon } from "lucide-react";
import { unstable_rethrow } from "next/navigation";
import { type ReactNode, useActionState, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { VehiclePicker, type VehiclePickerLabels } from "@/components/site/vehicle-picker";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { type Fuel, FUELS, type VehicleCatalogue } from "@/domain/vehicles";
import { initialVehicleFormState, type VehicleFormState, type VehicleFormValues } from "@/lib/account-forms";

/** The addVehicle Server Action with the locale already bound: addVehicle.bind(null, locale). */
export type VehicleAction = (previous: VehicleFormState, formData: FormData) => Promise<VehicleFormState>;

/** Every word the form shows, from the MyVehicles messages. The page reads them. */
export type VehicleFormLabels = {
  registrationLabel: string;
  registrationHint: string;
  pucLabel: string;
  insuranceLabel: string;
  submit: string;
  saving: string;
  /** What a failed call says: no network, or the server broke. */
  connection: string;
};

type VehicleFormProps = {
  action: VehicleAction;
  /** The listed catalogue (readVehicleCatalogue()): the page shows no form when it's empty. */
  catalogue: VehicleCatalogue;
  labels: VehicleFormLabels;
  pickerLabels: VehiclePickerLabels;
};

/** The form's fields as posted, read from a FormData. */
function postedValues(formData: FormData): VehicleFormValues {
  const text = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : "";
  };
  return {
    modelId: text("vehicleModel"),
    fuel: text("vehicleFuel"),
    registration: text("registration"),
    pucExpiresOn: text("pucExpiresOn"),
    insuranceExpiresOn: text("insuranceExpiresOn"),
  };
}

/**
 * Wraps the Server Action into the function useActionState runs on each
 * submit. A saved vehicle makes the action redirect to /account, which
 * reaches the browser as a rejected promise: unstable_rethrow() must come
 * first and pass it on to Next.js. Any other failure (no network) becomes
 * the `connection` message, with everything posted kept.
 */
export function vehicleSubmitter(action: VehicleAction, connectionText: string) {
  return async function submit(previous: VehicleFormState, formData: FormData): Promise<VehicleFormState> {
    try {
      return await action(previous, formData);
    } catch (error) {
      unstable_rethrow(error);
      return { submission: previous.submission + 1, values: postedValues(formData), errors: { form: connectionText } };
    }
  };
}

/** The add-vehicle form. It starts empty on every visit (see the top of this file). */
export function VehicleForm(props: VehicleFormProps) {
  const [visit, setVisit] = useState(0);
  // The cleanup runs when the page is hidden (and on unmount, where the new
  // key does nothing). A layout effect, so it happens before the page is
  // hidden: no flash of the old draft.
  useLayoutEffect(() => () => setVisit((count) => count + 1), []);
  return <VehicleFormVisit key={visit} {...props} />;
}

function VehicleFormVisit({ action, catalogue, labels, pickerLabels }: VehicleFormProps) {
  const [state, formAction] = useActionState(vehicleSubmitter(action, labels.connection), initialVehicleFormState);
  return (
    // Keyed by the answer: remounts with what was posted as its defaults.
    <VehicleFields
      key={state.submission}
      state={state}
      formAction={formAction}
      catalogue={catalogue}
      labels={labels}
      pickerLabels={pickerLabels}
    />
  );
}

/** A posted fuel, if it is one: the picker's defaultValue takes a Fuel or nothing. */
function fuelOrNull(value: string): Fuel | null {
  return (FUELS as readonly string[]).includes(value) ? (value as Fuel) : null;
}

/** "a b" from the ids that are set: the value of an aria-describedby. */
function ids(...list: (string | false | undefined)[]): string | undefined {
  return list.filter(Boolean).join(" ") || undefined;
}

function VehicleFields({
  state,
  formAction,
  catalogue,
  labels,
  pickerLabels,
}: Omit<VehicleFormProps, "action"> & { state: VehicleFormState; formAction: (formData: FormData) => void }) {
  const id = useId();
  const form = useRef<HTMLFormElement>(null);
  const { values, errors } = state;
  // Electric vehicles have no PUC certificate: the field goes once the
  // picker knows the fuel (the server drops a PUC date sent with one anyway).
  const [electric, setElectric] = useState(values.fuel === "electric");

  // After an answer with errors, the cursor goes to the first field to fix.
  // Not when the page opens: on a phone that would pop the keyboard up.
  useEffect(() => {
    if (state.submission === 0) return;
    form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [state.submission]);

  return (
    <form ref={form} action={formAction} className="flex flex-col gap-8">
      <VehiclePicker
        catalogue={catalogue}
        labels={pickerLabels}
        defaultValue={{ modelId: values.modelId || null, fuel: fuelOrNull(values.fuel) }}
        onChange={(selection) => setElectric(selection.fuel === "electric")}
        error={errors.vehicle}
      />

      <Field data-invalid={errors.registration ? true : undefined}>
        <FieldLabel htmlFor={`${id}-registration`}>{labels.registrationLabel}</FieldLabel>
        {/* Plain text: people type plates in many shapes ("mh-12 ab 1234");
            the server reads them all. Capitals on phones, no autocorrect. */}
        <Input
          id={`${id}-registration`}
          name="registration"
          autoCapitalize="characters"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          required
          defaultValue={values.registration}
          aria-invalid={errors.registration ? true : undefined}
          aria-describedby={ids(`${id}-registration-hint`, errors.registration && `${id}-registration-error`)}
        />
        <FieldDescription id={`${id}-registration-hint`}>{labels.registrationHint}</FieldDescription>
        {errors.registration && <FieldError id={`${id}-registration-error`}>{errors.registration}</FieldError>}
      </Field>

      {!electric && (
        <DateField
          id={`${id}-puc`}
          name="pucExpiresOn"
          label={labels.pucLabel}
          defaultValue={values.pucExpiresOn}
          error={errors.pucExpiresOn}
        />
      )}
      <DateField
        id={`${id}-insurance`}
        name="insuranceExpiresOn"
        label={labels.insuranceLabel}
        defaultValue={values.insuranceExpiresOn}
        error={errors.insuranceExpiresOn}
      />

      {errors.form && <FieldError>{errors.form}</FieldError>}
      <SubmitButton pendingLabel={labels.saving}>{labels.submit}</SubmitButton>
    </form>
  );
}

/**
 * An optional date, with the phone's own date picker. No min or max: the
 * page is built ahead of time, so it can't know today's date; the server
 * checks the range.
 */
function DateField({
  id,
  name,
  label,
  defaultValue,
  error,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue: string;
  error: string | undefined;
}) {
  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        name={name}
        type="date"
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </Field>
  );
}

/** "Save vehicle", with a spinner and `pendingLabel` while it's being sent. */
function SubmitButton({ pendingLabel, children }: { pendingLabel: string; children: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-fit">
      {pending && <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />}
      {pending ? pendingLabel : children}
    </Button>
  );
}
