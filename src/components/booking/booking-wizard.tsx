"use client";

// The booking wizard on /book (task 47): vehicle, services, time, then login
// and confirm. One client island keeps every choice in state, so going back
// loses nothing. It reads no messages: the page passes every word as props.
//
// Rules to keep:
// - A login made here isn't visible to the page until the next request
//   (document/solutions/conventions/server-action-login-invisible-until-next-request.md).
//   So trust the "verified" answer (it says whether the name is missing), and
//   take saved vehicles from Confirm's answers, never from the first props.
// - Don't key the wizard by user id: a flipping key remounts it and loses every
//   choice. "Not you?" clears the first customer's details instead.
// - Needs JavaScript (browser-side wrappers around the actions); the page has a <noscript>.

import { LoaderCircleIcon } from "lucide-react";
import { useLocale } from "next-intl";
import { type ReactNode, useActionState, useEffect, useId, useRef, useState, useTransition } from "react";

import { type FormAction, FreshOnEachVisit, SubmitButton, submitterWithFallback } from "@/components/account/form-parts";
import {
  loginSubmitter,
  LoginSteps,
  type LoginFormLabels,
  type LoginFormState,
} from "@/components/account/login-form";
import { type BookingWizardLabels, fill, linePriceText, totalText } from "@/components/booking/booking-labels";
import { offeredServices, pricedVehicleOf, totalOf } from "@/components/booking/booking-prices";
import {
  BLANK_TYPED_VEHICLE,
  hasFreeSlot,
  ids,
  savedVehicleText,
  ServicesStep,
  SlotStep,
  StepActions,
  type VehicleChoice,
  VehicleStep,
} from "@/components/booking/booking-steps";
import type { VehiclePickerLabels } from "@/components/site/vehicle-picker";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MAX_SERVICES } from "@/domain/bookings";
import { parseRegistration, formatRegistration } from "@/domain/registration";
import type { PricedVehicle, Service, ServicePrice } from "@/domain/services";
import { findModel, type VehicleCatalogue } from "@/domain/vehicles";
import { indiaDateOf } from "@/domain/india-time";
import type { Locale } from "@/i18n/config";
import { formatIndiaDay, formatTime } from "@/i18n/format";
import { localize } from "@/i18n/localized-text";
import {
  type BookingLoginState,
  type BookingStep,
  CONFIRM_FIELD_NAMES,
  type ConfirmAnswer,
  type ConfirmErrors,
  type ConfirmState,
  initialConfirmState,
  type SerializedSlotDay,
} from "@/lib/booking-form";
import { formText } from "@/lib/form-text";
import { initialLoginState } from "@/lib/login-state";
import type { MyVehicle } from "@/server/dal/customer-vehicles";

export type BookingLoginAction = (previous: BookingLoginState, formData: FormData) => Promise<BookingLoginState>;
export type ConfirmAction = FormAction<ConfirmState>;

/** Who is logged in when the page renders, or null. */
export type BookingWizardAccount = { phoneDisplay: string; vehicles: MyVehicle[]; needsName: boolean };

export type BookingWizardProps = {
  loginAction: BookingLoginAction;
  confirmAction: ConfirmAction;
  notMeAction: () => Promise<BookingLoginState>;
  /** The listed catalogue (readVehicleCatalogue()). */
  catalogue: VehicleCatalogue;
  /** The listed services and packages, and the real prices (never the dev samples). */
  services: readonly Service[];
  prices: readonly ServicePrice[];
  /** The live slot list (serializeSlotDays(await readAvailableSlots())). */
  slots: SerializedSlotDay[];
  account: BookingWizardAccount | null;
  labels: BookingWizardLabels;
  loginLabels: LoginFormLabels;
  pickerLabels: VehiclePickerLabels;
  /** The garage's Call and WhatsApp buttons, rendered on the server. */
  contactLinks: ReactNode;
};

/** The four steps the customer counts: logging in and confirming share step 4. */
const STEP_NUMBER: Record<BookingStep, number> = { vehicle: 1, services: 2, slot: 3, login: 4, confirm: 4 };
const STEP_COUNT = 4;

type Done = Extract<ConfirmAnswer, { kind: "booked" | "duplicate" }>;

