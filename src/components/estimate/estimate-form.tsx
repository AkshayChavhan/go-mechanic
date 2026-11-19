"use client";

// The free estimate request form on /estimate (task 32): which vehicle,
// what's wrong, and photos if the customer likes.
//
// A client component ("island") like the add-vehicle form (vehicle-form.tsx):
// it keeps the action's answer (useActionState) and moves the cursor to the
// first field to fix. It reads no messages: the page reads them on the server
// and passes every label as a prop.
//
// One difference from VehicleForm: the <form> belongs to the visit, not to
// the answer. The visit keeps two things an answer must not reset:
// - the request token, made the first time the form is sent and added to
//   every send of this visit, so a retry after a lost answer never makes a
//   second request;
// - the photo uploader, so an error never empties the photos.
// Inside the <form>:
// - the fields (vehicle and description), keyed by the answer's submission
//   counter, so they remount with what was posted as their starting values;
// - the Send button, which waits while photos are still on their way, with a
//   line under it saying why.
// FreshOnEachVisit starts it all fresh on each visit, with a new token: the
// next customer on a shared phone never sees the last one's draft or photos.

import { LoaderCircleIcon } from "lucide-react";
import { useActionState, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { useFormStatus } from "react-dom";

import { type FormAction, FreshOnEachVisit, submitterWithFallback } from "@/components/account/form-parts";
import { ChoiceGroup } from "@/components/site/choice-group";
import { PhotoUploader, type PhotoUploaderLabels, type PhotoUploaderProps } from "@/components/site/photo-uploader";
import { VehiclePicker, type VehiclePickerLabels } from "@/components/site/vehicle-picker";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { ESTIMATE_REQUEST_RULES } from "@/domain/estimate-requests";
import { isFuel, type VehicleCatalogue } from "@/domain/vehicles";
import {
  ESTIMATE_FIELD_NAMES,
  type EstimateFormState,
  initialEstimateFormState,
  OTHER_VEHICLE,
  readEstimateForm,
} from "@/lib/estimate-form";

/** The sendEstimateRequest Server Action with the locale already bound. */
export type EstimateAction = FormAction<EstimateFormState>;

/** Every word the form shows, from the EstimatePage messages. The page reads them. */
export type EstimateFormLabels = {
  vehicleLegend: string;
  otherVehicle: string;
  descriptionLabel: string;
  descriptionHint: string;
  /** "{count}" of "{max}" characters. */
  descriptionCount: string;
  photosLegend: string;
  photosHint: string;
  submit: string;
  sending: string;
  /** Under Send while photos are picked but not sent, or failed. */
  waitingForPhotos: string;
  /** What a failed call says: no network, or the server broke. */
  connection: string;
};

/** A saved vehicle as a choice: "Honda City · MH 12 AB 1234", made on the server. */
export type SavedVehicleChoice = { id: string; label: string };

export type EstimateFormProps = {
  action: EstimateAction;
  /** The customer's saved vehicles; with none, the form shows only the picker (so the gate never shows the form with neither). */
  savedVehicles: readonly SavedVehicleChoice[];
  /** The listed catalogue (readVehicleCatalogue()). */
  catalogue: VehicleCatalogue;
  labels: EstimateFormLabels;
  pickerLabels: VehiclePickerLabels;
  photoLabels: PhotoUploaderLabels;
  /** The photo actions, their locale bound by the page. */
  startPhotos: PhotoUploaderProps["start"];
  finishPhotos: PhotoUploaderProps["finish"];
};

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}

/** "a b" from the ids that are set: the value of an aria-describedby. */
function ids(...list: (string | false | undefined)[]): string | undefined {
  return list.filter(Boolean).join(" ") || undefined;
}

/**
 * What useActionState runs on each submit: it adds the visit's request token
 * (`token()`), then a sent request's redirect goes on to Next.js; a failed
 * call (no network) becomes the `connection` message, with everything
 * posted kept.
 */
export function estimateSubmitter(action: EstimateAction, connectionText: string, token: () => string) {
  const withToken: EstimateAction = (previous, formData) => {
    formData.set(ESTIMATE_FIELD_NAMES.requestToken, token());
    return action(previous, formData);
  };
  return submitterWithFallback(withToken, (previous, formData) => ({
    submission: previous.submission + 1,
    values: readEstimateForm(formData),
    errors: { form: connectionText },
  }));
}

/** The estimate request form. It starts fresh on every visit (see the top of this file). */
export function EstimateForm(props: EstimateFormProps) {
  return (
    <FreshOnEachVisit>
      <EstimateFormVisit {...props} />
    </FreshOnEachVisit>
  );
}

