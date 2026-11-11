import { act, fireEvent, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
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

  test("keeps a choice made in the fields before the page's JavaScript loaded", async () => {
    // The server's HTML is in the page, the visitor picks a model, and only
    // then does React hydrate it: the choice must survive, with its brand
    // and type filled in, in what's shown and in what the form posts.
    const onChange = vi.fn();
    const tree: ReactElement = (
      <NextIntlClientProvider locale={defaultLocale} messages={{}}>
        <form aria-label="Book">
          <VehiclePicker catalogue={catalogue} labels={labels} onChange={onChange} />
        </form>
      </NextIntlClientProvider>
    );
    const container = document.createElement("div");
    container.innerHTML = renderToString(tree);
    document.body.append(container);
    const [brand, model] = [...container.querySelectorAll("select")];
    model!.value = "car-honda-city";

    // React reports a hydration mismatch with console.error.
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    let root: Root | undefined;
    await act(async () => {
      root = hydrateRoot(container, tree);
    });
    try {
      expect(consoleError).not.toHaveBeenCalled();
      expect(model!.value).toBe("car-honda-city");
      expect(brand!.value).toBe("car-honda");
      expect((within(container).getByRole("radio", { name: "T-Car" }) as HTMLInputElement).checked).toBe(true);
      const data = new FormData(container.querySelector("form")!);
      expect(Object.fromEntries(data)).toEqual({ vehicleKind: "car", vehicleMake: "car-honda", vehicleModel: "car-honda-city" });
      // The parent hears about it once, as about any other choice.
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith({ kind: "car", makeId: "car-honda", modelId: "car-honda-city", fuel: null });
    } finally {
      consoleError.mockRestore();
      act(() => root?.unmount());
      container.remove();
    }
  });

  test("also keeps a type or a fuel picked before the page's JavaScript loaded", async () => {
    const tree: ReactElement = (
      <NextIntlClientProvider locale={defaultLocale} messages={{}}>
        <form aria-label="Book">
          <VehiclePicker catalogue={catalogue} labels={labels} />
        </form>
      </NextIntlClientProvider>
    );
    // Two rounds: a type alone, then a model with one of its fuels.
    const choices: { pick: (picker: HTMLElement) => void; posted: Record<string, string> }[] = [
      {
        pick: (picker) => {
          picker.querySelector<HTMLInputElement>('input[name="vehicleKind"][value="two-wheeler"]')!.checked = true;
        },
        posted: { vehicleKind: "two-wheeler", vehicleMake: "", vehicleModel: "" },
      },
      {
        pick: (picker) => {
          picker.querySelectorAll("select")[1]!.value = "car-honda-city";
          picker.querySelector<HTMLInputElement>('input[name="vehicleFuel"][value="diesel"]')!.checked = true;
        },
        posted: { vehicleKind: "car", vehicleMake: "car-honda", vehicleModel: "car-honda-city", vehicleFuel: "diesel" },
      },
    ];
    for (const { pick, posted } of choices) {
      const container = document.createElement("div");
      container.innerHTML = renderToString(tree);
      document.body.append(container);
      pick(container);
      let root: Root | undefined;
      await act(async () => {
        root = hydrateRoot(container, tree);
      });
      try {
        expect(Object.fromEntries(new FormData(container.querySelector("form")!))).toEqual(posted);
      } finally {
        act(() => root?.unmount());
        container.remove();
      }
    }
  });

  test("a form reset puts it back to its default, in what's shown and what's posted", () => {
    renderWithIntl(
      <form aria-label="Book">
        <VehiclePicker catalogue={catalogue} labels={labels} />
      </form>,
    );
    const form = screen.getByRole("form", { name: "Book" }) as HTMLFormElement;
    fireEvent.change(modelSelect(), { target: { value: "car-honda-city" } });
    act(() => form.reset());
    expect(modelSelect().value).toBe("");
    expect(brandSelect().value).toBe("");
    expect((screen.getByRole("radio", { name: "T-Car" }) as HTMLInputElement).checked).toBe(false);
    expect(Object.fromEntries(new FormData(form))).toEqual({ vehicleMake: "", vehicleModel: "" });
  });

  test("with a default, a form reset goes back to that vehicle, not to empty", () => {
    renderWithIntl(
      <form aria-label="Book">
        <VehiclePicker catalogue={catalogue} labels={labels} defaultValue={{ modelId: "car-honda-city", fuel: "diesel" }} />
      </form>,
    );
    const form = screen.getByRole("form", { name: "Book" }) as HTMLFormElement;
    fireEvent.change(modelSelect(), { target: { value: "car-tata-tiago" } });
    act(() => form.reset());
    expect(modelSelect().value).toBe("car-honda-city");
    expect(Object.fromEntries(new FormData(form))).toEqual({
      vehicleKind: "car",
      vehicleMake: "car-honda",
      vehicleModel: "car-honda-city",
      vehicleFuel: "diesel",
    });
  });

  test("an error shows under it and marks the model field invalid", () => {
    renderWithIntl(<VehiclePicker catalogue={catalogue} labels={labels} error="T-Choose your vehicle" />);
    const message = screen.getByText("T-Choose your vehicle");
    expect(modelSelect().getAttribute("aria-invalid")).toBe("true");
    expect(modelSelect().getAttribute("aria-describedby")).toBe(message.id);
  });

  test("without an error, nothing is marked invalid", () => {
    renderWithIntl(<VehiclePicker catalogue={catalogue} labels={labels} />);
    expect(modelSelect().hasAttribute("aria-invalid")).toBe(false);
    expect(modelSelect().hasAttribute("aria-describedby")).toBe(false);
  });
});
