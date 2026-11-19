import { act, fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import type { LoginFormLabels } from "@/components/account/login-form";
import type { VehiclePickerLabels } from "@/components/site/vehicle-picker";
import { isUuid } from "@/domain/ids";
import type { Service, ServicePrice } from "@/domain/services";
import type { VehicleCatalogue } from "@/domain/vehicles";
import { renderWithIntl } from "@/i18n/test-utils";
import type { BookingSummary, ConfirmAnswer, ConfirmState, SerializedSlotDay } from "@/lib/booking-form";
import { initialLoginState } from "@/lib/login-state";
import type { MyVehicle } from "@/server/dal/customer-vehicles";
import messages from "../../../messages/en.json";

import {
  BookingWizard,
  type BookingLoginAction,
  type BookingWizardAccount,
  type BookingWizardProps,
  type ConfirmAction,
} from "./booking-wizard";

// The wizard's words are the real Booking.wizard messages, passed raw the
// way the page passes them. The actions are stand-ins (vi.fn) answering what
// each test needs, the way the real ones answer (src/server/actions/
// booking.test.ts tests that side).

const t = messages.Booking.wizard;
const v = messages.Vehicles;
const l = messages.Login;

const pickerLabels: VehiclePickerLabels = {
  kindLegend: v.picker.kindLegend,
  kinds: { car: v.kinds.car, "two-wheeler": v.kinds.twoWheeler },
  makeLabel: v.picker.makeLabel,
  makePlaceholder: v.picker.makePlaceholder,
  makeGroups: { car: v.picker.makeGroups.car, "two-wheeler": v.picker.makeGroups.twoWheeler },
  modelLabel: v.picker.modelLabel,
  modelPlaceholder: v.picker.modelPlaceholder,
  modelGroup: v.picker.modelGroup,
  fuelLegend: v.picker.fuelLegend,
  fuels: { petrol: v.fuels.petrol, diesel: v.fuels.diesel, cng: v.fuels.cng, electric: v.fuels.electric },
  announceSet: v.picker.announceSet,
  announceCleared: v.picker.announceCleared,
};

const loginLabels: LoginFormLabels = {
  phoneLabel: l.phoneLabel,
  countryCode: l.countryCode,
  phoneHint: l.phoneHint,
  ageLabel: l.ageLabel,
  consentLabel: l.consentLabel.replace("{brand}", messages.Brand.name),
  notice: l.notice.replace(/<\/?privacy>/g, ""),
  sendCode: l.sendCode,
  sending: l.sending,
  codeLabel: l.codeLabel,
  logIn: l.logIn,
  checking: l.checking,
  resend: l.resend,
  resendIn: l.resendIn,
  resendReady: l.resendReady,
  waitFor: l.waitFor,
  changeNumber: l.changeNumber,
  connection: l.errors.connection,
};

const text = (en: string) => ({ en });

const catalogue: VehicleCatalogue = {
  categories: [
    { id: "sedan", kind: "car", name: text("Sedan") },
    { id: "scooter", kind: "two-wheeler", name: text("Scooter") },
  ],
  makes: [
    {
      id: "car-honda",
      kind: "car",
      name: text("Honda"),
      models: [{ id: "car-honda-city", name: text("City"), categoryId: "sedan", fuels: ["petrol", "diesel"] }],
    },
    {
      id: "two-wheeler-honda",
      kind: "two-wheeler",
      name: text("Honda"),
      models: [{ id: "two-wheeler-honda-activa", name: text("Activa"), categoryId: "scooter", fuels: ["petrol"] }],
    },
  ],
};

function service(id: string, name: string, extra: Partial<Service> = {}): Service {
  return {
    id,
    kind: "service",
    name: text(name),
    summary: text(name),
    vehicleKinds: ["car", "two-wheeler"],
    fuels: ["petrol", "diesel"],
    included: [text("Checks")],
    signs: [],
    pricedAfterInspection: false,
    ...extra,
  };
}

const services: Service[] = [
  service("car-basic", "Car basic", { kind: "package", vehicleKinds: ["car"] }),
  service("periodic-service", "Periodic service"),
  service("ac-service", "AC service", { vehicleKinds: ["car"] }),
  service("denting", "Denting", { vehicleKinds: ["car"], pricedAfterInspection: true }),
];

/** 10:00 am and 11:00 am India time on 24 Nov; 10:00 am on 25 Nov; Monday 23 Nov is closed. */
const slots: SerializedSlotDay[] = [
  { date: "2026-11-23", weekday: "monday", status: "closed-weekday" },
  {
    date: "2026-11-24",
    weekday: "tuesday",
    status: "open",
    slots: [
      { startsAt: "2026-11-24T04:30:00.000Z", endsAt: "2026-11-24T05:30:00.000Z", remaining: 2 },
      { startsAt: "2026-11-24T05:30:00.000Z", endsAt: "2026-11-24T06:30:00.000Z", remaining: 0 },
    ],
  },
  {
    date: "2026-11-25",
    weekday: "wednesday",
    status: "open",
    slots: [{ startsAt: "2026-11-25T04:30:00.000Z", endsAt: "2026-11-25T05:30:00.000Z", remaining: 1 }],
  },
];

const savedCity: MyVehicle = {
  id: "0b6f3f1e-7d8a-4c55-9f1e-2a8c4e9b6d10",
  kind: "car",
  modelId: "car-honda-city",
  makeName: text("Honda"),
  modelName: text("City"),
  fuel: "petrol",
  registrationNumber: "MH12AB0042",
  pucExpiresOn: null,
  insuranceExpiresOn: null,
};

const loggedIn: BookingWizardAccount = { phoneDisplay: "+91 98765 43210", vehicles: [savedCity], needsName: false };

/** What confirm answers, as the state the action returns. */
function answered(answer: ConfirmAnswer, account = { vehicles: [savedCity], needsName: false }): ConfirmState {
  return { submission: 1, answer, account, nameTyped: "" };
}

function renderWizard(props: Partial<BookingWizardProps> = {}) {
  const loginAction = vi.fn<BookingLoginAction>();
  const confirmAction = vi.fn<ConfirmAction>();
  const notMeAction = vi.fn(async () => initialLoginState);
  renderWithIntl(
    <BookingWizard
      loginAction={loginAction}
      confirmAction={confirmAction}
      notMeAction={notMeAction}
      catalogue={catalogue}
      services={services}
      prices={[]}
      slots={slots}
      account={null}
      labels={t}
      loginLabels={loginLabels}
      pickerLabels={pickerLabels}
      contactLinks={
        <p>
          <a href="tel:+919876500000">Call</a> <a href="https://wa.me/919876500000">WhatsApp</a>
        </p>
      }
      {...props}
    />,
  );
  return { loginAction, confirmAction, notMeAction };
}

const heading = () => screen.getByRole("heading", { level: 2 });
const isChecked = (element: HTMLElement) => (element as HTMLInputElement).checked;
const isDisabled = (element: HTMLElement) => (element as HTMLInputElement | HTMLButtonElement).disabled;
const press = (name: string) => fireEvent.click(screen.getByRole("button", { name }));
const tick = (name: string) => fireEvent.click(screen.getByRole("checkbox", { name: new RegExp(`^${name}`) }));
const registrationField = () => screen.getByLabelText(t.registrationLabel) as HTMLInputElement;

/** Step 1 for a visitor: a model, a fuel and a number. */
function typeVehicle(modelId = "car-honda-city", registration = "MH 12 AB 1234") {
  fireEvent.change(screen.getByLabelText(pickerLabels.modelLabel), { target: { value: modelId } });
  fireEvent.click(screen.getByRole("radio", { name: v.fuels.petrol }));
  fireEvent.change(registrationField(), { target: { value: registration } });
}

/** From step 2 to the end of step 3: a service, then 10:00 am on the first open day. */
function chooseServiceAndTime(name = "Periodic service") {
  tick(name);
  press(t.continue);
  fireEvent.click(screen.getByRole("radio", { name: "10:00 am" }));
  press(t.continue);
}

/** Presses a submit button and waits for its action's answer to show. */
async function submit(name: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
}

/** The phone step, filled in and sent. */
async function sendPhone() {
  fireEvent.change(screen.getByLabelText(l.phoneLabel), { target: { value: "91234 56789" } });
  fireEvent.click(screen.getByRole("checkbox", { name: loginLabels.ageLabel }));
  fireEvent.click(screen.getByRole("checkbox", { name: loginLabels.consentLabel }));
  await submit(l.sendCode);
}

/** A logged-in customer with a saved City, up to the confirm screen. */
function toConfirm(props: Partial<BookingWizardProps> = {}) {
  const actions = renderWizard({ account: loggedIn, ...props });
  press(t.continue);
  chooseServiceAndTime();
  expect(heading().textContent).toContain(t.steps.confirm);
  return actions;
}

describe("BookingWizard: step 1, the vehicle", () => {
  test("a visitor gets the picker and the registration field, and Continue waits for both with its reason", () => {
    renderWizard();
    expect(heading().textContent).toContain(t.steps.vehicle);
    expect(screen.getByText("Step 1 of 4")).toBeTruthy();
    expect(screen.getByLabelText(pickerLabels.modelLabel)).toBeTruthy();
    const next = screen.getByRole("button", { name: t.continue });
    expect(isDisabled(next)).toBe(true);
    expect(document.getElementById(next.getAttribute("aria-describedby") ?? "")?.textContent).toBe(t.vehicleReason);
    typeVehicle();
    expect(isDisabled(next)).toBe(false);
  });

  test("a logged-in customer sees their saved vehicles first, then another vehicle", () => {
    renderWizard({ account: loggedIn });
    const radios = within(screen.getByRole("group", { name: t.savedLegend })).getAllByRole("radio");
    expect(radios.map((radio) => radio.closest("label")?.textContent)).toEqual([
      "Honda City, MH 12 AB 0042",
      t.anotherVehicle,
    ]);
    expect(isChecked(radios[0])).toBe(true);
    expect(screen.queryByLabelText(t.registrationLabel)).toBeNull();
    fireEvent.click(radios[1]);
    expect(registrationField()).toBeTruthy();
  });
});

describe("BookingWizard: step 2, services and prices", () => {
  test("a car gets car services and packages; switching to a two-wheeler drops car-only choices and says so", () => {
    renderWizard();
    typeVehicle();
    press(t.continue);
    expect(screen.getByText("Step 2 of 4")).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: /^Car basic/ })).toBeTruthy();
    tick("AC service");
    tick("Periodic service");

    press(t.back);
    // Half-way (a type, no model yet) nothing is dropped; the model decides.
    fireEvent.click(screen.getByRole("radio", { name: v.kinds.twoWheeler }));
    fireEvent.change(screen.getByLabelText(pickerLabels.modelLabel), {
      target: { value: "two-wheeler-honda-activa" },
    });
    expect(screen.getByText("Removed, as it isn't offered for this vehicle: AC service.").getAttribute("role")).toBe("status");
    press(t.continue);
    expect(screen.queryByRole("checkbox", { name: /^AC service/ })).toBeNull();
    expect(screen.queryByRole("checkbox", { name: /^Car basic/ })).toBeNull();
    expect(isChecked(screen.getByRole("checkbox", { name: /^Periodic service/ }))).toBe(true);
  });

  test("a package then a service: the package is unchosen, and the note says so", () => {
    renderWizard({ account: loggedIn });
    press(t.continue);
    tick("Car basic");
    tick("AC service");
    expect(isChecked(screen.getByRole("checkbox", { name: /^Car basic/ }))).toBe(false);
    expect(isChecked(screen.getByRole("checkbox", { name: /^AC service/ }))).toBe(true);
    expect(screen.getByText("Car basic removed: a booking has a package or services, not both.")).toBeTruthy();
  });

  test("with no prices, each line and the total say the price is confirmed at the garage", () => {
    renderWizard({ account: loggedIn });
    press(t.continue);
    tick("AC service");
    // The line's price, and the total under the list: no amount anywhere.
    expect(screen.getAllByText(t.noPrice).length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText(/₹/)).toBeNull();
  });

  test("with one priced line, the total is an estimate with the rest confirmed at the garage", () => {
    const prices: ServicePrice[] = [{ serviceId: "periodic-service", categoryId: "sedan", fuel: null, pricePaise: 249_900 }];
    renderWizard({ account: loggedIn, prices });
    press(t.continue);
    expect(screen.getByRole("checkbox", { name: /^Periodic service/ }).closest("label")?.textContent).toContain("₹2,499");
    tick("Periodic service");
    expect(screen.getByText("Total: ₹2,499")).toBeTruthy();
    tick("Denting");
    expect(screen.getByText("Estimate: ₹2,499, the rest confirmed at the garage")).toBeTruthy();
  });
});

