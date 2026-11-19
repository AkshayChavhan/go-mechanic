"use client";

// The booking wizard on /book (task 47): the vehicle, what it needs, a time,
// then logging in (if needed) and confirming, and the booking code at the end.
//
// One client island that keeps every choice in its own state, so going back
// and forth between steps loses nothing. It reads no messages: the page
// passes every word as props (labels, loginLabels, pickerLabels) and the
// Call and WhatsApp buttons as server-rendered children (contactLinks).
//
// Things that aren't obvious (plan KTD10,
// document/plans/2026-11-11-2016-feat-booking-flow-plan.md):
// - A login made here can't be read by the page until the next request
//   (document/solutions/conventions/server-action-login-invisible-until-next-request.md).
//   So the wizard trusts its own "verified" answer, and takes the customer's
//   saved vehicles and whether a name is missing from Confirm's answers,
//   never from its first props after an inline login. For the same reason it
//   is NOT keyed by the user's id: a key that flips would remount it and
//   lose every choice. "Not you?" clears the first customer's details on
//   purpose instead.
// - It needs JavaScript: both forms pass a browser-side wrapper to
//   useActionState (for the "no connection" message and the "verified"
//   hand-over), so the server's HTML has no address to post to. The page
//   says so in a <noscript>.
// - FreshOnEachVisit starts it empty on each visit (Next.js hides a page you
//   leave instead of unmounting it).

import { LoaderCircleIcon } from "lucide-react";
import { useLocale } from "next-intl";
import { type ReactNode, useActionState, useEffect, useId, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";

import { type FormAction, FreshOnEachVisit, submitterWithFallback } from "@/components/account/form-parts";
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
  ContinueButton,
  hasFreeSlot,
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
  type BookingSummary,
  CONFIRM_FIELD_NAMES,
  type ConfirmAnswer,
  type ConfirmErrors,
  type ConfirmState,
  initialConfirmState,
  type SerializedSlotDay,
} from "@/lib/booking-form";
import { initialLoginState } from "@/lib/login-state";
import type { MyVehicle } from "@/server/dal/customer-vehicles";

/** bookingLoginStep with the locale bound. */
export type BookingLoginAction = (previous: BookingLoginState, formData: FormData) => Promise<BookingLoginState>;
/** confirmBooking with the locale bound. */
export type ConfirmAction = FormAction<ConfirmState>;

/** Who is logged in when the page renders, or null. */
export type BookingWizardAccount = { phoneDisplay: string; vehicles: MyVehicle[]; needsName: boolean };

