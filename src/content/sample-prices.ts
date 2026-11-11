// Sample prices: made-up prices that let the owner see and judge the price
// experience before giving real ones.
//
// The owner decided on 2026-10-29 (task 18) that a made-up price must never
// reach a customer, so these show under `npm run dev` only, each marked
// Sample. They live in code, never in the database: service_prices holds real
// prices only, and the first real price turns every sample off.
//
// The amounts are rough levels for a Pune garage, by price group, with
// diesel costing more where oil and filters cost more. They only demonstrate
// the layout; the owner's real list replaces them (task 39).
//
// Read them only through selectPrices(), from server code. Pass the result to
// client components as props (the price finder does). The server-only import
// below makes any import from browser code (direct, relative or through
// another file) fail the build, so the table can never ship to visitors.

import "server-only";

import type { ServicePrice } from "@/domain/services";
import type { Fuel } from "@/domain/vehicles";
import { realOrSamples, type Shown } from "@/lib/samples";

/** One sample row, in whole rupees. */
function row(serviceId: string, categoryId: string, rupees: number, fuel: Fuel | null = null): ServicePrice {
  return { serviceId, categoryId, fuel, pricePaise: rupees * 100 };
}

/** A car price for each group: [hatchback, sedan, SUV], plus diesel's when it differs. */
function carRows(serviceId: string, every: readonly number[], diesel?: readonly number[]): ServicePrice[] {
  return ["hatchback", "sedan", "suv"].flatMap((group, index) => [
    row(serviceId, group, every[index]!),
    ...(diesel ? [row(serviceId, group, diesel[index]!, "diesel")] : []),
  ]);
}

/** A two-wheeler price for each group: [scooter, motorcycle, premium motorcycle]. */
function twoWheelerRows(serviceId: string, every: readonly number[]): ServicePrice[] {
  return ["scooter", "motorcycle", "premium-motorcycle"].map((group, index) => row(serviceId, group, every[index]!));
}

/** Exported for the tests only: everything else reads selectPrices() (sample-prices.test.ts checks). */
export const samplePrices: readonly ServicePrice[] = [
  ...carRows("periodic-service", [2999, 3499, 3999], [3499, 3999, 4699]),
  ...twoWheelerRows("periodic-service", [899, 999, 1799]),
  ...carRows("ac", [1499, 1799, 2199]),
  ...carRows("battery", [499, 499, 599]),
  ...twoWheelerRows("battery", [199, 199, 299]),
  ...carRows("tyres-alignment", [699, 799, 999]),
  ...twoWheelerRows("tyres-alignment", [249, 299, 399]),
  ...carRows("brakes", [1299, 1499, 1799]),
  ...twoWheelerRows("brakes", [399, 449, 699]),
  ...carRows("wash-detailing", [799, 999, 1199]),
  ...twoWheelerRows("wash-detailing", [299, 349, 449]),
  ...carRows("car-basic", [2499, 2999, 3499], [2899, 3399, 3999]),
  ...carRows("car-standard", [3999, 4599, 5299], [4499, 5099, 5899]),
  ...carRows("car-comprehensive", [5999, 6899, 7999], [6699, 7599, 8799]),
  ...twoWheelerRows("two-wheeler-basic", [599, 699, 1299]),
  ...twoWheelerRows("two-wheeler-standard", [999, 1099, 1999]),
  ...twoWheelerRows("two-wheeler-comprehensive", [1499, 1699, 2999]),
];

/**
 * The prices to show: the real ones, else the samples under `npm run dev`,
 * else null (the page then says to call or WhatsApp for a price). Any real
 * price turns every sample off, so a page never mixes the two: the same rule
 * as the home page's samples (realOrSamples in src/lib/samples.ts).
 */
export function selectPrices(real: readonly ServicePrice[]): Shown<ServicePrice> | null {
  return realOrSamples(real, samplePrices);
}
