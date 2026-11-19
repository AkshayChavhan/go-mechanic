// Sample pickup areas: made-up PIN codes and fees that let the owner see the
// pickup list on /contact before giving the real ones.
//
// A made-up fee must never reach a customer (the owner's rule for prices,
// 2026-10-29, which covers fees; task 24, 2026-11-18). So these show under
// `npm run dev` only, marked Sample, and live in code, never in the database:
// pickup_areas holds real areas only, and the first real one turns every
// sample off. The booking save reads the table, never this file, so a sample
// can't be booked.
//
// PIN codes only, no place names: nothing made up should read like a fact.
// The first is the garage's own PIN code.
//
// Read them only through selectPickupAreas(), from server code. The
// server-only import makes any import from browser code fail the build.

import "server-only";

import type { PickupArea } from "@/domain/pickup";
import { realOrSamples, type Shown } from "@/lib/samples";

/** Exported for the tests only: everything else reads selectPickupAreas() (sample-pickup-areas.test.ts checks). */
export const samplePickupAreas: readonly PickupArea[] = [
  { postalCode: "410501", feePaise: 40_000 },
  { postalCode: "411062", feePaise: 30_000 },
  { postalCode: "412101", feePaise: 0 },
  { postalCode: "412105", feePaise: 20_000 },
];

/**
 * The areas to show: the real ones, else the samples under `npm run dev`,
 * else null (the section is left out). Any real area turns every sample off.
 */
export function selectPickupAreas(real: readonly PickupArea[]): Shown<PickupArea> | null {
  return realOrSamples(real, samplePickupAreas);
}