/** The wizard. Starts empty on each visit: Next.js hides a page instead of unmounting it. */
export function BookingWizard(props: BookingWizardProps) {
  return (
    <FreshOnEachVisit>
      <Wizard {...props} />
    </FreshOnEachVisit>
  );
}

/** What was typed before JavaScript loaded: React resets a controlled field to its first render's value on hydration (as VehiclePicker does). */
function registrationInPage(id: string): string {
  if (typeof document === "undefined") return "";
  return document.querySelector<HTMLInputElement>(`[id="${id}-registration"]`)?.value ?? "";
}

function Wizard({
  loginAction,
  confirmAction,
  notMeAction,
  catalogue,
  services,
  prices,
  slots: firstSlots,
  account,
  labels,
  loginLabels,
  pickerLabels,
  contactLinks,
}: BookingWizardProps) {
  const locale = useLocale();
  const id = useId();
  const [step, setStep] = useState<BookingStep>("vehicle");
  const [session, setSession] = useState<BookingWizardAccount | null>(account);
  const [choice, setChoice] = useState<VehicleChoice>(() =>
    account && account.vehicles.length > 0
      ? { kind: "saved", vehicleId: account.vehicles[0].id }
      : { ...BLANK_TYPED_VEHICLE, registration: registrationInPage(id) },
  );
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [slots, setSlots] = useState(firstSlots);
  const [dayChoice, setDayChoice] = useState<string | null>(null);
  const [startsAt, setStartsAt] = useState<string | null>(null);
  const [errors, setErrors] = useState<ConfirmErrors>({});
  /** Said in the live region: a choice the wizard dropped by itself. */
  const [note, setNote] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  /** Goes up to start the login step over (after "Not you?" or an ended login). */
  const [loginRun, setLoginRun] = useState(0);
  const [done, setDone] = useState<Done | null>(null);
  // One per visit: a second Confirm (a double tap, a retry) makes no second booking.
  const [requestToken] = useState(newRequestToken);
  const [leaving, startLeaving] = useTransition();

  const savedVehicles = session?.vehicles ?? [];
  const pricedVehicle = pricedVehicleFor(choice, savedVehicles, catalogue);
  const offered = offeredServices(services, prices, pricedVehicle);
  const chosen = offered.filter((item) => serviceIds.includes(item.service.id));
  const total = totalOf(chosen);
  const freeDays = slots.filter(hasFreeSlot);
  const day = freeDays.find((each) => each.date === dayChoice) ?? freeDays[0] ?? null;
  const slot = day?.slots.find((each) => each.startsAt === startsAt && each.remaining > 0) ?? null;
  const vehicleReady =
    choice.kind === "saved"
      ? savedVehicles.some((vehicle) => vehicle.id === choice.vehicleId)
      : pricedVehicle !== null && parseRegistration(choice.registration).ok;

  // --- Moving between steps: the heading takes focus after a change, not on arrival ---
  const heading = useRef<HTMLHeadingElement>(null);
  const shownStep = useRef<string>(step);
  const screen = done ? "done" : step;
  useEffect(() => {
    if (shownStep.current === screen) return;
    shownStep.current = screen;
    heading.current?.focus();
  }, [screen]);

  function go(next: BookingStep) {
    setNote("");
    setStep(next);
  }

  /** A new vehicle drops the chosen services it isn't offered for, and says so. Only once the vehicle is complete. */
  function chooseVehicle(next: VehicleChoice) {
    setChoice(next);
    const vehicle = pricedVehicleFor(next, savedVehicles, catalogue);
    if (!vehicle) return;
    const stillOffered = new Set(offeredServices(services, prices, vehicle).map((item) => item.service.id));
    const dropped = serviceIds.filter((serviceId) => !stillOffered.has(serviceId));
    if (dropped.length === 0) return;
    setServiceIds(serviceIds.filter((serviceId) => stillOffered.has(serviceId)));
    const names = dropped.map((serviceId) => nameOf(serviceId)).join(", ");
    setNote(fill(labels.notOffered, { names }));
  }

  function nameOf(serviceId: string): string {
    const service = services.find((each) => each.id === serviceId);
    return service ? localize(service.name, locale) : serviceId;
  }

  /** One package or several services: choosing one kind drops the other, and says so. */
  function toggleService(service: Service, checked: boolean) {
    if (!checked) {
      setServiceIds(serviceIds.filter((serviceId) => serviceId !== service.id));
      return;
    }
    const chosenPackage = chosen.find((item) => item.service.kind === "package");
    if (chosenPackage) setNote(fill(labels.packageReplaced, { name: nameOf(chosenPackage.service.id) }));
    else if (service.kind === "package" && serviceIds.length > 0) setNote(labels.servicesReplaced);
    setServiceIds(service.kind === "package" || chosenPackage ? [service.id] : [...serviceIds, service.id]);
  }

  function continueFrom(next: BookingStep, fields: (keyof ConfirmErrors)[]) {
    setErrors((current) => {
      const rest = { ...current };
      for (const field of fields) delete rest[field];
      return rest;
    });
    go(next);
  }

  function verified(phoneDisplay: string, needsName: boolean) {
    setSession({ phoneDisplay, vehicles: [], needsName });
    setErrors({});
    // After "Not you?" the number was cleared: step 1 asks for it again.
    if (choice.kind === "typed" && choice.registration.trim() === "") {
      setStep("vehicle");
      setNote(labels.registrationAgain);
      return;
    }
    go("confirm");
  }

  function applyAnswer(next: ConfirmState) {
    const { answer } = next;
    if (next.account) {
      const { vehicles, needsName } = next.account;
      setSession((current) => (current ? { ...current, vehicles, needsName } : current));
      if (choice.kind === "saved" && !vehicles.some((vehicle) => vehicle.id === choice.vehicleId)) {
        setChoice(vehicles[0] ? { kind: "saved", vehicleId: vehicles[0].id } : BLANK_TYPED_VEHICLE);
      }
    }
    setNameDraft(next.nameTyped);
    if ("slots" in answer && answer.slots) setSlots(answer.slots);
    switch (answer.kind) {
      case "idle":
        return;
      case "booked":
      case "duplicate":
        setDone(answer);
        return;
      case "needs-login":
        setSession(null);
        setLoginRun((run) => run + 1);
        break;
      case "needs-name":
        setSession((current) => current && { ...current, needsName: true });
        break;
    }
    setErrors(answer.errors);
    go(answer.step);
  }

  // A failed call (no network) keeps everything and says so, on the confirm step.
  const connectionAnswer: ConfirmAnswer = { kind: "problems", step: "confirm", errors: { form: labels.connection } };
  const confirmSubmit = submitterWithFallback(confirmAction, (previous, formData) => ({
    ...previous,
    submission: previous.submission + 1,
    answer: connectionAnswer,
    nameTyped: formText(formData, CONFIRM_FIELD_NAMES.name),
  }));
  const [, confirmFormAction] = useActionState<ConfirmState, FormData>(async (previous, formData) => {
    const next = await confirmSubmit(previous, formData);
    applyAnswer(next);
    return next;
  }, initialConfirmState);

  /** "Not you?": log out here, keep the vehicle's model and the services, forget the rest. */
  function notMe() {
    startLeaving(async () => {
      try {
        await notMeAction();
      } catch {
        setErrors({ form: labels.connection });
        return;
      }
      if (choice.kind === "saved") {
        const vehicle = savedVehicles.find((each) => each.id === choice.vehicleId);
        const found = vehicle && findModel(catalogue, vehicle.modelId);
        setChoice(
          vehicle && found
            ? {
                kind: "typed",
                selection: { kind: vehicle.kind, makeId: found.make.id, modelId: vehicle.modelId, fuel: vehicle.fuel },
                registration: "",
              }
            : BLANK_TYPED_VEHICLE,
        );
      } else {
        setChoice({ ...choice, registration: "" });
      }
      setSession(null);
      setNameDraft("");
      setErrors({});
      setLoginRun((run) => run + 1);
      go("login");
    });
  }

  const totalLine = chosen.length > 0 && (
    <p className="type-callout font-semibold">{totalText(total, labels, locale)}</p>
  );

  let body: ReactNode;
  if (done) {
    body = <DoneScreen done={done} catalogue={catalogue} labels={labels} contactLinks={contactLinks} />;
  } else if (step === "vehicle") {
    body = (
      <>
        <VehicleStep
          id={id}
          choice={choice}
          onChoice={chooseVehicle}
          savedVehicles={savedVehicles}
          catalogue={catalogue}
          labels={labels}
          pickerLabels={pickerLabels}
          errors={errors}
        />
        <StepActions
          labels={labels}
          next={{
            ready: vehicleReady,
            reason: labels.vehicleReason,
            onContinue: () => continueFrom("services", ["vehicle", "registration"]),
          }}
        />
      </>
    );
  } else if (step === "services") {
    const ready = chosen.length > 0;
    body = (
      <>
        <ServicesStep
          offered={offered}
          chosen={serviceIds}
          onToggle={toggleService}
          atLimit={serviceIds.length >= MAX_SERVICES}
          labels={labels}
          error={errors.services}
          contactLinks={contactLinks}
        />
        {totalLine}
        <StepActions
          labels={labels}
          onBack={() => go("vehicle")}
          next={
            offered.length > 0
              ? { ready, reason: labels.servicesReason, onContinue: () => continueFrom("slot", ["services"]) }
              : undefined
          }
        />
      </>
    );
  } else if (step === "slot") {
    body = (
      <>
        <SlotStep
          days={slots}
          day={day?.date ?? null}
          onDay={(date) => {
            setDayChoice(date);
            setStartsAt(null);
          }}
          startsAt={slot?.startsAt ?? null}
          onTime={setStartsAt}
          labels={labels}
          error={errors.slot}
          contactLinks={contactLinks}
        />
        {totalLine}
        <StepActions
          labels={labels}
          onBack={() => go("services")}
          next={
            day
              ? {
                  ready: slot !== null,
                  reason: labels.slotReason,
                  onContinue: () => continueFrom(session ? "confirm" : "login", ["slot"]),
                }
              : undefined
          }
        />
      </>
    );
  } else if (step === "login" || !session) {
    body = (
      <>
        {errors.form && <FieldError>{errors.form}</FieldError>}
        <LoginPart key={loginRun} action={loginAction} labels={loginLabels} onVerified={verified} />
        <StepActions labels={labels} onBack={() => go("slot")} />
      </>
    );
  } else {
    body = (
      <form action={confirmFormAction} className="flex flex-col gap-8">
        {choice.kind === "saved" ? (
          <input type="hidden" name={CONFIRM_FIELD_NAMES.savedVehicleId} value={choice.vehicleId} />
        ) : (
          <>
            <input type="hidden" name={CONFIRM_FIELD_NAMES.modelId} value={choice.selection.modelId ?? ""} />
            <input type="hidden" name={CONFIRM_FIELD_NAMES.fuel} value={choice.selection.fuel ?? ""} />
            <input type="hidden" name={CONFIRM_FIELD_NAMES.registration} value={choice.registration} />
          </>
        )}
        {chosen.map((item) => (
          <input key={item.service.id} type="hidden" name={CONFIRM_FIELD_NAMES.service} value={item.service.id} />
        ))}
        <input type="hidden" name={CONFIRM_FIELD_NAMES.startsAt} value={slot?.startsAt ?? ""} />
        <input type="hidden" name={CONFIRM_FIELD_NAMES.requestToken} value={requestToken} />

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <p className="type-body">{fill(labels.bookingAs, { phone: session.phoneDisplay })}</p>
          <Button type="button" variant="link" className="px-0" disabled={leaving} onClick={notMe}>
            {leaving && <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />}
            {labels.notMe}
          </Button>
        </div>

        <dl className="flex flex-col divide-y divide-border rounded-xl bg-card px-5">
          <SummaryRow term={labels.vehicleTerm} labels={labels} onChange={() => go("vehicle")}>
            {vehicleText(choice, savedVehicles, catalogue, locale)}
          </SummaryRow>
          <SummaryRow term={labels.servicesTerm} labels={labels} onChange={() => go("services")}>
            <ServiceLines
              rows={chosen.map((item) => ({
                key: item.service.id,
                name: localize(item.service.name, locale),
                price: linePriceText(item, labels, locale),
              }))}
            />
          </SummaryRow>
          <SummaryRow term={labels.timeTerm} labels={labels} onChange={() => go("slot")}>
            {slot && slotText(slot.startsAt, labels, locale)}
          </SummaryRow>
          <TotalRow total={total} labels={labels} />
        </dl>

        {session.needsName && (
          <Field data-invalid={errors.name ? true : undefined}>
            <FieldLabel htmlFor={`${id}-name`}>{labels.nameLabel}</FieldLabel>
            <Input
              id={`${id}-name`}
              name={CONFIRM_FIELD_NAMES.name}
              autoComplete="name"
              required
              defaultValue={nameDraft}
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={ids(`${id}-name-hint`, errors.name && `${id}-name-error`)}
            />
            <FieldDescription id={`${id}-name-hint`}>{labels.nameHint}</FieldDescription>
            {errors.name && <FieldError id={`${id}-name-error`}>{errors.name}</FieldError>}
          </Field>
        )}

        {errors.form && (
          <div className="flex flex-col gap-4">
            <FieldError>{errors.form}</FieldError>
            {contactLinks}
          </div>
        )}

        <StepActions labels={labels} onBack={() => go("slot")}>
          <SubmitButton pendingLabel={labels.confirming}>{labels.confirm}</SubmitButton>
        </StepActions>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        {!done && (
          <p className="type-callout text-muted-foreground">
            {fill(labels.stepOf, { n: STEP_NUMBER[step], total: STEP_COUNT })}
          </p>
        )}
        <h2 ref={heading} tabIndex={-1} className="type-title outline-none">
          {done ? (done.kind === "booked" ? labels.doneHeading : labels.duplicateHeading) : labels.steps[step]}
        </h2>
      </div>
      {/* Always on the page, so screen readers hear it when it changes. */}
      <p role="status" className="type-callout empty:sr-only">
        {note}
      </p>
      {body}
    </div>
  );
}

/** A random v4 uuid. Not crypto.randomUUID(): it exists only on HTTPS and localhost, which breaks npm run dev on a phone over the local network. */
function newRequestToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // the RFC 4122 variant
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function pricedVehicleFor(
  choice: VehicleChoice,
  savedVehicles: readonly MyVehicle[],
  catalogue: VehicleCatalogue,
): PricedVehicle | null {
  if (choice.kind === "saved") {
    const vehicle = savedVehicles.find((each) => each.id === choice.vehicleId);
    return vehicle ? pricedVehicleOf(catalogue, vehicle) : null;
  }
  const found = findModel(catalogue, choice.selection.modelId);
  const fuel = choice.selection.fuel;
  if (!found || !fuel) return null;
  return pricedVehicleOf(catalogue, { kind: found.make.kind, modelId: found.model.id, fuel });
}

function vehicleText(
  choice: VehicleChoice,
  savedVehicles: readonly MyVehicle[],
  catalogue: VehicleCatalogue,
  locale: string,
): string {
  if (choice.kind === "saved") {
    const vehicle = savedVehicles.find((each) => each.id === choice.vehicleId);
    return vehicle ? savedVehicleText(vehicle, locale) : "";
  }
  const parsed = parseRegistration(choice.registration);
  return modelText(catalogue, choice.selection.modelId, parsed.ok ? parsed.display : choice.registration, locale);
}

/** "Honda City, MH 12 AB 0042"; just the number when the model isn't listed any more. */
function modelText(catalogue: VehicleCatalogue, modelId: string | null, registration: string, locale: string): string {
  const found = findModel(catalogue, modelId);
  if (!found) return registration;
  return `${localize(found.make.name, locale)} ${localize(found.model.name, locale)}, ${registration}`;
}

function slotText(startsAt: string, labels: BookingWizardLabels, locale: Locale): string {
  const date = new Date(startsAt);
  return fill(labels.slotAt, { day: formatIndiaDay(indiaDateOf(date), locale), time: formatTime(date, locale) });
}

function SummaryRow({
  term,
  labels,
  onChange,
  children,
}: {
  term: string;
  labels: BookingWizardLabels;
  onChange?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-4">
      <div className="flex min-w-0 flex-col gap-1">
        <dt className="type-callout text-muted-foreground">{term}</dt>
        <dd className="type-body">{children}</dd>
      </div>
      {onChange && (
        <Button
          type="button"
          variant="link"
          className="px-0"
          aria-label={fill(labels.changeLabel, { part: term })}
          onClick={onChange}
        >
          {labels.change}
        </Button>
      )}
    </div>
  );
}

/** The summary's services, one row each, with their prices. */
function ServiceLines({ rows }: { rows: { key: string; name: string; price: string }[] }) {
  return (
    <ul className="flex flex-col gap-1">
      {rows.map((row) => (
        <li key={row.key} className="flex flex-wrap justify-between gap-x-4">
          <span>{row.name}</span>
          <span className="text-muted-foreground">{row.price}</span>
        </li>
      ))}
    </ul>
  );
}

/** The summary's total row, with "pay at the garage" under it. */
function TotalRow({
  total,
  labels,
}: {
  total: { totalPaise: number | null; isEstimate: boolean };
  labels: BookingWizardLabels;
}) {
  const locale = useLocale();
  return (
    <SummaryRow term={labels.totalTerm} labels={labels}>
      <span className="font-semibold">{totalText(total, labels, locale)}</span>
      <span className="block type-callout text-muted-foreground">{labels.payAtGarage}</span>
    </SummaryRow>
  );
}

/** /login's steps, with an action that answers "verified" instead of redirecting. Keyed by the wizard, so "Not you?" restarts it. */
function LoginPart({
  action,
  labels,
  onVerified,
}: {
  action: BookingLoginAction;
  labels: LoginFormLabels;
  onVerified: (phoneDisplay: string, needsName: boolean) => void;
}) {
  const [state, formAction, isPending] = useActionState<LoginFormState, FormData>(
    bookingLoginSubmitter(action, labels.connection, onVerified),
    initialLoginState,
  );
  return <LoginSteps state={state} formAction={formAction} isPending={isPending} labels={labels} />;
}

/**
 * Wraps /login's submitter around the booking login action. "verified" isn't
 * a step LoginSteps knows: it goes to onVerified, and the steps keep their
 * last state.
 */
function bookingLoginSubmitter(
  action: BookingLoginAction,
  connectionText: string,
  onVerified: (phoneDisplay: string, needsName: boolean) => void,
) {
  return async function submit(previous: LoginFormState, formData: FormData): Promise<LoginFormState> {
    let verified: { phoneDisplay: string; needsName: boolean } | null = null;
    const next = await loginSubmitter(async (answer, data) => {
      const reply = await action(answer, data);
      if (reply.step !== "verified") return reply;
      verified = { phoneDisplay: reply.phoneDisplay ?? answer.phoneDisplay ?? "", needsName: reply.needsName };
      return answer;
    }, connectionText)(previous, formData);
    if (verified !== null) {
      const { phoneDisplay, needsName } = verified;
      onVerified(phoneDisplay, needsName);
    }
    return next;
  };
}

/** The booking code, what was booked, and how to reach the garage. */
function DoneScreen({
  done,
  catalogue,
  labels,
  contactLinks,
}: {
  done: Done;
  catalogue: VehicleCatalogue;
  labels: BookingWizardLabels;
  contactLinks: ReactNode;
}) {
  const locale = useLocale();
  const code = done.kind === "booked" ? done.booking.code : done.code;
  return (
    <div className="flex flex-col gap-8">
      {done.kind === "duplicate" && <p className="type-body">{done.message}</p>}
      <div className="flex flex-col gap-2 rounded-xl bg-card p-6">
        <p className="type-callout text-muted-foreground">{labels.codeLabel}</p>
        <p className="type-display font-semibold tabular-nums" translate="no">
          {code}
        </p>
        <p className="type-callout">{labels.codeNote}</p>
      </div>
      {done.kind === "booked" && (
        <dl className="flex flex-col divide-y divide-border rounded-xl bg-card px-5">
          <SummaryRow term={labels.vehicleTerm} labels={labels}>
            {modelText(
              catalogue,
              done.booking.vehicle.modelId,
              formatRegistration(done.booking.vehicle.registrationNumber),
              locale,
            )}
          </SummaryRow>
          <SummaryRow term={labels.timeTerm} labels={labels}>
            {slotText(done.booking.startsAt, labels, locale)}
          </SummaryRow>
          <SummaryRow term={labels.servicesTerm} labels={labels}>
            <ServiceLines
              rows={done.booking.lines.map((line) => ({
                key: line.serviceId,
                name: localize(line.name, locale),
                price: linePriceText(line, labels, locale),
              }))}
            />
          </SummaryRow>
          <TotalRow total={done.booking} labels={labels} />
        </dl>
      )}
      <div className="flex flex-col gap-4">
        <p className="type-body">{labels.reachUs}</p>
        {contactLinks}
      </div>
    </div>
  );
}
