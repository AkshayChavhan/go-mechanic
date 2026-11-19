// What the estimate request form on /estimate shows: the state its Server
// Action (src/server/actions/estimates.ts) returns after each try, and the
// one reader of what the form posts. It lives here because a "use server"
// file may only export async functions, and the browser needs the initial
// state too (task 32).
//
// Like the account's forms (account-forms.ts), each state carries a
// submission counter: the form's fields are keyed by it, so they remount
// after every answer with what was posted as their starting values. The
// photo uploader and the request token sit outside that keyed part, so an
// error never empties the photos and a retry reuses the token.

import type { EstimateRequestInput } from "@/domain/estimate-requests";

/** The vehicle choice that means "use the picker" instead of a saved vehicle. */
export const OTHER_VEHICLE = "other";

/**
 * The name each field posts under. The picker (name="vehicle") posts
 * vehicleKind, vehicleMake, vehicleModel and vehicleFuel; a save reads only
 * the model and fuel. The photo uploader posts the set id.
 */
export const ESTIMATE_FIELD_NAMES = {
  vehicleChoice: "vehicleChoice",
  modelId: "vehicleModel",
  fuel: "vehicleFuel",
  description: "description",
  photoSetId: "photoSetId",
  requestToken: "requestToken",
} as const;

/** What the form keeps after an answer, as posted. */
export type EstimateFormValues = {
  /** A saved vehicle's id, OTHER_VEHICLE, or "" (nothing chosen, or no saved vehicles: the picker). */
  vehicleChoice: string;
  modelId: string;
  fuel: string;
  description: string;
};

export const emptyEstimateFormValues: EstimateFormValues = { vehicleChoice: "", modelId: "", fuel: "", description: "" };

/** A field's text, or "" when it's missing (or a file). */
function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/** The form's values from what it posted: the action reads them to save, the form to keep them after a failed call. */
export function readEstimateForm(formData: FormData): EstimateFormValues {
  return {
    vehicleChoice: text(formData, ESTIMATE_FIELD_NAMES.vehicleChoice),
    modelId: text(formData, ESTIMATE_FIELD_NAMES.modelId),
    fuel: text(formData, ESTIMATE_FIELD_NAMES.fuel),
    description: text(formData, ESTIMATE_FIELD_NAMES.description),
  };
}

/**
 * What the save checks. A saved vehicle's id wins; "other" or nothing
 * chosen means the picker's model and fuel.
 */
export function estimateRequestInput(formData: FormData): EstimateRequestInput {
  const values = readEstimateForm(formData);
  const choice = values.vehicleChoice.trim();
  return {
    vehicle:
      choice === "" || choice === OTHER_VEHICLE ? { modelId: values.modelId, fuel: values.fuel } : { savedVehicleId: choice },
    description: values.description,
    photoSetId: text(formData, ESTIMATE_FIELD_NAMES.photoSetId),
    requestToken: text(formData, ESTIMATE_FIELD_NAMES.requestToken),
  };
}

/** The parts of the form an error can belong to; "form" is the whole form (a failed call, the daily limit). */
export type EstimateFormField = "vehicle" | "description" | "photos" | "form";

export type EstimateFormState = {
  /** Goes up by one with every answer. */
  submission: number;
  /** What was posted, kept when the form comes back with errors. */
  values: EstimateFormValues;
  /** What's wrong, per field, in the page's language. */
  errors: Partial<Record<EstimateFormField, string>>;
};

export const initialEstimateFormState: EstimateFormState = { submission: 0, values: emptyEstimateFormValues, errors: {} };
