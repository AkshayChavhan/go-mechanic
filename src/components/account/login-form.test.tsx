import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { initialLoginState, type LoginState } from "@/lib/login-state";
import messages from "../../../messages/en.json";

import { formatCountdown, LoginForm, loginSubmitter, type LoginAction, type LoginFormLabels } from "./login-form";

// The form's words come from the page as props: here, the real Login
// messages, filled in the way the page fills them. The Server Action is a
// stand-in (vi.fn) that answers what each test needs, the way the real one
// answers (src/server/actions/login.test.ts tests that side).

const t = messages.Login;
const labels: LoginFormLabels = {
  phoneLabel: t.phoneLabel,
  countryCode: t.countryCode,
  phoneHint: t.phoneHint,
  ageLabel: t.ageLabel,
  consentLabel: t.consentLabel.replace("{brand}", messages.Brand.name),
  notice: t.notice,
  sendCode: t.sendCode,
  sending: t.sending,
  codeLabel: t.codeLabel,
  logIn: t.logIn,
  checking: t.checking,
  resend: t.resend,
  resendIn: t.resendIn,
  resendReady: t.resendReady,
  waitFor: t.waitFor,
  changeNumber: t.changeNumber,
  connection: t.errors.connection,
};

const attemptId = "6f1c2a52-8a4c-4a35-9a43-0d8f0f5b3c11";
const now = new Date("2026-10-28T06:30:00Z");
const status = "We sent a 6-digit code to +91 98765 43210.";

/** The code step, as the action answers after sending a code. */
const codeStep: LoginState = {
  step: "code",
  phoneTyped: "98765 43210",
  ageConfirmed: true,
  contactConsent: true,
  attemptId,
  phoneDisplay: "+91 98765 43210",
  resendAt: new Date(now.getTime() + 30_000).toISOString(),
  status,
};

afterEach(() => {
  vi.useRealTimers();
});

/** Renders the form with an action that gives these answers, in order. */
function renderForm(...answers: (LoginState | Error)[]) {
  const action = vi.fn<LoginAction>();
  for (const answer of answers) {
    if (answer instanceof Error) action.mockRejectedValueOnce(answer);
    else action.mockResolvedValueOnce(answer);
  }
  render(<LoginForm action={action} labels={labels} />);
  return action;
}

const phoneField = () => screen.getByLabelText(t.phoneLabel) as HTMLInputElement;
const ageBox = () => screen.getByRole("checkbox", { name: labels.ageLabel }) as HTMLInputElement;
const consentBox = () => screen.getByRole("checkbox", { name: labels.consentLabel }) as HTMLInputElement;
const codeField = () => screen.getByLabelText(t.codeLabel) as HTMLInputElement;

/** Clicks a submit button and waits for the action's answer to show. */
async function press(name: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
}

/** Types a number, ticks both boxes (unless told not to) and presses "Send code". */
async function sendNumber(typed = "98765 43210", { tick = true } = {}) {
  fireEvent.change(phoneField(), { target: { value: typed } });
  if (tick) {
    fireEvent.click(ageBox());
    fireEvent.click(consentBox());
  }
  await press(t.sendCode);
}

/** The fields the action received in its FormData, as a plain object. */
function sentFields(action: ReturnType<typeof vi.fn<LoginAction>>, call = 0) {
  return Object.fromEntries(action.mock.calls[call][1].entries());
}

