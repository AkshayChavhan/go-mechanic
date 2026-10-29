// A vehicle a customer adds to their account: the checks on what the form
// posts. Pure: the catalogue and India's today are passed in, so the
// data-access layer (src/server/dal/customer-vehicles.ts) reads them and the
// tests don't need a database or a clock.
//
// Only the posted model and fuel count (the picker also posts its kind and
// brand, which follow from the model). Expiry dates are India dates, kept as
// "YYYY-MM-DD" strings end to end, never turned into a UTC Date.

import { addYears, type IndiaDate, parseIndiaDate } from "./india-time";
import { parseRegistration, type RegistrationProblem } from "./registration";
import { FUELS, type Fuel, resolveVehicle, type VehicleCatalogue } from "./vehicles";

/** What the add form posts, as strings. An empty date means none. */
export type VehicleInput = {
  modelId: string;
  fuel: string;
  registration: string;
  pucExpiresOn: string;
  insuranceExpiresOn: string;
};

export type DateProblem = "date-invalid" | "date-out-of-range";

/** What's wrong, tagged with the field it belongs to. */
export type VehicleInputProblem =
  | { field: "vehicle"; problem: "vehicle-missing" | "vehicle-unknown-model" | "vehicle-fuel-not-offered" }
  | { field: "registration"; problem: RegistrationProblem }
  | { field: "pucExpiresOn" | "insuranceExpiresOn"; problem: DateProblem };

/** A vehicle ready to store. */
export type CheckedVehicle = {
  modelId: string;
  fuel: Fuel;
  /** The compact form: "MH12AB1234". */
  registrationNumber: string;
  pucExpiresOn: IndiaDate | null;
  insuranceExpiresOn: IndiaDate | null;
};

/** The earliest expiry date accepted. */
const EARLIEST_DATE = "2000-01-01";
/** How far ahead an expiry date may be. */
const YEARS_AHEAD = 10;

function isFuel(value: string): value is Fuel {
  return (FUELS as readonly string[]).includes(value);
}

/** An optional India date: null when empty, the date, or its problem. */
function checkDate(typed: string, latest: IndiaDate): { ok: true; date: IndiaDate | null } | { ok: false; problem: DateProblem } {
  if (typed.trim() === "") return { ok: true, date: null };
  const date = parseIndiaDate(typed.trim());
  if (!date) return { ok: false, problem: "date-invalid" };
  if (date < EARLIEST_DATE || date > latest) return { ok: false, problem: "date-out-of-range" };
  return { ok: true, date };
}

/**
 * Checks a posted vehicle against the listed catalogue and India's `today`:
 * the clean vehicle, or every problem at once. An electric vehicle has no PUC
 * (pollution) certificate, so a PUC date sent with one is dropped.
 */
export function checkVehicleInput(
  input: VehicleInput,
  catalogue: VehicleCatalogue,
  today: IndiaDate,
): { ok: true; vehicle: CheckedVehicle } | { ok: false; problems: VehicleInputProblem[] } {
  const problems: VehicleInputProblem[] = [];

  let modelId: string | null = null;
  let fuel: Fuel | null = null;
  if (input.modelId.trim() === "" || input.fuel.trim() === "") {
    problems.push({ field: "vehicle", problem: "vehicle-missing" });
  } else if (!isFuel(input.fuel)) {
    problems.push({ field: "vehicle", problem: "vehicle-fuel-not-offered" });
  } else {
    const resolved = resolveVehicle(catalogue, input.modelId, input.fuel);
    if (resolved.ok) {
      modelId = resolved.vehicle.model.id;
      fuel = resolved.vehicle.fuel;
    } else {
      problems.push({
        field: "vehicle",
        problem: resolved.problem === "unknown-model" ? "vehicle-unknown-model" : "vehicle-fuel-not-offered",
      });
    }
  }

  const registration = parseRegistration(input.registration);
  if (!registration.ok) problems.push({ field: "registration", problem: registration.problem });

  const latest = addYears(today, YEARS_AHEAD);
  const puc = checkDate(input.pucExpiresOn, latest);
  if (!puc.ok) problems.push({ field: "pucExpiresOn", problem: puc.problem });
  const insurance = checkDate(input.insuranceExpiresOn, latest);
  if (!insurance.ok) problems.push({ field: "insuranceExpiresOn", problem: insurance.problem });

  if (problems.length > 0 || !modelId || !fuel || !registration.ok || !puc.ok || !insurance.ok) {
    return { ok: false, problems };
  }
  return {
    ok: true,
    vehicle: {
      modelId,
      fuel,
      registrationNumber: registration.compact,
      pucExpiresOn: fuel === "electric" ? null : puc.date,
      insuranceExpiresOn: insurance.date,
    },
  };
}

/** Whether an expiry date has passed: it is before today in India. */
export function isExpired(date: IndiaDate, today: IndiaDate): boolean {
  return date < today;
}
