// What the account's forms show: the state their Server Actions
// (src/server/actions/account.ts) return after each try, which the forms keep
// and send back. It lives here because a "use server" file may only export
// async functions, and the browser needs the initial states too.
//
// Each state carries a submission counter. The form body is keyed by it, so
// it remounts after every answer, with what was posted as its starting
// values. That keeps everything typed and picked after an error, and the
// vehicle picker can't drift from what the fields show.

export type NameFormState = {
  /** Goes up by one with every answer. */
  submission: number;
  /** What was typed, kept when the form comes back with an error. */
  nameTyped: string;
  /** What's wrong with the name, in the page's language. */
  error?: string;
};

export const initialNameFormState: NameFormState = { submission: 0, nameTyped: "" };

/** The add-vehicle form's fields, as posted (the picker's model and fuel, then the typed fields). */
export type VehicleFormValues = {
  modelId: string;
  fuel: string;
  registration: string;
  pucExpiresOn: string;
  insuranceExpiresOn: string;
};

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
