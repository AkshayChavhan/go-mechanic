// What the account's forms show: the state their Server Actions
// (src/server/actions/account.ts) return after each try, which the forms keep
// and send back. It lives here because a "use server" file may only export
// async functions, and the browser needs the initial states too.
//
// Each state carries a submission counter. The form body is keyed by it, so
// it remounts after every answer, with what was posted as its starting
// values. That keeps everything typed and picked after an error, and the
// vehicle picker can't drift from what the fields show.

import type { VehicleInput } from "@/domain/customer-vehicles";

export type NameFormState = {
  /** Goes up by one with every answer. */
  submission: number;
  /** What was typed, kept when the form comes back with an error. */
  nameTyped: string;
  /** What's wrong with the name, in the page's language. */
  error?: string;
};

export const initialNameFormState: NameFormState = { submission: 0, nameTyped: "" };

/** The add-vehicle form's fields, as posted: what checkVehicleInput checks. */
export type VehicleFormValues = VehicleInput;

/**
 * The name each field posts under. The picker (name="vehicle") posts
 * vehicleKind, vehicleMake, vehicleModel and vehicleFuel; a save reads only
 * the model and fuel, since the type and brand follow from the model.
 */
export const VEHICLE_FIELD_NAMES = {
  modelId: "vehicleModel",
  fuel: "vehicleFuel",
  registration: "registration",
  pucExpiresOn: "pucExpiresOn",
  insuranceExpiresOn: "insuranceExpiresOn",
} as const satisfies Record<keyof VehicleFormValues, string>;

/**
 * The add-vehicle form's values from what it posted, each as text ("" when
 * missing). The Server Action reads them to save, the form to keep them
 * after a failed call: one reader, so the two never disagree.
 */
export function readVehicleForm(formData: FormData): VehicleFormValues {
  const text = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : "";
  };
  return {
    modelId: text(VEHICLE_FIELD_NAMES.modelId),
    fuel: text(VEHICLE_FIELD_NAMES.fuel),
    registration: text(VEHICLE_FIELD_NAMES.registration),
    pucExpiresOn: text(VEHICLE_FIELD_NAMES.pucExpiresOn),
    insuranceExpiresOn: text(VEHICLE_FIELD_NAMES.insuranceExpiresOn),
  };
}

/**
 * The parts of the form an error can belong to: "vehicle" is the picker, and
 * "form" the whole form (a call that failed: no network).
 */
export type VehicleFormField = "vehicle" | "registration" | "pucExpiresOn" | "insuranceExpiresOn" | "form";

export type VehicleFormState = {
  /** Goes up by one with every answer. */
  submission: number;
  /** What was posted, kept when the form comes back with errors. */
  values: VehicleFormValues;
  /** What's wrong, per field, in the page's language. */
  errors: Partial<Record<VehicleFormField, string>>;
};

export const emptyVehicleFormValues: VehicleFormValues = {
  modelId: "",
  fuel: "",
  registration: "",
  pucExpiresOn: "",
  insuranceExpiresOn: "",
};

export const initialVehicleFormState: VehicleFormState = { submission: 0, values: emptyVehicleFormValues, errors: {} };