describe("BookingWizard: step 3, the time", () => {
  test("a closed day is disabled and marked Closed; a full slot isn't offered", () => {
    renderWizard({ account: loggedIn });
    press(t.continue);
    tick("Periodic service");
    press(t.continue);
    const monday = screen.getByRole("radio", { name: /Mon, 23 Nov/ });
    expect(isDisabled(monday)).toBe(true);
    expect(monday.closest("label")?.textContent).toContain(t.closed);
    expect(isChecked(screen.getByRole("radio", { name: /Tue, 24 Nov/ }))).toBe(true);
    expect(screen.getByRole("radio", { name: "10:00 am" })).toBeTruthy();
    expect(screen.queryByRole("radio", { name: "11:00 am" })).toBeNull();
  });

  test("with every slot full, the step shows Call and WhatsApp and no Continue", () => {
    const full = slots.map((day) =>
      day.status === "open" ? { ...day, slots: day.slots.map((slot) => ({ ...slot, remaining: 0 })) } : day,
    );
    renderWizard({ account: loggedIn, slots: full });
    press(t.continue);
    tick("Periodic service");
    press(t.continue);
    expect(screen.getByText(t.noSlots)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Call" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "WhatsApp" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: t.continue })).toBeNull();
  });
});

describe("BookingWizard: logging in and confirming", () => {
  test("a visitor logs in at step 4; after verified every choice is still there and the confirm screen shows", async () => {
    const { loginAction } = renderWizard();
    typeVehicle();
    press(t.continue);
    chooseServiceAndTime();
    expect(heading().textContent).toContain(t.steps.login);
    expect(screen.getByText("Step 4 of 4")).toBeTruthy();
    loginAction.mockResolvedValueOnce({ step: "verified", phoneDisplay: "+91 91234 56789" });
    await sendPhone();

    expect(heading().textContent).toContain(t.steps.confirm);
    expect(document.activeElement).toBe(heading());
    expect(screen.getByText("Booking as +91 91234 56789")).toBeTruthy();
    expect(screen.getByText("Honda City, MH 12 AB 1234")).toBeTruthy();
    expect(screen.getByText("Periodic service")).toBeTruthy();
    expect(screen.getByText("Tue, 24 Nov at 10:00 am")).toBeTruthy();
  });

  test("confirm posts the choices and a uuid token, and nothing the server works out itself", async () => {
    const { confirmAction } = toConfirm();
    confirmAction.mockResolvedValueOnce(answered({ kind: "needs-name", step: "confirm", errors: {} }));
    await submit(t.confirm);
    const posted = confirmAction.mock.calls[0][1];
    expect(posted.get("savedVehicleId")).toBe(savedCity.id);
    expect(posted.getAll("service")).toEqual(["periodic-service"]);
    expect(posted.get("startsAt")).toBe("2026-11-24T04:30:00.000Z");
    expect(isUuid(String(posted.get("requestToken")))).toBe(true);
    expect(posted.has("price")).toBe(false);
  });

  test("needs-name shows the name field on the confirm screen and keeps the summary", async () => {
    const { confirmAction } = toConfirm();
    confirmAction.mockResolvedValueOnce(
      answered(
        { kind: "needs-name", step: "confirm", errors: { name: messages.Booking.errors.needsName } },
        { vehicles: [savedCity], needsName: true },
      ),
    );
    await submit(t.confirm);
    expect(screen.getByLabelText(t.nameLabel).getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText(messages.Booking.errors.needsName)).toBeTruthy();
    expect(screen.getByText("Periodic service")).toBeTruthy();
  });

  test("full goes back to the slot step with the message and fresh slots; the vehicle and services stay chosen", async () => {
    const { confirmAction } = toConfirm();
    const fresh = slots.map((day) =>
      day.date === "2026-11-24" && day.status === "open"
        ? { ...day, slots: day.slots.map((slot) => ({ ...slot, remaining: 0 })) }
        : day,
    );
    const message = messages.Booking.errors.slot.full;
    confirmAction.mockResolvedValueOnce(
      answered({ kind: "slot-problem", step: "slot", problem: "full", errors: { slot: message }, slots: fresh }),
    );
    await submit(t.confirm);
    expect(heading().textContent).toContain(t.steps.slot);
    expect(screen.getByText(message)).toBeTruthy();
    // 24 Nov is full now: the first day with a free time is 25 Nov.
    expect(isDisabled(screen.getByRole("radio", { name: /Tue, 24 Nov/ }))).toBe(true);
    expect(isChecked(screen.getByRole("radio", { name: /Wed, 25 Nov/ }))).toBe(true);
    expect(isDisabled(screen.getByRole("button", { name: t.continue }))).toBe(true);
    press(t.back);
    expect(isChecked(screen.getByRole("checkbox", { name: /^Periodic service/ }))).toBe(true);
    press(t.back);
    expect(isChecked(screen.getByRole("radio", { name: "Honda City, MH 12 AB 0042" }))).toBe(true);
  });

  test("registration-duplicate goes back to step 1, which now lists the saved vehicle named in the message", async () => {
    const { loginAction, confirmAction } = renderWizard();
    typeVehicle("car-honda-city", "MH 12 AB 42");
    press(t.continue);
    chooseServiceAndTime();
    loginAction.mockResolvedValueOnce({ step: "verified", phoneDisplay: "+91 98765 43210" });
    await sendPhone();
    const message = "You've already saved MH 12 AB 0042 as a Honda City. Choose it from your vehicles, or check the number.";
    confirmAction.mockResolvedValueOnce(
      answered({
        kind: "registration-duplicate",
        step: "vehicle",
        savedVehicleId: savedCity.id,
        errors: { registration: message },
      }),
    );
    await submit(t.confirm);
    expect(heading().textContent).toContain(t.steps.vehicle);
    expect(screen.getByRole("radio", { name: "Honda City, MH 12 AB 0042" })).toBeTruthy();
    expect(screen.getByText(message)).toBeTruthy();
    expect(registrationField().getAttribute("aria-invalid")).toBe("true");
  });

  test('"Not you?" keeps the model and services, asks for the number again, and forgets the first customer', async () => {
    const { notMeAction, loginAction } = toConfirm();
    await submit(t.notMe);
    expect(notMeAction).toHaveBeenCalledOnce();
    expect(heading().textContent).toContain(t.steps.login);
    expect((screen.getByLabelText(l.phoneLabel) as HTMLInputElement).value).toBe("");

    loginAction.mockResolvedValueOnce({ step: "verified", phoneDisplay: "+91 91234 56789" });
    await sendPhone();
    // The number was cleared: step 1 asks for it, with the model and fuel kept.
    expect(heading().textContent).toContain(t.steps.vehicle);
    expect(screen.getByText(t.registrationAgain)).toBeTruthy();
    expect((screen.getByLabelText(pickerLabels.modelLabel) as HTMLInputElement).value).toBe("car-honda-city");
    expect(isChecked(screen.getByRole("radio", { name: v.fuels.petrol }))).toBe(true);
    expect((registrationField() as HTMLInputElement).value).toBe("");
    expect(screen.queryByText(/MH 12 AB 0042/)).toBeNull();
    expect(screen.queryByText(/98765 43210/)).toBeNull();

    fireEvent.change(registrationField(), { target: { value: "KA 01 MN 7777" } });
    press(t.continue);
    expect(isChecked(screen.getByRole("checkbox", { name: /^Periodic service/ }))).toBe(true);
  });

  test("a failed call keeps everything and shows the connection message", async () => {
    const { confirmAction } = toConfirm();
    confirmAction.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await submit(t.confirm);
    expect(heading().textContent).toContain(t.steps.confirm);
    expect(screen.getByText(t.connection)).toBeTruthy();
    expect(screen.getByText("Honda City, MH 12 AB 0042")).toBeTruthy();
    expect(screen.getByText("Periodic service")).toBeTruthy();
  });
});

describe("BookingWizard: the end", () => {
  const booking: BookingSummary = {
    code: "K7Q-4MX",
    startsAt: "2026-11-24T04:30:00.000Z",
    vehicle: { kind: "car", modelId: "car-honda-city", fuel: "petrol", categoryId: "sedan", registrationNumber: "MH12AB0042" },
    lines: [
      {
        serviceId: "periodic-service",
        kind: "service",
        name: text("Periodic service"),
        priceStatus: "no-price",
        pricePaise: null,
        position: 0,
      },
    ],
    totalPaise: null,
    isEstimate: true,
  };

  test("done shows the code with the note-it-down line, the slot, the lines, the total and Call and WhatsApp", async () => {
    const { confirmAction } = toConfirm();
    confirmAction.mockResolvedValueOnce(answered({ kind: "booked", booking }));
    await submit(t.confirm);
    expect(heading().textContent).toContain(t.doneHeading);
    expect(screen.getByText("K7Q-4MX")).toBeTruthy();
    expect(screen.getByText(t.codeNote)).toBeTruthy();
    expect(screen.getByText("Tue, 24 Nov at 10:00 am")).toBeTruthy();
    expect(screen.getByText("Honda City, MH 12 AB 0042")).toBeTruthy();
    expect(screen.getByText("Periodic service")).toBeTruthy();
    expect(screen.getAllByText(t.noTotal).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("link", { name: "Call" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "WhatsApp" })).toBeTruthy();
  });

  test("a duplicate shows its own message and the first booking's code, not a fresh booking", async () => {
    const { confirmAction } = toConfirm();
    const message = "You already booked this vehicle for this time (code K7Q-4MX).";
    confirmAction.mockResolvedValueOnce(answered({ kind: "duplicate", code: "K7Q-4MX", message }));
    await submit(t.confirm);
    expect(heading().textContent).toContain(t.duplicateHeading);
    expect(screen.getByText(message)).toBeTruthy();
    expect(screen.getByText("K7Q-4MX")).toBeTruthy();
    expect(screen.queryByText(t.doneHeading)).toBeNull();
  });
});
