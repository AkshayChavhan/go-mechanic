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
//   customer on a shared phone. FreshOnEachVisit (form-parts.tsx) gives the
//   form a new key when the page is hidden, so it remounts empty.

import { useActionState, useEffect, useId, useRef, useState } from "react";

import {
  type FormAction,
  FreshOnEachVisit,
  SubmitButton,
  submitterWithFallback,
} from "@/components/account/form-parts";
import { VehiclePicker, type VehiclePickerLabels } from "@/components/site/vehicle-picker";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { isFuel, type VehicleCatalogue } from "@/domain/vehicles";
import {
  initialVehicleFormState,
  readVehicleForm,
  VEHICLE_FIELD_NAMES,
  type VehicleFormState,
} from "@/lib/account-forms";

/** The addVehicle Server Action with the locale already bound: addVehicle.bind(null, locale). */
export type VehicleAction = FormAction<VehicleFormState>;

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

/**
 * What useActionState runs on each submit (submitterWithFallback): a saved
 * vehicle's redirect goes on to Next.js; a failed call (no network) becomes
 * the `connection` message, with everything posted kept.
 */
export function vehicleSubmitter(action: VehicleAction, connectionText: string) {
  return submitterWithFallback(action, (previous, formData) => ({
    submission: previous.submission + 1,
    values: readVehicleForm(formData),
    errors: { form: connectionText },
  }));
}

/** The add-vehicle form. It starts empty on every visit (see the top of this file). */
export function VehicleForm(props: VehicleFormProps) {
  return (
    <FreshOnEachVisit>
      <VehicleFormVisit {...props} />
    </FreshOnEachVisit>
  );
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
        defaultValue={{ modelId: values.modelId || null, fuel: isFuel(values.fuel) ? values.fuel : null }}
        onChange={(selection) => setElectric(selection.fuel === "electric")}
        error={errors.vehicle}
      />

      <Field data-invalid={errors.registration ? true : undefined}>
        <FieldLabel htmlFor={`${id}-registration`}>{labels.registrationLabel}</FieldLabel>
        {/* Plain text: people type plates in many shapes ("mh-12 ab 1234");
            the server reads them all. Capitals on phones, no autocorrect. */}
        <Input
          id={`${id}-registration`}
          name={VEHICLE_FIELD_NAMES.registration}
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
          name={VEHICLE_FIELD_NAMES.pucExpiresOn}
          label={labels.pucLabel}
          defaultValue={values.pucExpiresOn}
          error={errors.pucExpiresOn}
        />
      )}
      <DateField
        id={`${id}-insurance`}
        name={VEHICLE_FIELD_NAMES.insuranceExpiresOn}
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
