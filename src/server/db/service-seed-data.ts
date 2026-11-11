// The services and packages every new database starts with.
//
// - The 11 service names and their one-line summaries are the owner's
//   (features.md, item 4; checked at the task 13 look check), in the owner's
//   order. They were in src/content/services.ts until task 18.
// - Everything else is a DRAFT written by Claude on 2026-10-29, for the owner
//   to check: what each service includes, the signs you need it, which fuels
//   it covers, which ones are priced only after an inspection, and the three
//   packages (Basic, Standard, Comprehensive) for cars and for two-wheelers.
//   The owner chose to show the draft publicly: it describes the work and
//   promises nothing (no pickup, warranty, parts or turnaround claims).
// - Periodic service, engine work and the packages leave out electric
//   vehicles for now: they're about oil and filters. The owner says what an
//   electric vehicle's service includes (task 18's open questions).
// - No prices here: real prices go into service_prices (task 39). Until then
//   `npm run dev` shows marked samples (src/content/sample-prices.ts).
//
// A new database gets all of this (src/server/db/seed.ts); an existing one
// gets only the rows it doesn't have yet, so the owner's later edits stay.
//
// Plain data, with no server-only import: the unit tests and the Playwright
// tests (e2e/) import `draftServices` as the values they expect on the page.

import type { Service } from "@/domain/services";
import type { Fuel, VehicleKind } from "@/domain/vehicles";

const both: readonly VehicleKind[] = ["car", "two-wheeler"];
const everyFuel: readonly Fuel[] = ["petrol", "diesel", "cng", "electric"];
const notElectric: readonly Fuel[] = ["petrol", "diesel", "cng"];

/** A list of English texts as LocalizedText. */
const texts = (...lines: string[]) => lines.map((en) => ({ en }));

const serviceList: readonly Service[] = [
  {
    id: "periodic-service",
    kind: "service",
    name: { en: "Periodic service" },
    summary: { en: "Engine oil, filters and a full check-up, on your vehicle's schedule." },
    vehicleKinds: both,
    fuels: notElectric,
    included: texts(
      "Engine oil and oil filter changed",
      "Air filter cleaned, or replaced if it's worn",
      "Fluids checked and topped up",
      "Brakes, lights, battery and tyres checked",
      "A road test, and a report of anything that needs work",
    ),
    signs: texts(
      "The service date or distance in your service book has passed",
      "The oil warning light is on",
      "The engine runs rougher or uses more fuel than before",
    ),
    pricedAfterInspection: false,
  },
  {
    id: "ac",
    kind: "service",
    name: { en: "AC" },
    summary: { en: "Cooling checks, gas top-up and repairs for your car's air conditioning." },
    vehicleKinds: ["car"],
    fuels: everyFuel,
    included: texts(
      "Cooling and airflow check",
      "Gas pressure check, and a top-up if it's low",
      "Cabin filter cleaned",
      "Pipes and joints checked for leaks",
      "Compressor and condenser fan checked",
    ),
    signs: texts(
      "The air isn't as cold as it used to be",
      "A bad smell when the AC is on",
      "Water dripping inside the car",
      "A noise when the AC switches on",
    ),
    pricedAfterInspection: false,
  },
  {
    id: "denting-painting",
    kind: "service",
    name: { en: "Denting and painting" },
    summary: { en: "Dents and scratches repaired, and panels repainted to match." },
    vehicleKinds: both,
    fuels: everyFuel,
    included: texts("Dent removal", "Scratch repair", "Panels repainted to match the colour", "A polish after the work"),
    signs: texts("Dents or scratches after a knock", "Paint that has faded, chipped or started to rust"),
    pricedAfterInspection: true,
  },
  {
    id: "battery",
    kind: "service",
    name: { en: "Battery" },
    summary: { en: "Battery testing, charging and replacement." },
    vehicleKinds: both,
    fuels: everyFuel,
    included: texts(
      "Battery health and charge test",
      "Terminals cleaned and tightened",
      "Charging system check",
      "Replacement if the battery is worn out",
    ),
    signs: texts(
      "Slow or failed starts",
      "Dim lights or a weak horn",
      "A battery warning light",
      "White powder on the battery terminals",
    ),
    pricedAfterInspection: false,
  },
  {
    id: "tyres-alignment",
    kind: "service",
    name: { en: "Tyres and alignment" },
    summary: { en: "Tyre changes, puncture repair, wheel alignment and balancing." },
    vehicleKinds: both,
    fuels: everyFuel,
    included: texts(
      "Tyre condition and pressure check",
      "Puncture repair",
      "Tyre replacement",
      "Wheel alignment",
      "Wheel balancing",
    ),
    signs: texts(
      "The vehicle pulls to one side",
      "The steering wheel or handlebar shakes",
      "Tyres wearing unevenly",
      "A puncture or a slow leak",
    ),
    pricedAfterInspection: false,
  },
  {
    id: "brakes",
    kind: "service",
    name: { en: "Brakes" },
    summary: { en: "Brake pads, shoes, discs and fluid, checked and replaced." },
    vehicleKinds: both,
    fuels: everyFuel,
    included: texts(
      "Brake pads and shoes checked, and replaced if worn",
      "Discs and drums checked",
      "Brake fluid checked, topped up or changed",
      "Brake cables and lines checked",
    ),
    signs: texts(
      "A squeal or a grinding noise when you brake",
      "The brake pedal or lever feels soft",
      "It takes longer to stop",
      "The vehicle pulls to one side when you brake",
    ),
    pricedAfterInspection: false,
  },
  {
    id: "clutch-suspension",
    kind: "service",
    name: { en: "Clutch and suspension" },
    summary: { en: "Clutch, shock absorber and suspension repairs." },
    vehicleKinds: both,
    fuels: everyFuel,
    included: texts(
      "Clutch check and adjustment",
      "Clutch plate, cable or hydraulic repair",
      "Shock absorbers and springs checked",
      "Suspension joints and bushes checked",
    ),
    signs: texts(
      "The clutch slips or feels hard",
      "Trouble changing gears",
      "Knocking over bumps",
      "The vehicle bounces or leans more than before",
    ),
    pricedAfterInspection: true,
  },
  {
    id: "engine",
    kind: "service",
    name: { en: "Engine" },
    summary: { en: "Diagnosis and repair for noises, leaks, smoke and loss of power." },
    vehicleKinds: both,
    fuels: notElectric,
    included: texts(
      "Diagnosis of the fault",
      "Leak and smoke checks",
      "Repair or replacement of the faulty parts",
      "A road test after the repair",
    ),
    signs: texts(
      "New noises from the engine",
      "Oil leaks, or smoke from the exhaust",
      "Loss of power or poor pickup",
      "The engine warning light is on",
    ),
    pricedAfterInspection: true,
  },
  {
    id: "electricals",
    kind: "service",
    name: { en: "Electricals" },
    summary: { en: "Wiring, lights, horn, starter and charging faults." },
    vehicleKinds: both,
    fuels: everyFuel,
    included: texts(
      "Fault finding with diagnostic tools",
      "Wiring repair",
      "Lights, horn and indicators repaired",
      "Starter and charging faults repaired",
    ),
    signs: texts(
      "Lights, horn or indicators not working",
      "Fuses that keep blowing",
      "Trouble starting",
      "Warning lights on the dashboard",
    ),
    pricedAfterInspection: true,
  },
  {
    id: "wash-detailing",
    kind: "service",
    name: { en: "Wash and detailing" },
    summary: { en: "Washing, interior cleaning and polishing." },
    vehicleKinds: both,
    fuels: everyFuel,
    included: texts("Exterior wash", "Interior vacuum and wipe-down", "Polish", "Tyres and trim cleaned and dressed"),
    signs: texts("Dust and grime after the monsoon or a long trip", "Stains or smells inside"),
    pricedAfterInspection: false,
  },
  {
    id: "insurance-claim-help",
    kind: "service",
    name: { en: "Insurance claim help" },
    summary: { en: "Help with the paperwork and the repair for an insurance claim." },
    vehicleKinds: both,
    fuels: everyFuel,
    included: texts(
      "An inspection and a repair estimate for your insurer",
      "Help with the claim paperwork",
      "The photos and documents your insurer asks for",
      "The repair",
    ),
    signs: texts("Damage from an accident, a fall or a flood"),
    pricedAfterInspection: true,
  },
];