export type BookingWizardProps = {
  loginAction: BookingLoginAction;
  confirmAction: ConfirmAction;
  /** notMe with the locale bound. */
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

type Done = { kind: "booked"; booking: BookingSummary } | { kind: "duplicate"; code: string; message: string };

/** The wizard. It starts empty on every visit (see the top of this file). */
export function BookingWizard(props: BookingWizardProps) {
  return (
    <FreshOnEachVisit>
      <Wizard {...props} />
    </FreshOnEachVisit>
  );
}

/**
 * The registration typed before the page's JavaScript loaded, if any. React
 * sets a controlled field back to its first render's value when it hydrates
 * it, so the first render reads it from the page (as VehiclePicker does).
 */
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

  // --- What the choices add up to ---
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

  /**
   * A new vehicle drops the chosen services it isn't offered for, and says
   * so. Only once the vehicle is complete: half-way through a change (a type
   * but no model yet) nothing is dropped.
   */
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
    if (service.kind === "package") {
      if (serviceIds.length > 0 && !chosenPackage) setNote(labels.servicesReplaced);
      else if (chosenPackage) setNote(fill(labels.packageReplaced, { name: nameOf(chosenPackage.service.id) }));
      setServiceIds([service.id]);
    } else if (chosenPackage) {
      setNote(fill(labels.packageReplaced, { name: nameOf(chosenPackage.service.id) }));
      setServiceIds([service.id]);
    } else {
      setServiceIds([...serviceIds, service.id]);
    }
  }

  /** Continue: drop the errors this step had, then go on. */
  function continueFrom(next: BookingStep, fields: (keyof ConfirmErrors)[]) {
    setErrors((current) => {
      const rest = { ...current };
      for (const field of fields) delete rest[field];
      return rest;
    });
    go(next);
  }

  // --- The login step's "verified": the wizard's own word for "logged in" ---
  function verified(phoneDisplay: string) {
    setSession({ phoneDisplay, vehicles: [], needsName: false });
    setErrors({});
    // After "Not you?" the number was cleared: step 1 asks for it again.
    if (choice.kind === "typed" && choice.registration.trim() === "") {
      setStep("vehicle");
      setNote(labels.registrationAgain);
      return;
    }
    go("confirm");
  }

  // --- Confirm, and what its answers change ---
  function applyAnswer(next: ConfirmState) {
    const { answer } = next;
    if (next.account) {
      const { vehicles, needsName } = next.account;
      setSession((current) => (current ? { ...current, vehicles, needsName } : current));
      // The picked saved vehicle is gone: pick again from the fresh list.
      if (choice.kind === "saved" && !vehicles.some((vehicle) => vehicle.id === choice.vehicleId)) {
        setChoice(vehicles[0] ? { kind: "saved", vehicleId: vehicles[0].id } : BLANK_TYPED_VEHICLE);
      }
    }
    setNameDraft(next.nameTyped);
    switch (answer.kind) {
      case "idle":
        return;
      case "booked":
        setDone({ kind: "booked", booking: answer.booking });
        return;
      case "duplicate":
        setDone({ kind: "duplicate", code: answer.code, message: answer.message });
        return;
      case "needs-login":
        setSession(null);
        setLoginRun((run) => run + 1);
        break;
      case "needs-name":
        setSession((current) => current && { ...current, needsName: true });
        break;
      case "slot-problem":
        setSlots(answer.slots);
        break;
      case "problems":
        if (answer.slots) setSlots(answer.slots);
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
    nameTyped: String(formData.get(CONFIRM_FIELD_NAMES.name) ?? ""),
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

  // --- Drawing it ---
  const reasonId = `${id}-reason`;
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
        <StepActions labels={labels} reason={vehicleReady ? undefined : labels.vehicleReason} reasonId={reasonId}>
          <ContinueButton
            labels={labels}
            ready={vehicleReady}
            reasonId={reasonId}
            onContinue={() => continueFrom("services", ["vehicle", "registration"])}
          />
        </StepActions>
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
          reason={ready || offered.length === 0 ? undefined : labels.servicesReason}
          reasonId={reasonId}
        >
          {offered.length > 0 && (
            <ContinueButton
              labels={labels}
              ready={ready}
              reasonId={reasonId}
              onContinue={() => continueFrom("slot", ["services"])}
            />
          )}
        </StepActions>
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
          reason={slot || !day ? undefined : labels.slotReason}
          reasonId={reasonId}
        >
          {/* No free time at all: Call and WhatsApp above, and no Continue. */}
          {day && (
            <ContinueButton
              labels={labels}
              ready={slot !== null}
              reasonId={reasonId}
              onContinue={() => continueFrom(session ? "confirm" : "login", ["slot"])}
            />
          )}
        </StepActions>
      </>
    );
  } else if (step === "login" || !session) {
    body = (
      <>
        {errors.form && <FieldError>{errors.form}</FieldError>}
        <LoginPart key={loginRun} action={loginAction} labels={loginLabels} onVerified={verified} />
        <StepActions labels={labels} onBack={() => go("slot")} reasonId={reasonId}>
          {null}
        </StepActions>
      </>
    );
  } else {
    body = (
      <form action={confirmFormAction} className="flex flex-col gap-8">
        {/* What Confirm posts (CONFIRM_FIELD_NAMES); the server reads nothing else. */}
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
            <ul className="flex flex-col gap-1">
              {chosen.map((item) => (
                <li key={item.service.id} className="flex flex-wrap justify-between gap-x-4">
                  <span>{localize(item.service.name, locale)}</span>
                  <span className="text-muted-foreground">{linePriceText(item, labels, locale)}</span>
                </li>
              ))}
            </ul>
          </SummaryRow>
          <SummaryRow term={labels.timeTerm} labels={labels} onChange={() => go("slot")}>
            {slot && slotText(slot.startsAt, labels, locale)}
          </SummaryRow>
          <SummaryRow term={labels.totalTerm} labels={labels}>
            <span className="font-semibold">{totalText(total, labels, locale)}</span>
            <span className="block type-callout text-muted-foreground">{labels.payAtGarage}</span>
          </SummaryRow>
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
              aria-describedby={`${id}-name-hint${errors.name ? ` ${id}-name-error` : ""}`}
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

        <StepActions labels={labels} onBack={() => go("slot")} reasonId={reasonId}>
          <ConfirmButton labels={labels} />
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

/**
 * A random version-4 uuid. Not crypto.randomUUID(): browsers offer it only
 * on HTTPS and localhost, so a phone trying `npm run dev` over the local
 * network would break. getRandomValues works everywhere.
 */
function newRequestToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // the RFC 4122 variant
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** The vehicle priced for the chosen services, or null until one is chosen. */
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

/** One row of the summary, with a Change button that goes back to its step. */
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

function ConfirmButton({ labels }: { labels: BookingWizardLabels }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-fit">
      {pending && <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />}
      {pending ? labels.confirming : labels.confirm}
    </Button>
  );
}

/**
 * The login step: /login's own phone, code and consent steps (LoginSteps),
 * with an action that answers "verified" instead of redirecting. Keyed by
 * the wizard, so "Not you?" and an ended login start it over.
 */
function LoginPart({
  action,
  labels,
  onVerified,
}: {
  action: BookingLoginAction;
  labels: LoginFormLabels;
  onVerified: (phoneDisplay: string) => void;
}) {
  const [state, formAction, isPending] = useActionState<LoginFormState, FormData>(
    bookingLoginSubmitter(action, labels.connection, onVerified),
    initialLoginState,
  );
  return <LoginSteps state={state} formAction={formAction} isPending={isPending} labels={labels} />;
}

/**
 * /login's submitter (the "no connection" message, the "We sent a code"
 * line) around the booking's login action. "verified" isn't a step the
 * login steps know: it is handed to the wizard (onVerified), and the steps
 * keep their last state while the wizard moves on.
 */
export function bookingLoginSubmitter(
  action: BookingLoginAction,
  connectionText: string,
  onVerified: (phoneDisplay: string) => void,
) {
  return async function submit(previous: LoginFormState, formData: FormData): Promise<LoginFormState> {
    let phoneDisplay: string | null = null;
    const next = await loginSubmitter(async (answer, data) => {
      const reply = await action(answer, data);
      if (reply.step !== "verified") return reply;
      phoneDisplay = reply.phoneDisplay ?? answer.phoneDisplay ?? "";
      return answer;
    }, connectionText)(previous, formData);
    if (phoneDisplay !== null) onVerified(phoneDisplay);
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
        {/* The one big thing on the screen: what the customer must keep. */}
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
            <ul className="flex flex-col gap-1">
              {done.booking.lines.map((line) => (
                <li key={line.serviceId} className="flex flex-wrap justify-between gap-x-4">
                  <span>{localize(line.name, locale)}</span>
                  <span className="text-muted-foreground">{linePriceText(line, labels, locale)}</span>
                </li>
              ))}
            </ul>
          </SummaryRow>
          <SummaryRow term={labels.totalTerm} labels={labels}>
            <span className="font-semibold">{totalText(done.booking, labels, locale)}</span>
            <span className="block type-callout text-muted-foreground">{labels.payAtGarage}</span>
          </SummaryRow>
        </dl>
      )}
      <div className="flex flex-col gap-4">
        <p className="type-body">{labels.reachUs}</p>
        {contactLinks}
      </div>
    </div>
  );
}
