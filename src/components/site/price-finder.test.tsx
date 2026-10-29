import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import type { ServicePrice } from "@/domain/services";
import { renderWithIntl } from "@/i18n/test-utils";
import { draftServices } from "@/server/db/service-seed-data";
import { draftCatalogue } from "@/server/db/vehicle-seed-data";
import messages from "../../../messages/en.json";

import { type FinderPackage, PriceFinder, type PriceFinderLabels } from "./price-finder";
import type { VehiclePickerLabels } from "./vehicle-picker";

// Every word comes through props (the page builds them from the messages), so
// the test passes made-up words: anything the finder shows that isn't one of
// them would be text the finder typed in itself.
const labels: PriceFinderLabels = {
  title: "TITLE",
  lead: "LEAD",
  prompt: "PROMPT",
  resultsTitle: "RESULTS {brand} {model} {fuel}",
  notOffered: "NOT-OFFERED",
  callForPrice: "CALL",
  sample: "SAMPLE",
};
const v = messages.Vehicles;
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

const packages: FinderPackage[] = draftServices
  .filter((service) => service.kind === "package")
  .map(({ id, vehicleKinds, fuels, pricedAfterInspection, name }) => ({
    id,
    vehicleKinds,
    fuels,
    pricedAfterInspection,
    name: name.en,
  }));

// Honda City is a sedan; Activa a scooter; Ather Rizta an electric scooter.
const prices: ServicePrice[] = [
  { serviceId: "car-basic", categoryId: "sedan", fuel: null, pricePaise: 299_900 },
  { serviceId: "car-basic", categoryId: "sedan", fuel: "diesel", pricePaise: 339_900 },
  { serviceId: "car-standard", categoryId: "sedan", fuel: null, pricePaise: 459_900 },
  { serviceId: "two-wheeler-basic", categoryId: "scooter", fuel: null, pricePaise: 59_900 },
];

function renderFinder(sample = true) {
  return renderWithIntl(
    <PriceFinder
      catalogue={draftCatalogue}
      pickerLabels={pickerLabels}
      labels={labels}
      packages={packages}
      prices={prices}
      sample={sample}
    />,
  );
}

const model = () => screen.getByRole("combobox", { name: v.picker.modelLabel });
/** The finder's own live region: the visible one (the picker's is for screen readers only). */
const results = () => screen.getAllByRole("status").find((region) => !region.classList.contains("sr-only"))!;

describe("PriceFinder", () => {
  test("asks for a vehicle until a model and a fuel are chosen", () => {
    renderFinder();
    expect(results().textContent).toBe(labels.prompt);
    expect(results().parentElement!.querySelector("ul")).toBeNull();
  });

  test("shows each car package's price for the chosen car's price group and fuel", () => {
    renderFinder();
    fireEvent.change(model(), { target: { value: "car-honda-city" } });
    fireEvent.click(screen.getByRole("radio", { name: v.fuels.diesel }));
    expect(results().textContent).toBe("RESULTS Honda City Diesel");

    const rows = within(results().parentElement!).getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      "Basic service₹3,399SAMPLE",
      "Standard service₹4,599SAMPLE",
      "Comprehensive serviceCALL",
    ]);
  });

  test("lists only the chosen kind's packages", () => {
    renderFinder();
    fireEvent.change(model(), { target: { value: "two-wheeler-honda-activa" } });
    const rows = within(results().parentElement!).getAllByRole("listitem");
    expect(rows[0]!.textContent).toBe("Basic service₹599SAMPLE");
    expect(rows).toHaveLength(3);
  });

  test("an electric vehicle: no package is offered for it yet", () => {
    renderFinder();
    fireEvent.change(model(), { target: { value: "two-wheeler-ather-rizta" } });
    const rows = within(results().parentElement!).getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      "Basic serviceNOT-OFFERED",
      "Standard serviceNOT-OFFERED",
      "Comprehensive serviceNOT-OFFERED",
    ]);
  });

  test("real prices: no Sample mark", () => {
    renderFinder(false);
    fireEvent.change(model(), { target: { value: "car-honda-city" } });
    fireEvent.click(screen.getByRole("radio", { name: v.fuels.petrol }));
    const rows = within(results().parentElement!).getAllByRole("listitem");
    expect(rows[0]!.textContent).toBe("Basic service₹2,999");
    expect(screen.queryByText(labels.sample)).toBeNull();
  });
});