describe("LoginForm: the phone step", () => {
  test("a visible +91 outside the field, a phone keypad, the two boxes, the notice and Send code", () => {
    renderForm();
    expect(screen.getByText(t.countryCode)).toBeTruthy();
    const phone = phoneField();
    expect(phone.value).toBe("");
    expect(phone.getAttribute("type")).toBe("tel");
    expect(phone.getAttribute("inputmode")).toBe("numeric");
    expect(phone.getAttribute("autocomplete")).toBe("tel-national");
    expect(phone.getAttribute("name")).toBe("phone");
    // Screen readers hear "+91" and the hint with the field.
    const described = phone.getAttribute("aria-describedby")!.split(" ").map((id) => document.getElementById(id)?.textContent);
    expect(described).toEqual([t.countryCode, t.phoneHint]);

    for (const box of [ageBox(), consentBox()]) {
      expect(box.required).toBe(true);
      expect(box.checked).toBe(false);
    }
    expect(screen.getByText(t.notice)).toBeTruthy();
    expect(screen.getByRole("button", { name: t.sendCode }).getAttribute("type")).toBe("submit");
    // Nothing takes the focus when the page opens (that would pop a phone's keyboard).
    expect(document.activeElement).toBe(document.body);
  });

  test("Send code posts intent=send, the number and both ticks", async () => {
    const action = renderForm(codeStep);
    await sendNumber();
    expect(action).toHaveBeenCalledTimes(1);
    expect(action.mock.calls[0][0]).toEqual(initialLoginState);
    expect(sentFields(action)).toEqual({ intent: "send", phone: "98765 43210", age: "on", consent: "on" });
  });

  test("a wrong number: the error is tied to the field, and what was typed stays", async () => {
    renderForm({
      ...initialLoginState,
      phoneTyped: "58765 43210",
      ageConfirmed: true,
      contactConsent: true,
      error: { field: "phone", text: t.errors.invalidPhone },
    });
    await sendNumber("58765 43210");

    const phone = phoneField();
    const error = screen.getByText(t.errors.invalidPhone);
    expect(phone.getAttribute("aria-invalid")).toBe("true");
    expect(phone.getAttribute("aria-describedby")!.split(" ")).toContain(error.id);
    expect(error.getAttribute("role")).toBe("alert");
    expect(phone.value).toBe("58765 43210");
    expect(ageBox().checked).toBe(true);
    expect(consentBox().checked).toBe(true);
    expect(document.activeElement).toBe(phone);
  });

  test("a box left unticked: only that box is marked, and the cursor goes to it", async () => {
    renderForm({
      ...initialLoginState,
      phoneTyped: "98765 43210",
      ageConfirmed: true,
      contactConsent: false,
      error: { field: "consent", text: t.errors.consentMissing },
    });
    // The boxes are required, so the browser would stop an unticked form
    // before it's sent. Ticking only one shows the server's own check here.
    fireEvent.change(phoneField(), { target: { value: "98765 43210" } });
    fireEvent.click(ageBox());
    consentBox().required = false;
    await press(t.sendCode);

    const error = screen.getByText(t.errors.consentMissing);
    expect(consentBox().getAttribute("aria-invalid")).toBe("true");
    expect(consentBox().getAttribute("aria-describedby")!.split(" ")).toContain(error.id);
    expect(ageBox().hasAttribute("aria-invalid")).toBe(false);
    expect(document.activeElement).toBe(consentBox());
  });

  test("the notice describes the consent box", () => {
    renderForm();
    const ids = consentBox().getAttribute("aria-describedby")!.split(" ");
    expect(ids.map((id) => document.getElementById(id)?.textContent)).toEqual([t.notice]);
  });

  test("a call that fails: the connection message, and the number and ticks stay", async () => {
    renderForm(new TypeError("Failed to fetch"));
    await sendNumber("98765 43210");

    expect(screen.getByText(t.errors.connection).getAttribute("role")).toBe("alert");
    expect(phoneField().value).toBe("98765 43210");
    expect(ageBox().checked).toBe(true);
    expect(consentBox().checked).toBe(true);
    // Still the phone step.
    expect(screen.queryByLabelText(t.codeLabel)).toBeNull();
  });

  test("too soon: the wait counts down, and goes once it's over", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
    renderForm({
      ...initialLoginState,
      phoneTyped: "98765 43210",
      ageConfirmed: true,
      contactConsent: true,
      retryAt: new Date(now.getTime() + 12_000).toISOString(),
      error: { field: "form", text: t.errors.tooSoon },
    });
    await sendNumber();

    expect(screen.getByText(t.errors.tooSoon)).toBeTruthy();
    expect(screen.getByText("Try again in 0:12.")).toBeTruthy();
    vi.setSystemTime(now.getTime() + 12_001);
    // The clock ticks every 250 ms (a real timer: only Date is faked).
    await act(() => new Promise((resolve) => setTimeout(resolve, 300)));
    expect(screen.queryByText(/Try again in/)).toBeNull();
  });
});

