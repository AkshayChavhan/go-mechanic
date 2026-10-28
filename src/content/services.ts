// The services the garage offers, in the order the home page lists them.
//
// The names are the owner's (features.md, item 4). The one-line summaries and
// which vehicles each service covers are drafts the owner checks at the
// task 13 look check. Prices aren't here: they arrive with task 18, which
// moves this list into the database (same fields), so only the reader changes.
//
// Summaries describe the work plainly. They promise nothing the garage
// doesn't offer yet: no pickup, warranty, parts or turnaround claims.

import type { VehicleKind } from "@/domain/vehicles";
import type { LocalizedText } from "@/i18n/localized-text";

export type Service = {
  /**
   * A stable name for the service: lowercase words joined by hyphens. Task 18
   * uses it in the page address (/services/periodic-service), so never a dot.
   */
  id: string;
  name: LocalizedText;
  /** One line: what the service is, in plain words. */
  summary: LocalizedText;
  /** Which vehicles it's for: cars, two-wheelers, or both. */
  vehicles: readonly VehicleKind[];
};

const both = ["car", "two-wheeler"] as const;

// `as const` keeps each id as its exact text, so ServiceId below lists them
// (the home page's tiles use it to give every service an icon). `satisfies`
// still checks every entry against the Service type.
export const services = [
  {
    id: "periodic-service",
    name: { en: "Periodic service" },
    summary: { en: "Engine oil, filters and a full check-up, on your vehicle's schedule." },
    vehicles: both,
  },
  {
    id: "ac",
    name: { en: "AC" },
    summary: { en: "Cooling checks, gas top-up and repairs for your car's air conditioning." },
    vehicles: ["car"],
  },
  {
    id: "denting-painting",
    name: { en: "Denting and painting" },
    summary: { en: "Dents and scratches repaired, and panels repainted to match." },
    vehicles: both,
  },
  {
    id: "battery",
    name: { en: "Battery" },
    summary: { en: "Battery testing, charging and replacement." },
    vehicles: both,
  },
  {
    id: "tyres-alignment",
    name: { en: "Tyres and alignment" },
    summary: { en: "Tyre changes, puncture repair, wheel alignment and balancing." },
    vehicles: both,
  },
  {
    id: "brakes",
    name: { en: "Brakes" },
    summary: { en: "Brake pads, shoes, discs and fluid, checked and replaced." },
    vehicles: both,
  },
  {
    id: "clutch-suspension",
    name: { en: "Clutch and suspension" },
    summary: { en: "Clutch, shock absorber and suspension repairs." },
    vehicles: both,
  },
  {
    id: "engine",
    name: { en: "Engine" },
    summary: { en: "Diagnosis and repair for noises, leaks, smoke and loss of power." },
    vehicles: both,
  },
  {
    id: "electricals",
    name: { en: "Electricals" },
    summary: { en: "Wiring, lights, horn, starter and charging faults." },
    vehicles: both,
  },
  {
    id: "wash-detailing",
    name: { en: "Wash and detailing" },
    summary: { en: "Washing, interior cleaning and polishing." },
    vehicles: both,
  },
  {
    id: "insurance-claim-help",
    name: { en: "Insurance claim help" },
    summary: { en: "Help with the paperwork and the repair for an insurance claim." },
    vehicles: both,
  },
] as const satisfies readonly Service[];

/** The id of one of the services above: "periodic-service", "ac"... */
export type ServiceId = (typeof services)[number]["id"];
