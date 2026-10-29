import { fireEvent, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { renderToString } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

import type { VehicleCatalogue } from "@/domain/vehicles";
import { defaultLocale } from "@/i18n/config";
import { renderWithIntl } from "@/i18n/test-utils";

import { VehiclePicker, type VehiclePickerLabels } from "./vehicle-picker";

// Labels that differ from messages/en.json ("T-" in front), so a test that
// finds them proves the picker shows its labels prop and types no text.
const labels: VehiclePickerLabels = {
  kindLegend: "T-Type",
  kinds: { car: "T-Car", "two-wheeler": "T-Two-wheeler" },
  makeLabel: "T-Brand",
  makePlaceholder: "T-Choose a brand",
  makeGroups: { car: "T-Cars", "two-wheeler": "T-Two-wheelers" },
  modelLabel: "T-Model",
  modelPlaceholder: "T-Choose a model",
  modelGroup: "{brand} / {kind}",
  fuelLegend: "T-Fuel",
  fuels: { petrol: "T-Petrol", diesel: "T-Diesel", cng: "T-CNG", electric: "T-Electric" },
  announceSet: "{field} is now {value}",
  announceCleared: "{field} emptied",
};

// Honda under both kinds, a one-fuel model and a two-fuel one.
const catalogue: VehicleCatalogue = {
  categories: [
    { id: "sedan", kind: "car", name: { en: "Sedan" } },
    { id: "hatchback", kind: "car", name: { en: "Hatchback" } },
    { id: "scooter", kind: "two-wheeler", name: { en: "Scooter" } },
  ],
  makes: [
    {
      id: "car-tata",
      kind: "car",
      name: { en: "Tata" },
      models: [{ id: "car-tata-tiago", name: { en: "Tiago" }, categoryId: "hatchback", fuels: ["petrol", "cng"] }],
    },
    {
      id: "car-honda",
      kind: "car",
      name: { en: "Honda" },
      models: [
        { id: "car-honda-city", name: { en: "City" }, categoryId: "sedan", fuels: ["petrol", "diesel"] },
        { id: "car-honda-elevate", name: { en: "Elevate" }, categoryId: "hatchback", fuels: ["petrol"] },
      ],
    },
    {
      id: "two-wheeler-honda",
      kind: "two-wheeler",
      name: { en: "Honda" },
      models: [{ id: "two-wheeler-honda-activa", name: { en: "Activa" }, categoryId: "scooter", fuels: ["petrol"] }],
    },
  ],
};

const brandSelect = () => screen.getByRole("combobox", { name: "T-Brand" }) as HTMLSelectElement;
const modelSelect = () => screen.getByRole("combobox", { name: "T-Model" }) as HTMLSelectElement;
const status = () => screen.getByRole("status");
const groupLabels = (select: HTMLSelectElement) =>
  [...select.querySelectorAll("optgroup")].map((group) => group.getAttribute("label"));
const optionTexts = (select: HTMLSelectElement) =>
  [...select.querySelectorAll("option")].map((option) => option.textContent);

describe("VehiclePicker", () => {
  test("with nothing chosen, offers every brand by kind and every model by brand, the Hondas told apart", () => {
    renderWithIntl(<VehiclePicker catalogue={catalogue} labels={labels} />);
    expect(screen.getByRole("group", { name: "T-Type" })).toBeTruthy();
    expect(groupLabels(brandSelect())).toEqual(["T-Cars", "T-Two-wheelers"]);
    expect(optionTexts(brandSelect())).toEqual(["T-Choose a brand", "Tata", "Honda", "Honda"]);
    expect(groupLabels(modelSelect())).toEqual(["Tata / T-Car", "Honda / T-Car", "Honda / T-Two-wheeler"]);
    expect(within(screen.getByRole("group", { name: "T-Fuel" })).getAllByRole("radio")).toHaveLength(3);
  });

  test("choosing a type leaves only that type's brands, without an announcement (the visitor did it)", () => {
    renderWithIntl(<VehiclePicker catalogue={catalogue} labels={labels} />);
    fireEvent.click(screen.getByRole("radio", { name: "T-Two-wheeler" }));
    expect(optionTexts(brandSelect())).toEqual(["T-Choose a brand", "Honda"]);
    expect(groupLabels(brandSelect())).toEqual([]);
    expect(groupLabels(modelSelect())).toEqual(["Honda"]);
    expect(status().textContent).toBe("");
  });

  test("choosing a model first fills in its brand and type, and says so", () => {
    renderWithIntl(<VehiclePicker catalogue={catalogue} labels={labels} />);
    fireEvent.change(modelSelect(), { target: { value: "car-honda-city" } });
    expect(brandSelect().value).toBe("car-honda");
    expect((screen.getByRole("radio", { name: "T-Car" }) as HTMLInputElement).checked).toBe(true);
    expect(status().textContent).toBe("T-Type is now T-Car. T-Brand is now Honda");
  });

  test("a model with one fuel checks it, and says so", () => {
    renderWithIntl(<VehiclePicker catalogue={catalogue} labels={labels} />);
    fireEvent.change(modelSelect(), { target: { value: "car-honda-elevate" } });
    expect((screen.getByRole("radio", { name: "T-Petrol" }) as HTMLInputElement).checked).toBe(true);
    expect(within(screen.getByRole("group", { name: "T-Fuel" })).getAllByRole("radio")).toHaveLength(1);
    expect(status().textContent).toContain("T-Fuel is now T-Petrol");
  });

  test("changing the brand clears a model of the old one, and says so", () => {
    renderWithIntl(<VehiclePicker catalogue={catalogue} labels={labels} />);
    fireEvent.change(modelSelect(), { target: { value: "car-honda-city" } });
    fireEvent.change(brandSelect(), { target: { value: "car-tata" } });
    expect(modelSelect().value).toBe("");
    expect(status().textContent).toBe("T-Model emptied");
  });

  test("posts its choice in a form under the name's fields", () => {
    renderWithIntl(
      <form aria-label="Book">
        <VehiclePicker catalogue={catalogue} labels={labels} name="vehicle" />
      </form>,
    );
    fireEvent.change(modelSelect(), { target: { value: "car-honda-city" } });
    fireEvent.click(screen.getByRole("radio", { name: "T-Diesel" }));
    const data = new FormData(screen.getByRole("form", { name: "Book" }) as HTMLFormElement);
    expect(Object.fromEntries(data)).toEqual({
      vehicleKind: "car",
      vehicleMake: "car-honda",
      vehicleModel: "car-honda-city",
      vehicleFuel: "diesel",
    });
  });

  test("a default model fills every field on the first render", () => {
    renderWithIntl(<VehiclePicker catalogue={catalogue} labels={labels} defaultValue={{ modelId: "two-wheeler-honda-activa" }} />);
    expect((screen.getByRole("radio", { name: "T-Two-wheeler" }) as HTMLInputElement).checked).toBe(true);
    expect(brandSelect().value).toBe("two-wheeler-honda");
    expect(modelSelect().value).toBe("two-wheeler-honda-activa");
    expect((screen.getByRole("radio", { name: "T-Petrol" }) as HTMLInputElement).checked).toBe(true);
  });

  test("its server HTML lists every brand and model, even with a default chosen, so it works without JavaScript", () => {
    const html = renderToString(
      <NextIntlClientProvider locale={defaultLocale} messages={{}}>
        <VehiclePicker catalogue={catalogue} labels={labels} defaultValue={{ modelId: "two-wheeler-honda-activa" }} />
      </NextIntlClientProvider>,
    );
    const page = new DOMParser().parseFromString(html, "text/html");
    const selects = [...page.querySelectorAll("select")];
    expect([...selects[0]!.querySelectorAll("option")].map((option) => option.value)).toEqual([
      "",
      "car-tata",
      "car-honda",
      "two-wheeler-honda",
    ]);
    expect([...selects[1]!.querySelectorAll("option")].map((option) => option.value)).toEqual([
      "",
      "car-tata-tiago",
      "car-honda-city",
      "car-honda-elevate",
      "two-wheeler-honda-activa",
    ]);
    // The default is selected in that full list.
    expect(selects[1]!.querySelector("option[selected]")?.getAttribute("value")).toBe("two-wheeler-honda-activa");
  });

  test("tells its parent about every new choice", () => {
    const onChange = vi.fn();
    renderWithIntl(<VehiclePicker catalogue={catalogue} labels={labels} onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "T-Car" }));
    expect(onChange).toHaveBeenLastCalledWith({ kind: "car", makeId: null, modelId: null, fuel: null });
  });

  test("shows only words from its labels prop and the catalogue", () => {
    const { container } = renderWithIntl(<VehiclePicker catalogue={catalogue} labels={labels} />);
    const words = new Set(
      [...container.querySelectorAll("legend, label, option")].map((element) => element.textContent?.trim()),
    );
    const allowed = new Set([
      ...Object.values(labels).flatMap((value) => (typeof value === "string" ? [value] : Object.values(value))),
      ...catalogue.makes.flatMap((make) => [make.name.en, ...make.models.map((model) => model.name.en)]),
    ]);
    for (const word of words) expect(allowed, word).toContain(word);
  });
});