function EstimateFormVisit({ action, labels, photoLabels, startPhotos, finishPhotos, ...fieldProps }: EstimateFormProps) {
  const id = useId();
  const form = useRef<HTMLFormElement>(null);
  // One per visit, made on the first send and reused by every retry of it.
  const token = useRef<string | null>(null);
  const [state, formAction] = useActionState(
    estimateSubmitter(action, labels.connection, () => (token.current ??= crypto.randomUUID())),
    initialEstimateFormState,
  );
  const [photosBusy, setPhotosBusy] = useState(false);

  // After an answer with errors, the cursor goes to the first field to fix.
  // Not when the page opens: on a phone that would pop the keyboard up.
  useEffect(() => {
    if (state.submission === 0) return;
    form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [state.submission]);

  return (
    <form ref={form} action={formAction} className="flex flex-col gap-8">
      {/* Keyed by the answer: remounts with what was posted as its defaults. */}
      <EstimateFields key={state.submission} state={state} labels={labels} {...fieldProps} />

      <FieldSet data-invalid={state.errors.photos ? true : undefined} className="gap-2">
        <FieldLegend variant="label">{labels.photosLegend}</FieldLegend>
        <FieldDescription>{labels.photosHint}</FieldDescription>
        <PhotoUploader
          labels={photoLabels}
          start={startPhotos}
          finish={finishPhotos}
          name={ESTIMATE_FIELD_NAMES.photoSetId}
          uploadVariant="secondary"
          onBusyChange={setPhotosBusy}
        />
        {state.errors.photos && <FieldError>{state.errors.photos}</FieldError>}
      </FieldSet>

      {state.errors.form && <FieldError>{state.errors.form}</FieldError>}
      <div className="flex flex-col gap-2">
        <SendButton
          disabled={photosBusy}
          describedBy={photosBusy ? `${id}-waiting` : undefined}
          pendingLabel={labels.sending}
        >
          {labels.submit}
        </SendButton>
        <p id={`${id}-waiting`} className="type-callout text-muted-foreground" aria-live="polite">
          {photosBusy ? labels.waitingForPhotos : ""}
        </p>
      </div>
    </form>
  );
}

/** Send: a spinner while the form is being sent; disabled while photos are on their way. */
function SendButton({
  disabled,
  describedBy,
  pendingLabel,
  children,
}: {
  disabled: boolean;
  describedBy: string | undefined;
  pendingLabel: string;
  children: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={disabled || pending} aria-describedby={describedBy} className="w-full sm:w-fit">
      {pending && <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />}
      {pending ? pendingLabel : children}
    </Button>
  );
}

/**
 * The vehicle choice the page shows right now, or null when the radios
 * aren't in the page. Like the vehicle picker's fieldsInPage: it runs during
 * the first render in the browser, while React hydrates the server's HTML,
 * the only moment a choice tapped before the page's JavaScript loaded can
 * still be read. React then sets the radios to what this render says.
 */
function choiceInPage(groupId: string): string | null {
  if (typeof document === "undefined") return null;
  const checked = document
    .getElementById(groupId)
    ?.querySelector<HTMLInputElement>(`input[name="${ESTIMATE_FIELD_NAMES.vehicleChoice}"]:checked`);
  return checked?.value || null;
}

// Never changes: the fields only need to know whether they have hydrated.
const subscribeToNothing = () => () => {};

function EstimateFields({
  state,
  savedVehicles,
  catalogue,
  labels,
  pickerLabels,
}: Pick<EstimateFormProps, "savedVehicles" | "catalogue" | "labels" | "pickerLabels"> & { state: EstimateFormState }) {
  const id = useId();
  const { values, errors } = state;
  const hasSaved = savedVehicles.length > 0;
  // A choice tapped before hydration wins over the posted one (only there on a first render).
  const [choice, setChoice] = useState<string | null>(
    () => choiceInPage(`${id}-vehicle-choice`) ?? (values.vehicleChoice || null),
  );
  // While hydrating, the picker shows only where the server showed it (any
  // other structure is a hydration mismatch); a choice tapped before then
  // brings it in on the next render.
  const hydrated = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
  const shownChoice = hydrated ? choice : values.vehicleChoice || null;
  const usePicker = !hasSaved || shownChoice === OTHER_VEHICLE;
  const [length, setLength] = useState([...values.description.trim()].length);

  return (
    <>
      <div className="flex flex-col gap-6">
        {hasSaved && (
          <div id={`${id}-vehicle-choice`}>
            <ChoiceGroup
              legend={labels.vehicleLegend}
              name={ESTIMATE_FIELD_NAMES.vehicleChoice}
              options={[
                ...savedVehicles.map((vehicle) => ({ value: vehicle.id, label: vehicle.label })),
                { value: OTHER_VEHICLE, label: labels.otherVehicle },
              ]}
              value={choice}
              onChange={setChoice}
            />
          </div>
        )}
        {usePicker && (
          <VehiclePicker
            catalogue={catalogue}
            labels={pickerLabels}
            defaultValue={{ modelId: values.modelId || null, fuel: isFuel(values.fuel) ? values.fuel : null }}
            error={errors.vehicle}
          />
        )}
        {/* A saved vehicle's problem (it was removed meanwhile) shows under the choices. */}
        {!usePicker && errors.vehicle && <FieldError>{errors.vehicle}</FieldError>}
      </div>

      <Field data-invalid={errors.description ? true : undefined}>
        <FieldLabel htmlFor={`${id}-description`}>{labels.descriptionLabel}</FieldLabel>
        <Textarea
          id={`${id}-description`}
          name={ESTIMATE_FIELD_NAMES.description}
          required
          maxLength={ESTIMATE_REQUEST_RULES.descriptionMaxLength + 50}
          defaultValue={values.description}
          onChange={(event) => setLength([...event.currentTarget.value.trim()].length)}
          aria-invalid={errors.description ? true : undefined}
          aria-describedby={ids(`${id}-description-hint`, `${id}-description-count`, errors.description && `${id}-description-error`)}
        />
        <FieldDescription id={`${id}-description-hint`}>{labels.descriptionHint}</FieldDescription>
        <p id={`${id}-description-count`} className="type-caption text-muted-foreground tabular-nums" aria-live="polite">
          {fill(labels.descriptionCount, { count: length, max: ESTIMATE_REQUEST_RULES.descriptionMaxLength })}
        </p>
        {errors.description && <FieldError id={`${id}-description-error`}>{errors.description}</FieldError>}
      </Field>
    </>
  );
}
