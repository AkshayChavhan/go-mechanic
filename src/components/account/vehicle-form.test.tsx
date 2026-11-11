import { act, fireEvent, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { Activity, type ReactElement } from "react";
import { describe, expect, test, vi } from "vitest";

import type { VehiclePickerLabels } from "@/components/site/vehicle-picker";
import type { VehicleCatalogue } from "@/domain/vehicles";
import { defaultLocale, GARAGE_TIME_ZONE } from "@/i18n/config";
import { renderWithIntl } from "@/i18n/test-utils";
import { initialVehicleFormState, type VehicleFormState } from "@/lib/account-forms";
import messages from "../../../messages/en.json";

import { VehicleForm, type VehicleAction, type VehicleFormLabels, vehicleSubmitter } from "./vehicle-form";

// The form's words come from the page as props: here, the real messages. The
// Server Action is a stand-in (vi.fn) answering what each test needs
// (src/server/actions/account.test.ts tests the real one).

const t = messages.MyVehicles;
const v = messages.Vehicles;
const labels: VehicleFormLabels = {
  registrationLabel: t.registrationLabel,
  registrationHint: t.registrationHint,
  pucLabel: t.pucLabel,
  insuranceLabel: t.insuranceLabel,
  submit: t.submit,
  saving: t.saving,
  connection: messages.Login.errors.connection,
};
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
  fuels: v.fuels,
  announceSet: v.picker.announceSet,
  announceCleared: v.picker.announceCleared,
};

// A petrol-and-diesel sedan and an electric-only one.
const catalogue: VehicleCatalogue = {
  categories: [{ id: "sedan", kind: "car", name: { en: "Sedan" } }],
  makes: [
    {
      id: "car-honda",
      kind: "car",
      name: { en: "Honda" },
      models: [{ id: "car-honda-city", name: { en: "City" }, categoryId: "sedan", fuels: ["petrol", "diesel"] }],
    },
    {
      id: "car-byd",
      kind: "car",
      name: { en: "BYD" },
      models: [{ id: "car-byd-seal", name: { en: "Seal" }, categoryId: "sedan", fuels: ["electric"] }],
    },
  ],
};

const modelField = () => screen.getByRole("combobox", { name: v.picker.modelLabel }) as HTMLSelectElement;
const registrationField = () => screen.getByLabelText(t.registrationLabel) as HTMLInputElement;
const pucField = () => screen.queryByLabelText(t.pucLabel) as HTMLInputElement | null;
const insuranceField = () => screen.getByLabelText(t.insuranceLabel) as HTMLInputElement;

/** The form inside an <Activity>, as Next.js shows a page: visible, or hidden after the visitor leaves. */
function formIn(mode: "visible" | "hidden", action: VehicleAction) {
  return (
    <Activity mode={mode}>
      <VehicleForm action={action} catalogue={catalogue} labels={labels} pickerLabels={pickerLabels} />
    </Activity>
  );
}

/** The provider renderWithIntl wraps around a first render, for rerenders. */
function withIntl(ui: ReactElement) {
  return (
    <NextIntlClientProvider locale={defaultLocale} messages={messages} timeZone={GARAGE_TIME_ZONE}>
      {ui}
    </NextIntlClientProvider>
  );
}

/** Presses "Save vehicle" and waits for the answer to show. */
async function save() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: t.submit }));
  });
}

/** The answer to a post with a bad number and a date out of range. */
const withErrors: VehicleFormState = {
  submission: 1,
  values: {
    modelId: "car-honda-city",
    fuel: "diesel",
    registration: "MX12AB1234",
    pucExpiresOn: "2027-03-12",
    insuranceExpiresOn: "2040-01-01",
  },
  errors: {
    registration: t.errors["registration-unknown-state"],
    insuranceExpiresOn: t.errors["date-out-of-range"],
  },
};

