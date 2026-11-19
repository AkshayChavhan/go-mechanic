// A customer's request for a free estimate (task 32): which vehicle, what's
// wrong, and an optional set of photos.
//
// Pure logic: no Next.js, React or database imports. The data-access save
// (src/server/dal/estimate-requests.ts) checks what the form posts with
// checkEstimateRequestInput(), then checks against the database what only
// it can know: that a saved vehicle is the customer's, that a typed model is
// listed, and that the photo set is theirs and unused.

import { isUuid } from "./ids";
import { type Fuel, isFuel } from "./vehicles";

/** The limits on a request. The per-day number is a placeholder the owner may change. */
export const ESTIMATE_REQUEST_RULES = {
  /** Characters, after trimming. */
  descriptionMinLength: 10,
  descriptionMaxLength: 1000,
  /** Requests one customer may send in any 24 hours. */
  maxPerDay: 3,
} as const;

/** The vehicle: one the customer saved, or one chosen with the vehicle picker (no registration). */
export type EstimateVehicleInput = { savedVehicleId: string } | { modelId: string; fuel: string };

/** What the form posts, as strings. */
export type EstimateRequestInput = {
  vehicle: EstimateVehicleInput;
  description: string;
  /** The photo set's id from the uploader's hidden field; blank for no photos. */
  photoSetId: string;
  /** A random uuid per visit of the form, so a second send makes no second request. */
  requestToken: string;
};

/** What's wrong, tagged with the part of the form it belongs to. */
export type EstimateRequestInputProblem =
  | { field: "vehicle"; problem: "vehicle-missing" | "vehicle-fuel-not-offered" }
  | { field: "description"; problem: "description-missing" | "description-too-short" | "description-too-long" }
  | { field: "photos"; problem: "photos-not-found" }
  | { field: "form"; problem: "bad-request" };

/** The vehicle after the check: whether a saved one is the customer's is the save's check. */
export type CheckedEstimateVehicle = { saved: true; vehicleId: string } | { saved: false; modelId: string; fuel: Fuel };

export type CheckedEstimateRequest = {
  vehicle: CheckedEstimateVehicle;
  description: string;
  /** Null for no photos. */
  photoSetId: string | null;
  /** Lowercase, so the same token typed two ways is one token. */
  requestToken: string;
};

/**
 * The description as stored: trimmed, Windows line breaks made plain, and
 * spaces at the end of each line removed. Line breaks inside are kept: a
 * customer may list symptoms one per line.
 */
export function normalizeDescription(typed: string): string {
  return typed
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

function checkVehicle(
  vehicle: EstimateVehicleInput,
  problems: EstimateRequestInputProblem[],
): CheckedEstimateVehicle | null {
  if ("savedVehicleId" in vehicle) {
    const id = vehicle.savedVehicleId.trim();
    if (id === "") {
      problems.push({ field: "vehicle", problem: "vehicle-missing" });
      return null;
    }
    return { saved: true, vehicleId: id };
  }
  const modelId = vehicle.modelId.trim();
  const fuel = vehicle.fuel.trim();
  if (modelId === "" || fuel === "") {
    problems.push({ field: "vehicle", problem: "vehicle-missing" });
    return null;
  }
  if (!isFuel(fuel)) {
    problems.push({ field: "vehicle", problem: "vehicle-fuel-not-offered" });
    return null;
  }
  return { saved: false, modelId, fuel };
}

/**
 * The request to store, or every problem with it. Lengths count characters,
 * not bytes, so an emoji counts once.
 */
export function checkEstimateRequestInput(
  input: EstimateRequestInput,
): { ok: true; request: CheckedEstimateRequest } | { ok: false; problems: EstimateRequestInputProblem[] } {
  const problems: EstimateRequestInputProblem[] = [];
  const vehicle = checkVehicle(input.vehicle, problems);

  const description = normalizeDescription(input.description);
  const length = [...description].length;
  if (length === 0) problems.push({ field: "description", problem: "description-missing" });
  else if (length < ESTIMATE_REQUEST_RULES.descriptionMinLength) problems.push({ field: "description", problem: "description-too-short" });
  else if (length > ESTIMATE_REQUEST_RULES.descriptionMaxLength) problems.push({ field: "description", problem: "description-too-long" });

  const photoSetId = input.photoSetId.trim();
  if (photoSetId !== "" && !isUuid(photoSetId)) problems.push({ field: "photos", problem: "photos-not-found" });

  const requestToken = input.requestToken.trim();
  if (!isUuid(requestToken)) problems.push({ field: "form", problem: "bad-request" });

  if (problems.length > 0 || !vehicle) return { ok: false, problems };
  return {
    ok: true,
    request: {
      vehicle,
      description,
      photoSetId: photoSetId === "" ? null : photoSetId.toLowerCase(),
      requestToken: requestToken.toLowerCase(),
    },
  };
}
