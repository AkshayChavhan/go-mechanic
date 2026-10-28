"use client";

// The login form (task 15): the phone step, then the code step.
//
// A client component ("island") because it changes in the browser: the step,
// the countdowns, where the cursor goes. It reads no messages: the page reads
// them on the server and passes every label as a prop (`labels`), the way
// MobileMenu does. So the Login messages never join the messages every page
// sends to the browser (src/i18n/client-messages.ts).
//
// Both steps post to one Server Action, loginStep (src/server/actions/
// login.ts), told apart by the button pressed (name="intent"). The action
// answers with a LoginState (src/lib/login-state.ts): which step to show,
// what was typed, and any error, already translated. useActionState keeps the
// latest answer and passes it back with the next submit.

import { LoaderCircleIcon } from "lucide-react";
import { unstable_rethrow } from "next/navigation";
import {
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentProps,
  type RefObject,
} from "react";
import { useFormStatus } from "react-dom";

import { CheckboxField } from "@/components/site/checkbox-field";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { initialLoginState, type LoginState } from "@/lib/login-state";
import { cn } from "@/lib/utils";

/** The login Server Action with the locale already bound: loginStep.bind(null, locale). */
export type LoginAction = (previous: LoginState, formData: FormData) => Promise<LoginState>;

/** Every word the form shows, from the Login messages. The page reads them. */
export type LoginFormLabels = {
  phoneLabel: string;
  countryCode: string;
  phoneHint: string;
  ageLabel: string;
  consentLabel: string;
  notice: string;
  sendCode: string;
  sending: string;
  codeLabel: string;
  logIn: string;
  checking: string;
  resend: string;
  /** "Send a new code in {time}": the browser fills in {time} as it counts down. */
  resendIn: string;
  resendReady: string;
  /** "Try again in {time}.": the browser fills in {time} as it counts down. */
  waitFor: string;
  changeNumber: string;
  /** What a failed call says (errors.connection): no network, or the server broke. */
  connection: string;
};

type LoginFormProps = {
  action: LoginAction;
  labels: LoginFormLabels;
};

/**
 * What the form keeps between answers: the server's latest answer, plus the
 * code typed before a call that failed. The server never needs that code
 * back, so it's taken off again before each call.
 */
type FormState = LoginState & { codeTyped?: string };

/**
 * Wraps the Server Action into the function useActionState runs on each
 * submit, for the two things the server can't do:
 *
 * - **A call that fails** (no network, or an unexpected server error) arrives
 *   here as a rejected promise. It becomes the `connection` message, and the
 *   form keeps what was typed and stays on its step.
 * - **A correct code** makes the action redirect to /account. The browser
 *   receives that redirect as a rejected promise too, so unstable_rethrow()
 *   must come first: it throws Next.js's own signals (redirects, 404s) on to
 *   Next.js. Catching it here would turn every successful login into a
 *   "couldn't reach the server" message.
 *
 * It also keeps the "We sent a code to..." line on the code step: the server
 * sends that text only when the step opens.
 */
export function loginSubmitter(action: LoginAction, connectionText: string) {
  return async function submit(previous: FormState, formData: FormData): Promise<FormState> {
    const answer = withoutTypedCode(previous);
    let next: LoginState;
    try {
      next = await action(answer, formData);
    } catch (error) {
      unstable_rethrow(error);
      return {
        ...answer,
        ...typedIn(formData),
        // The step the visitor was on when they pressed the button. After
        // "Change number" the last answer is still the code step, but a
        // failed Send code must show the phone step with the new number.
        step: formData.get("intent") === "send" ? "phone" : answer.step,
        retryAt: undefined,
        error: { field: "form", text: connectionText },
      };
    }
    if (next.step === "code" && next.status === undefined && answer.step === "code") {
      return { ...next, status: answer.status };
    }
    return next;
  };
}

function withoutTypedCode(state: FormState): LoginState {
  const answer = { ...state };
  delete answer.codeTyped;
  return answer;
}

/** What the visitor typed in the step they just sent, so a failed call loses none of it. */
function typedIn(formData: FormData): Partial<FormState> {
  const text = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : "";
  };
  switch (formData.get("intent")) {
    case "send":
      return {
        phoneTyped: text("phone"),
        ageConfirmed: formData.get("age") === "on",
        contactConsent: formData.get("consent") === "on",
      };
    case "verify":
      return { codeTyped: text("code") };
    default:
      return {};
  }
}

