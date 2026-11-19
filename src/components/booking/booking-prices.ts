// What the booking wizard shows about prices, worked out in the browser
// with priceFor(), the same pure rule the server prices the booking with
// (src/domain/services.ts). The server never trusts these numbers: it
// prices the booking again when it saves it.

import type { LinePriceStatus } from "@/domain/bookings";
import { type PricedVehicle, priceFor, type Service, type ServicePrice } from "@/domain/services";
import { findModel, type VehicleCatalogue, type VehicleKind, type Fuel } from "@/domain/vehicles";

/** A line's price as the booking saves it: a status, and paise only for "price". */
export type LinePrice = { priceStatus: LinePriceStatus; pricePaise: number | null };

/** A service offered for the vehicle, with what it costs. */
export type OfferedService = { service: Service } & LinePrice;

/**
 * The vehicle a price is for. A model the catalogue no longer lists (hidden
 * since it was saved) has no price group: its lines then read "price
 * confirmed at the garage", which is what the server saves for them too.
 */
export function pricedVehicleOf(
  catalogue: VehicleCatalogue,
  vehicle: { kind: VehicleKind; modelId: string; fuel: Fuel },
): PricedVehicle {
  const categoryId = findModel(catalogue, vehicle.modelId)?.model.categoryId ?? "";
  return { kind: vehicle.kind, categoryId, fuel: vehicle.fuel };
}

/** The services and packages offered for `vehicle`, in the garage's order, each with its price. */
export function offeredServices(
  services: readonly Service[],
  prices: readonly ServicePrice[],
  vehicle: PricedVehicle | null,
): OfferedService[] {
  if (!vehicle) return [];
  const offered: OfferedService[] = [];
  for (const service of services) {
    const price = priceFor(service, prices, vehicle);
    if (price.status === "not-offered") continue;
    offered.push({
      service,
      priceStatus: price.status,
      pricePaise: price.status === "price" ? price.paise : null,
    });
  }
  return offered;
}

/**
 * The lines added up the way the server adds them: the priced lines only
 * (null when none has a price), and an estimate when any line has none.
 */
export function totalOf(lines: readonly LinePrice[]): { totalPaise: number | null; isEstimate: boolean } {
  const priced = lines.filter((line) => line.priceStatus === "price");
  return {
    totalPaise: priced.length === 0 ? null : priced.reduce((sum, line) => sum + (line.pricePaise ?? 0), 0),
    isEstimate: priced.length < lines.length,
  };
}