/** One package: its kind, its level and what it includes. */
function servicePackage(
  kind: VehicleKind,
  level: "basic" | "standard" | "comprehensive",
  name: string,
  summary: string,
  fuels: readonly Fuel[],
  included: readonly string[],
): Service {
  return {
    id: `${kind}-${level}`,
    kind: "package",
    name: { en: name },
    summary: { en: summary },
    vehicleKinds: [kind],
    fuels,
    included: texts(...included),
    signs: [],
    pricedAfterInspection: false,
  };
}

const basic = "The essentials: fresh oil and a safety check.";
const standard = "Everything in Basic, plus filters, plugs and a fuller check-up.";
const comprehensive = "Everything in Standard, plus a deeper check and a clean of the whole vehicle.";

const packageList: readonly Service[] = [
  servicePackage("car", "basic", "Basic service", basic, notElectric, [
    "Engine oil changed",
    "Oil filter replaced",
    "Coolant, brake fluid and washer fluid topped up",
    "Brakes, lights, battery and tyres checked",
  ]),
  servicePackage("car", "standard", "Standard service", standard, notElectric, [
    "Everything in Basic",
    "Air filter replaced",
    "AC cabin filter cleaned",
    "Spark plugs cleaned (petrol and CNG)",
    "Brakes cleaned and adjusted",
    "Exterior wash",
  ]),
  servicePackage("car", "comprehensive", "Comprehensive service", comprehensive, notElectric, [
    "Everything in Standard",
    "Fuel filter checked",
    "Wheel alignment and balancing",
    "Suspension and steering checked",
    "AC cooling check",
    "Interior vacuum",
    "A full report on the car's condition",
  ]),
  servicePackage("two-wheeler", "basic", "Basic service", basic, ["petrol", "cng"], [
    "Engine oil changed",
    "Chain cleaned and lubricated (motorcycles)",
    "Brakes, lights, horn and tyres checked",
  ]),
  servicePackage("two-wheeler", "standard", "Standard service", standard, ["petrol", "cng"], [
    "Everything in Basic",
    "Air filter cleaned",
    "Spark plug cleaned",
    "Brakes cleaned and adjusted",
    "Battery checked",
    "Wash",
  ]),
  servicePackage("two-wheeler", "comprehensive", "Comprehensive service", comprehensive, ["petrol", "cng"], [
    "Everything in Standard",
    "Fuel system cleaned",
    "Clutch and cables adjusted",
    "Suspension checked",
    "Polish",
    "A full report on the vehicle's condition",
  ]),
];

/** The 11 services, then the 6 packages, in list order. */
export const draftServices: readonly Service[] = [...serviceList, ...packageList];
