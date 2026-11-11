import { render, screen, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import type { MyVehicle } from "@/server/dal/customer-vehicles";
import messages from "../../../messages/en.json";

import { VehicleList } from "./vehicle-list";

// VehicleList is an async Server Component: each test calls it and renders
// what it returns. getTranslations is next-intl's own translator over the
// real messages.
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const { default: allMessages } = await import("../../../messages/en.json");
  return {
    getTranslations: async ({ locale, namespace }: { locale: "en"; namespace: "MyVehicles" | "Vehicles" }) =>
      createTranslator({ locale, messages: allMessages, namespace }),
  };
});

const t = messages.MyVehicles;

const city: MyVehicle = {
  id: "6f1c1f0e-8a7c-4c1e-9d55-0b7a2a8c1e11",
  kind: "car",
  modelId: "car-honda-city",
  makeName: { en: "Honda" },
  modelName: { en: "City" },
  fuel: "petrol",
  registrationNumber: "MH12AB1234",
  pucExpiresOn: "2027-03-12",
  insuranceExpiresOn: null,
};

const today = "2026-10-29";

async function renderList(vehicles: MyVehicle[]) {
  return render(await VehicleList({ vehicles, today, locale: "en" }));
}

describe("VehicleList", () => {
  test("shows each vehicle's brand and model, fuel, grouped number and dates", async () => {
    await renderList([city]);
    const card = screen.getByRole("heading", { level: 3, name: "Honda City" }).closest("li")!;
    expect(within(card).getByText("Petrol")).toBeTruthy();
    expect(within(card).getByText("MH 12 AB 1234")).toBeTruthy();
    expect(within(card).getByText(t.pucUntil.replace("{date}", "12 Mar 2027"))).toBeTruthy();
    expect(within(card).getByText(t.insuranceMissing)).toBeTruthy();
    expect(screen.queryByText(t.expired)).toBeNull();
  });

  test("a date before today in India says Expired; today itself doesn't", async () => {
    await renderList([{ ...city, pucExpiresOn: "2026-10-28", insuranceExpiresOn: today }]);
    const puc = screen.getByText(t.pucUntil.replace("{date}", "28 Oct 2026"));
    expect(within(puc).getByText(t.expired)).toBeTruthy();
    const insurance = screen.getByText(t.insuranceUntil.replace("{date}", "29 Oct 2026"));
    expect(within(insurance).queryByText(t.expired)).toBeNull();
  });

  test("no dates: both say they weren't added", async () => {
    await renderList([{ ...city, pucExpiresOn: null }]);
    expect(screen.getByText(t.pucMissing)).toBeTruthy();
    expect(screen.getByText(t.insuranceMissing)).toBeTruthy();
  });

  test("an electric vehicle has no PUC line at all", async () => {
    await renderList([{ ...city, fuel: "electric", pucExpiresOn: null }]);
    expect(screen.getByText("Electric")).toBeTruthy();
    expect(screen.queryByText(t.pucMissing)).toBeNull();
  });

  test("a Bharat series number is grouped too", async () => {
    await renderList([{ ...city, registrationNumber: "22BH1234AB" }]);
    expect(screen.getByText("22 BH 1234 AB")).toBeTruthy();
  });

  test("lists vehicles in the order given (oldest first, from the data-access layer)", async () => {
    await renderList([city, { ...city, id: "second", modelName: { en: "Amaze" } }]);
    expect(screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual([
      "Honda City",
      "Honda Amaze",
    ]);
  });

  test("no vehicles: says so", async () => {
    await renderList([]);
    expect(screen.getByText(t.empty)).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
  });
});