describe("LoginForm: the code step", () => {
  test("says where the code went, in a live region, and puts the cursor in the code field", async () => {
    renderForm(codeStep);
    await sendNumber();

    expect(screen.getByRole("status").textContent).toBe(status);
    const code = codeField();
    expect(document.activeElement).toBe(code);
    expect(code.getAttribute("type")).toBe("text");
    expect(code.getAttribute("inputmode")).toBe("numeric");
    expect(code.getAttribute("autocomplete")).toBe("one-time-code");
    expect(code.getAttribute("name")).toBe("code");
    // No maxLength: a pasted "123 456" (7 characters) must survive.
    expect(code.hasAttribute("maxlength")).toBe(false);
    fireEvent.change(code, { target: { value: "123 456" } });
    expect(code.value).toBe("123 456");
  });

  test("the live region is on the page before the code step opens (or screen readers miss it)", () => {
    renderForm();
    const region = screen.getByRole("status");
    expect(region.textContent).toBe("");
  });

  test("Log in posts intent=verify, the code and the login attempt", async () => {
    const action = renderForm(codeStep, { ...codeStep, status: undefined, error: { field: "code", text: t.errors.wrongCode } });
    await sendNumber();
    fireEvent.change(codeField(), { target: { value: "123 456" } });
    await press(t.logIn);
    expect(sentFields(action, 1)).toEqual({ intent: "verify", code: "123 456", attemptId });
  });

  test("a wrong code: the message, the field cleared and focused again, and the number still named", async () => {
    renderForm(codeStep, { ...codeStep, status: undefined, error: { field: "code", text: t.errors.wrongCode } });
    await sendNumber();
    fireEvent.change(codeField(), { target: { value: "000000" } });
    await press(t.logIn);

    const code = codeField();
    expect(screen.getByText(t.errors.wrongCode).getAttribute("role")).toBe("alert");
    expect(code.getAttribute("aria-invalid")).toBe("true");
    expect(code.value).toBe("");
    expect(document.activeElement).toBe(code);
    // The server sends "We sent a code to..." only when the step opens; the form keeps it.
    expect(screen.getByRole("status").textContent).toBe(status);
  });

  test("Send a new code counts down to resendAt, then works, and says so once", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
    renderForm(codeStep);
    await sendNumber();

    const waiting = screen.getByRole("button", { name: "Send a new code in 0:30" }) as HTMLButtonElement;
    expect(waiting.disabled).toBe(true);
    // The countdown is not a live region (it would be read out every second).
    expect(waiting.closest("[aria-live]")).toBeNull();
    expect(screen.queryByText(t.resendReady)).toBeNull();

    vi.setSystemTime(now.getTime() + 30_000);
    await act(() => new Promise((resolve) => setTimeout(resolve, 300)));
    const resend = screen.getByRole("button", { name: t.resend }) as HTMLButtonElement;
    expect(resend.disabled).toBe(false);
    expect(resend.getAttribute("value")).toBe("resend");
    // The code field is required for Log in, not for asking for a new code.
    expect(resend.formNoValidate).toBe(true);
    expect(screen.getByText(t.resendReady).closest("[aria-live]")?.getAttribute("aria-live")).toBe("polite");
  });

  test("too many tries: Send a new code works at once", async () => {
    // The clock stands at `now`, so the code step's Resend waits 30 seconds
    // until the tooManyTries answer opens it.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
    renderForm(codeStep, {
      ...codeStep,
      status: undefined,
      resendAt: new Date(0).toISOString(),
      error: { field: "code", text: t.errors.tooManyTries },
    });
    await sendNumber();
    expect((screen.getByRole("button", { name: "Send a new code in 0:30" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(codeField(), { target: { value: "111111" } });
    await press(t.logIn);
    expect((screen.getByRole("button", { name: t.resend }) as HTMLButtonElement).disabled).toBe(false);
  });

  test("Change number: back to the phone step, with the number and the ticks kept", async () => {
    const action = renderForm(codeStep, { ...codeStep, status: "We already sent a code to +91 98765 43210. It works for 5 minutes." });
    await sendNumber();
    fireEvent.click(screen.getByRole("button", { name: t.changeNumber }));

    expect(screen.queryByLabelText(t.codeLabel)).toBeNull();
    expect(phoneField().value).toBe("98765 43210");
    expect(ageBox().checked).toBe(true);
    expect(consentBox().checked).toBe(true);
    expect(document.activeElement).toBe(phoneField());
    expect(screen.getByRole("status").textContent).toBe("");
    // No server call for going back...
    expect(action).toHaveBeenCalledTimes(1);
    // ...and sending again shows the server's next answer.
    await press(t.sendCode);
    expect(action).toHaveBeenCalledTimes(2);
    expect(codeField()).toBeTruthy();
  });

  test("Change number, then a Send code that fails: the phone step with the new number, not the old code step", async () => {
    renderForm(codeStep, new TypeError("Failed to fetch"));
    await sendNumber();
    fireEvent.click(screen.getByRole("button", { name: t.changeNumber }));
    fireEvent.change(phoneField(), { target: { value: "91234 56789" } });
    await press(t.sendCode);

    expect(screen.queryByLabelText(t.codeLabel)).toBeNull();
    expect(phoneField().value).toBe("91234 56789");
    expect(screen.getByText(t.errors.connection)).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("");
  });

  test("a call that fails: the connection message, still on the code step, the typed code kept", async () => {
    renderForm(codeStep, new TypeError("Failed to fetch"));
    await sendNumber();
    fireEvent.change(codeField(), { target: { value: "123456" } });
    await press(t.logIn);

    expect(screen.getByText(t.errors.connection)).toBeTruthy();
    expect(codeField().value).toBe("123456");
    expect(screen.getByRole("status").textContent).toBe(status);
  });
});

describe("loginSubmitter (what useActionState runs)", () => {
  const formData = (fields: Record<string, string>) => {
    const data = new FormData();
    for (const [name, value] of Object.entries(fields)) data.set(name, value);
    return data;
  };
  const send = formData({ intent: "send", phone: "98765 43210", age: "on", consent: "on" });

  test("a correct code's redirect is passed on to Next.js, not turned into an error", async () => {
    // What the browser receives when the action calls redirect(): a rejected
    // call whose digest names the redirect (next/dist/client/components/redirect-error.js).
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/account;303;" });
    const submit = loginSubmitter(vi.fn<LoginAction>().mockRejectedValue(redirect), t.errors.connection);
    await expect(submit(codeStep, formData({ intent: "verify", code: "123456", attemptId }))).rejects.toBe(redirect);
  });

  test("any other rejection becomes the connection message, with what was typed", async () => {
    const submit = loginSubmitter(vi.fn<LoginAction>().mockRejectedValue(new TypeError("Failed to fetch")), "No connection");
    expect(await submit(initialLoginState, send)).toEqual({
      ...initialLoginState,
      phoneTyped: "98765 43210",
      ageConfirmed: true,
      contactConsent: true,
      retryAt: undefined,
      error: { field: "form", text: "No connection" },
    });
  });

  test("the typed code is never sent to the server", async () => {
    const action = vi.fn<LoginAction>().mockResolvedValue(codeStep);
    await loginSubmitter(action, "No connection")({ ...codeStep, codeTyped: "123456" }, send);
    expect(action.mock.calls[0][0]).toEqual(codeStep);
    expect(action.mock.calls[0][0]).not.toHaveProperty("codeTyped");
  });

  test("an answer is passed through as the server gave it", async () => {
    const answer: LoginState = { ...initialLoginState, error: { field: "phone", text: t.errors.invalidPhone } };
    expect(await loginSubmitter(vi.fn<LoginAction>().mockResolvedValue(answer), "")(initialLoginState, send)).toBe(answer);
  });
});

test("formatCountdown: minutes and two-digit seconds, with hours from an hour on", () => {
  expect(formatCountdown(30)).toBe("0:30");
  expect(formatCountdown(5)).toBe("0:05");
  expect(formatCountdown(65)).toBe("1:05");
  expect(formatCountdown(0)).toBe("0:00");
  expect(formatCountdown(3599)).toBe("59:59");
  expect(formatCountdown(3725)).toBe("1:02:05");
  // A day limit: 21 hours to wait, not "1260:00".
  expect(formatCountdown(21 * 3600)).toBe("21:00:00");
});

test("reads no messages itself: every word comes from the labels", () => {
  // Rendered without NextIntlClientProvider: a useTranslations call would throw.
  const { container } = render(<LoginForm action={vi.fn<LoginAction>()} labels={labels} />);
  expect(within(container).getByText(labels.consentLabel)).toBeTruthy();
});