describe("VehicleForm", () => {
  test("starts empty: the picker, the number with its hint, and the two dates", () => {
    renderWithIntl(formIn("visible", vi.fn<VehicleAction>()));
    expect(modelField().value).toBe("");
    expect(registrationField().value).toBe("");
    expect(registrationField().required).toBe(true);
    expect(registrationField().getAttribute("autocapitalize")).toBe("characters");
    expect(screen.getByText(t.registrationHint)).toBeTruthy();
    expect(pucField()!.type).toBe("date");
    expect(insuranceField().type).toBe("date");
    // No min or max: the page is prebuilt and can't know today.
    expect(insuranceField().hasAttribute("min")).toBe(false);
    expect(insuranceField().hasAttribute("max")).toBe(false);
  });

  test("after errors, everything posted stays and each error sits under its field, the cursor on the first", async () => {
    const action = vi.fn<VehicleAction>().mockResolvedValue(withErrors);
    renderWithIntl(formIn("visible", action));
    fireEvent.change(modelField(), { target: { value: "car-honda-city" } });
    fireEvent.click(screen.getByRole("radio", { name: v.fuels.diesel }));
    fireEvent.change(registrationField(), { target: { value: "MX12AB1234" } });
    await save();

    expect(Object.fromEntries(action.mock.calls[0][1].entries())).toMatchObject({
      vehicleModel: "car-honda-city",
      vehicleFuel: "diesel",
      registration: "MX12AB1234",
    });
    expect(modelField().value).toBe("car-honda-city");
    expect((screen.getByRole("radio", { name: v.fuels.diesel }) as HTMLInputElement).checked).toBe(true);
    expect(registrationField().value).toBe("MX12AB1234");
    expect(pucField()!.value).toBe("2027-03-12");
    expect(insuranceField().value).toBe("2040-01-01");

    const registrationError = screen.getByText(t.errors["registration-unknown-state"]);
    expect(registrationField().getAttribute("aria-invalid")).toBe("true");
    expect(registrationField().getAttribute("aria-describedby")).toContain(registrationError.id);
    const dateError = screen.getByText(t.errors["date-out-of-range"]);
    expect(insuranceField().getAttribute("aria-invalid")).toBe("true");
    expect(insuranceField().getAttribute("aria-describedby")).toBe(dateError.id);
    expect(pucField()!.hasAttribute("aria-invalid")).toBe(false);
    expect(document.activeElement).toBe(registrationField());
  });

  test("a picker error marks the model field and puts the cursor there", async () => {
    const answer: VehicleFormState = {
      ...withErrors,
      values: { ...withErrors.values, modelId: "", fuel: "" },
      errors: { vehicle: t.errors["vehicle-missing"] },
    };
    renderWithIntl(formIn("visible", vi.fn<VehicleAction>().mockResolvedValue(answer)));
    fireEvent.change(registrationField(), { target: { value: "MX12AB1234" } });
    await save();
    expect(screen.getByText(t.errors["vehicle-missing"])).toBeTruthy();
    expect(modelField().getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(modelField());
  });

  test("leaving the page (hidden) and coming back starts it empty, errors and all", async () => {
    const action = vi.fn<VehicleAction>().mockResolvedValue(withErrors);
    const { rerender } = renderWithIntl(formIn("visible", action));
    fireEvent.change(registrationField(), { target: { value: "MX12AB1234" } });
    await save();
    expect(registrationField().value).toBe("MX12AB1234");

    rerender(withIntl(formIn("hidden", action)));
    rerender(withIntl(formIn("visible", action)));
    expect(modelField().value).toBe("");
    expect(registrationField().value).toBe("");
    expect(insuranceField().value).toBe("");
    expect(screen.queryByText(t.errors["registration-unknown-state"])).toBeNull();
  });

  test("an electric model hides the PUC date; another fuel brings it back", () => {
    renderWithIntl(formIn("visible", vi.fn<VehicleAction>()));
    fireEvent.change(modelField(), { target: { value: "car-byd-seal" } });
    expect(pucField()).toBeNull();
    // Another brand: electric isn't one of its fuels, so the fuel clears.
    fireEvent.change(screen.getByRole("combobox", { name: v.picker.makeLabel }), { target: { value: "car-honda" } });
    expect(pucField()).not.toBeNull();
  });
});

describe("vehicleSubmitter (what useActionState runs)", () => {
  const form = () => {
    const data = new FormData();
    data.set("vehicleModel", "car-honda-city");
    data.set("vehicleFuel", "petrol");
    data.set("registration", "MH12AB1234");
    return data;
  };

  test("a saved vehicle's redirect is passed on to Next.js, not turned into an error", async () => {
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/account;303;" });
    const submit = vehicleSubmitter(vi.fn<VehicleAction>().mockRejectedValue(redirect), "No connection");
    await expect(submit(initialVehicleFormState, form())).rejects.toBe(redirect);
  });

  test("a failed call keeps everything posted and says so", async () => {
    const submit = vehicleSubmitter(vi.fn<VehicleAction>().mockRejectedValue(new TypeError("Failed to fetch")), "No connection");
    expect(await submit(initialVehicleFormState, form())).toEqual({
      submission: 1,
      values: { modelId: "car-honda-city", fuel: "petrol", registration: "MH12AB1234", pucExpiresOn: "", insuranceExpiresOn: "" },
      errors: { form: "No connection" },
    });
  });
});