/**
 * Seconds as a countdown: 27 -> "0:27", 65 -> "1:05", and with hours once
 * the wait is an hour or more (a day limit): 3725 -> "1:02:05".
 */
export function formatCountdown(seconds: number): string {
  const two = (value: number) => String(value).padStart(2, "0");
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}:${two(minutes)}:${two(seconds % 60)}` : `${minutes}:${two(seconds % 60)}`;
}

/** A message template ("Try again in {time}.") with the countdown filled in. */
function withTime(template: string, seconds: number): string {
  return template.replace("{time}", formatCountdown(seconds));
}

/**
 * The login form. `action` is the locale-bound loginStep; `labels` are its words.
 */
export function LoginForm({ action, labels }: LoginFormProps) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(
    loginSubmitter(action, labels.connection),
    initialLoginState,
  );

  // "Change number" goes back to the phone step in the browser alone, with
  // the number and the ticks kept. It remembers which answer it left, so the
  // next answer from the server shows as usual.
  const [leftAnswer, setLeftAnswer] = useState<FormState | null>(null);
  const changingNumber = leftAnswer === state;
  const step = changingNumber ? "phone" : state.step;
  const error = changingNumber ? undefined : state.error;
  const retryAt = changingNumber ? undefined : state.retryAt;

  const phoneInput = useRef<HTMLInputElement>(null);
  const ageBox = useRef<HTMLInputElement>(null);
  const consentBox = useRef<HTMLInputElement>(null);
  const codeInput = useRef<HTMLInputElement>(null);

  // After every answer, and after "Change number", the cursor goes where the
  // visitor goes next: the code field (also after a wrong code, which React
  // has just cleared), the first unticked box, or the number. Not when the
  // page opens: on a phone that would pop the keyboard over the page.
  useEffect(() => {
    if (state === initialLoginState) return;
    if (step === "code") codeInput.current?.focus();
    else if (error?.field === "consent") (state.ageConfirmed ? consentBox : ageBox).current?.focus();
    else phoneInput.current?.focus();
  }, [state, step, error]);

  return (
    <div className="flex flex-col gap-6">
      {/* Says where the code went when the code step opens. A live region
          must already be on the page when its text changes, or screen
          readers miss it, so this paragraph is always here. While it's
          empty, sr-only takes it out of the layout (no extra gap) without
          hiding it from screen readers. */}
      <p role="status" className="type-body empty:sr-only">
        {step === "code" ? state.status : null}
      </p>
      {step === "phone" ? (
        <PhoneStep
          state={state}
          error={error}
          retryAt={retryAt}
          labels={labels}
          formAction={formAction}
          phoneInputRef={phoneInput}
          ageBoxRef={ageBox}
          consentBoxRef={consentBox}
        />
      ) : (
        <CodeStep
          state={state}
          error={error}
          retryAt={retryAt}
          labels={labels}
          formAction={formAction}
          codeInputRef={codeInput}
          busy={isPending}
          onChangeNumber={() => setLeftAnswer(state)}
        />
      )}
    </div>
  );
}

type StepProps = {
  state: FormState;
  error: LoginState["error"];
  retryAt: string | undefined;
  labels: LoginFormLabels;
  formAction: (formData: FormData) => void;
};

/** "a b" from the ids that are set: the value of an aria-describedby. */
function ids(...list: (string | false | undefined)[]): string | undefined {
  return list.filter(Boolean).join(" ") || undefined;
}

/**
 * The number, the two boxes and "Send code".
 *
 * Fields are uncontrolled (defaultValue, defaultChecked). After each answer
 * React resets the form to those defaults, and the defaults are what the
 * server sent back as typed, so an error never empties the form. They also
 * work before JavaScript has loaded: React replays a form sent that early.
 */
function PhoneStep({
  state,
  error,
  retryAt,
  labels,
  formAction,
  phoneInputRef,
  ageBoxRef,
  consentBoxRef,
}: StepProps & {
  phoneInputRef: RefObject<HTMLInputElement | null>;
  ageBoxRef: RefObject<HTMLInputElement | null>;
  consentBoxRef: RefObject<HTMLInputElement | null>;
}) {
  const id = useId();
  const phoneError = error?.field === "phone" ? error.text : undefined;
  const consentError = error?.field === "consent" ? error.text : undefined;
  // Only the box that wasn't ticked is marked invalid.
  const ageInvalid = consentError !== undefined && !state.ageConfirmed;
  const consentInvalid = consentError !== undefined && !state.contactConsent;

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <Field data-invalid={phoneError ? true : undefined}>
        <FieldLabel htmlFor={`${id}-phone`}>{labels.phoneLabel}</FieldLabel>
        {/* +91 stays outside the input: people type only their 10 digits.
            Screen readers hear it with the hint (aria-describedby). */}
        <div className="flex gap-2">
          <span
            id={`${id}-prefix`}
            className="flex h-11 shrink-0 items-center rounded-lg bg-muted px-3 type-body"
          >
            {labels.countryCode}
          </span>
          <Input
            ref={phoneInputRef}
            id={`${id}-phone`}
            name="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            required
            defaultValue={state.phoneTyped}
            aria-invalid={phoneError ? true : undefined}
            aria-describedby={ids(`${id}-prefix`, `${id}-hint`, phoneError && `${id}-phone-error`)}
          />
        </div>
        <FieldDescription id={`${id}-hint`}>{labels.phoneHint}</FieldDescription>
        {phoneError && <FieldError id={`${id}-phone-error`}>{phoneError}</FieldError>}
      </Field>

      {/* Both boxes, for every visitor at every login: showing them only to
          new numbers would tell anyone which numbers have an account. */}
      <div className="flex flex-col">
        <CheckboxField
          ref={ageBoxRef}
          name="age"
          label={labels.ageLabel}
          required
          defaultChecked={state.ageConfirmed}
          aria-invalid={ageInvalid || undefined}
          aria-describedby={ids(ageInvalid && `${id}-consent-error`)}
        />
        <CheckboxField
          ref={consentBoxRef}
          name="consent"
          label={labels.consentLabel}
          required
          defaultChecked={state.contactConsent}
          aria-invalid={consentInvalid || undefined}
          aria-describedby={ids(`${id}-notice`, consentInvalid && `${id}-consent-error`)}
        />
        {/* The privacy notice sits under the box that agrees to it, lined up
            with the labels' text (pl-8: the box plus the gap). */}
        <p id={`${id}-notice`} className="pl-8 type-callout text-pretty text-muted-foreground">
          {labels.notice}
        </p>
        {consentError && (
          <FieldError id={`${id}-consent-error`} className="pt-2 pl-8">
            {consentError}
          </FieldError>
        )}
      </div>

      <StepProblem error={error} retryAt={retryAt} labels={labels} />
      <SubmitButton intent="send" pendingLabel={labels.sending}>
        {labels.sendCode}
      </SubmitButton>
    </form>
  );
}

/** The code field, "Log in", "Send a new code" and "Change number". */
function CodeStep({
  state,
  error,
  retryAt,
  labels,
  formAction,
  codeInputRef,
  busy,
  onChangeNumber,
}: StepProps & {
  codeInputRef: RefObject<HTMLInputElement | null>;
  busy: boolean;
  onChangeNumber: () => void;
}) {
  const id = useId();
  const codeError = error?.field === "code" ? error.text : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {/* Which login attempt this code belongs to; the server checks it. */}
      <input type="hidden" name="attemptId" value={state.attemptId ?? ""} />
      <Field data-invalid={codeError ? true : undefined}>
        <FieldLabel htmlFor={`${id}-code`}>{labels.codeLabel}</FieldLabel>
        {/* type="text", not "number": a pasted "123 456" must survive, and no
            maxLength for the same reason (the server removes the space).
            one-time-code lets iPhones offer the code from the SMS. */}
        <Input
          ref={codeInputRef}
          id={`${id}-code`}
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          defaultValue={state.codeTyped}
          aria-invalid={codeError ? true : undefined}
          aria-describedby={ids(codeError && `${id}-code-error`)}
        />
        {codeError && <FieldError id={`${id}-code-error`}>{codeError}</FieldError>}
      </Field>

      <StepProblem error={error} retryAt={retryAt} labels={labels} />
      <div className="flex flex-col gap-3">
        {/* First in the form, so pressing Enter in the code field logs in. */}
        <SubmitButton intent="verify" pendingLabel={labels.checking}>
          {labels.logIn}
        </SubmitButton>
        <ResendButton resendAt={state.resendAt} labels={labels} />
        <Button type="button" variant="ghost" className="w-full" disabled={busy} onClick={onChangeNumber}>
          {labels.changeNumber}
        </Button>
      </div>
    </form>
  );
}

/**
 * A problem with the whole step (wait a moment, too many codes, no
 * connection), and how long to wait, if the server said.
 */
function StepProblem({ error, retryAt, labels }: Pick<StepProps, "error" | "retryAt" | "labels">) {
  if (error?.field !== "form") return null;
  return (
    <div className="flex flex-col gap-1">
      <FieldError>{error.text}</FieldError>
      {retryAt && <WaitCountdown until={retryAt} template={labels.waitFor} />}
    </div>
  );
}

/**
 * "Try again in 0:12." Not a live region: a screen reader would read it out
 * every second. It goes away when the wait is over.
 */
function WaitCountdown({ until, template }: { until: string; template: string }) {
  const secondsLeft = useSecondsUntil(until);
  if (!secondsLeft) return null;
  return <p className="type-callout text-muted-foreground tabular-nums">{withTime(template, secondsLeft)}</p>;
}

/**
 * "Send a new code": disabled, counting down ("Send a new code in 0:27"),
 * until the server's resendAt. The countdown isn't announced; a separate,
 * hidden live region says once that a new code can be asked for.
 */
function ResendButton({ resendAt, labels }: { resendAt: string | undefined; labels: LoginFormLabels }) {
  const secondsLeft = useSecondsUntil(resendAt) ?? 0;
  const ready = secondsLeft === 0;
  return (
    <>
      <SubmitButton
        intent="resend"
        pendingLabel={labels.sending}
        variant="secondary"
        className="tabular-nums"
        disabled={!ready}
        // The code field is required for "Log in", not for asking for a new code.
        formNoValidate
      >
        {ready ? labels.resend : withTime(labels.resendIn, secondsLeft)}
      </SubmitButton>
      <p aria-live="polite" className="sr-only">
        {ready ? labels.resendReady : null}
      </p>
    </>
  );
}

/**
 * A submit button that sends `intent` (which step the server runs), and
 * shows a spinner and `pendingLabel` while its own step is being sent.
 * Every submit button in the form is disabled meanwhile, so nothing is sent
 * twice. useFormStatus reads the form it sits in: pending, and what was sent.
 */
function SubmitButton({
  intent,
  pendingLabel,
  children,
  disabled,
  className,
  ...props
}: ComponentProps<typeof Button> & { intent: "send" | "verify" | "resend"; pendingLabel: string }) {
  const { pending, data } = useFormStatus();
  const sending = pending && data?.get("intent") === intent;
  return (
    <Button
      type="submit"
      name="intent"
      value={intent}
      disabled={pending || disabled}
      className={cn("w-full", className)}
      {...props}
    >
      {sending && <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />}
      {sending ? pendingLabel : children}
    </Button>
  );
}

// --- The countdown clock ----------------------------------------------------
//
// useSyncExternalStore reads a value that lives outside React (the clock),
// as OpenStatus does: React asks for the value on every tick and re-renders
// only when it changed, here once a second. Ticks come every 250 ms, so the
// number changes within a quarter of a second of the real time.

function subscribeToTicks(onTick: () => void): () => void {
  const timer = setInterval(onTick, 250);
  return () => clearInterval(timer);
}

/**
 * Whole seconds until `until` (an ISO time from the server), 0 once it has
 * passed, null without a time. Rounded up, so a button opens only once its
 * time has really come.
 */
function useSecondsUntil(until: string | undefined): number | null {
  const target = until === undefined ? Number.NaN : Date.parse(until);
  return useSyncExternalStore(
    subscribeToTicks,
    () => (Number.isNaN(target) ? null : Math.max(0, Math.ceil((target - Date.now()) / 1000))),
    // The server never draws a countdown (the code step only exists in the browser).
    () => null,
  );
}
