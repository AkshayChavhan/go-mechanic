// The vehicle catalogue (the kinds, price groups, brands and models the
// garage works on) and the rules of the vehicle picker.
//
// Pure logic: no Next.js, React or database imports. The database stores the
// catalogue (src/server/db/schema.ts), the data-access layer reads it
// (src/server/dal/vehicles.ts), and the picker (src/components/site/
// vehicle-picker.tsx) uses the functions below in the browser.
//
// Ids are text made from names, and they never change once saved:
// - a price group:  "hatchback"
// - a brand:        "car-honda" (its kind, then its name)
// - a model:        "car-honda-city" (its brand's id, then its name)
// Every server process seeds its own copy of the catalogue (one in-memory
// database per build worker), so random ids would differ between the page
// that shows a picker and the server that receives its form. Names can be
// corrected later; ids stay.

import type { LocalizedText } from "@/i18n/localized-text";

/** The kinds of vehicle the garage repairs. */
export const VEHICLE_KINDS = ["car", "two-wheeler"] as const;

export type VehicleKind = (typeof VEHICLE_KINDS)[number];

/**
 * What a vehicle runs on, in the order the picker lists them. Only factory
 * fuels: a strong hybrid (Hyryder, City e:HEV) counts as petrol, and an
 * aftermarket CNG kit doesn't count. An electric version sold under the same
 * name is a fuel of that model (Nexon: petrol, diesel, CNG, electric).
 */
export const FUELS = ["petrol", "diesel", "cng", "electric"] as const;

export type Fuel = (typeof FUELS)[number];

/**
 * A price group within a kind (hatchback, sedan, scooter...). Task 18 prices
 * services by group and fuel, so the owner's price list stays short. Visitors
 * never pick a group: each model belongs to one.
 */
export type VehicleCategory = {
  id: string;
  kind: VehicleKind;
  name: LocalizedText;
};

export type VehicleModel = {
  /** Its brand's id, a hyphen, then its own name: "car-honda-city". */
  id: string;
  name: LocalizedText;
  /** The price group it's charged as: "sedan". */
  categoryId: string;
  /** At least one, each once. */
  fuels: readonly Fuel[];
};

/**
 * A brand under one kind. Honda makes cars and two-wheelers, so it's two
 * brands here ("car-honda", "two-wheeler-honda"), each in its own list order.
 */
export type VehicleMake = {
  /** The kind, a hyphen, then the brand's name: "car-maruti-suzuki". */
  id: string;
  kind: VehicleKind;
  name: LocalizedText;
  /** In the order the picker lists them. */
  models: readonly VehicleModel[];
};

/**
 * The whole catalogue, every list in display order. The seed's draft file
 * (src/server/db/vehicle-seed-data.ts) and the database read have this shape.
 */
export type VehicleCatalogue = {
  categories: readonly VehicleCategory[];
  makes: readonly VehicleMake[];
};

// --- Checks ------------------------------------------------------------------

/**
 * One thing wrong with a catalogue: a code and the id of the row it's about,
 * so the admin screens (task 39) can show a message next to the right row.
 */
export type CatalogueProblem = {
  problem:
    | "bad-id"
    | "duplicate-id"
    | "make-id-prefix"
    | "model-id-prefix"
    | "unknown-category"
    | "category-kind"
    | "no-fuels"
    | "repeated-fuel"
    | "no-models"
    | "blank-name";
  id: string;
};

// Lowercase letters and digits in groups joined by single hyphens. No dots:
// ids may become page addresses, and the proxy treats a dot as a file.
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Everything wrong with `catalogue`. An empty list means it can be saved. */
export function checkCatalogue(catalogue: VehicleCatalogue): CatalogueProblem[] {
  const problems: CatalogueProblem[] = [];
  const report = (problem: CatalogueProblem["problem"], id: string) => problems.push({ problem, id });

  const seen = { category: new Set<string>(), make: new Set<string>(), model: new Set<string>() };
  const checkId = (list: keyof typeof seen, id: string) => {
    if (!ID.test(id)) report("bad-id", id);
    if (seen[list].has(id)) report("duplicate-id", id);
    seen[list].add(id);
  };
  const checkName = (name: LocalizedText, id: string) => {
    // English is required; other languages are optional (localize() falls
    // back to English).
    if (name.en.trim() === "") report("blank-name", id);
  };

  const categoryKinds = new Map<string, VehicleKind>();
  for (const category of catalogue.categories) {
    checkId("category", category.id);
    checkName(category.name, category.id);
    categoryKinds.set(category.id, category.kind);
  }

  for (const make of catalogue.makes) {
    checkId("make", make.id);
    checkName(make.name, make.id);
    if (!make.id.startsWith(`${make.kind}-`)) report("make-id-prefix", make.id);
    if (make.models.length === 0) report("no-models", make.id);

    for (const model of make.models) {
      checkId("model", model.id);
      checkName(model.name, model.id);
      const prefix = `${make.id}-`;
      if (!model.id.startsWith(prefix) || model.id.length === prefix.length) report("model-id-prefix", model.id);

      const categoryKind = categoryKinds.get(model.categoryId);
      if (categoryKind === undefined) report("unknown-category", model.id);
      else if (categoryKind !== make.kind) report("category-kind", model.id);

      if (model.fuels.length === 0) report("no-fuels", model.id);
      if (new Set(model.fuels).size !== model.fuels.length) report("repeated-fuel", model.id);
    }
  }

  return problems;
}

// --- The picker's rules ---------------------------------------------------------

/** What the picker has chosen so far. Any field may still be empty. */
export type VehicleSelection = {
  kind: VehicleKind | null;
  makeId: string | null;
  modelId: string | null;
  fuel: Fuel | null;
};

export const EMPTY_SELECTION: VehicleSelection = { kind: null, makeId: null, modelId: null, fuel: null };

/** The picker's fields, in the order a visitor fills them. */
export type VehicleField = "kind" | "make" | "model" | "fuel";

const FIELD_ORDER: readonly VehicleField[] = ["kind", "make", "model", "fuel"];

/** One choice the visitor made. `null` means they went back to "Choose...". */
export type SelectionChange =
  | { field: "kind"; value: VehicleKind | null }
  | { field: "make"; value: string | null }
  | { field: "model"; value: string | null }
  | { field: "fuel"; value: Fuel | null };

/** A model and the brand it belongs to. */
type FoundModel = { make: VehicleMake; model: VehicleModel };

function findMake(catalogue: VehicleCatalogue, id: string | null): VehicleMake | undefined {
  return id === null ? undefined : catalogue.makes.find((make) => make.id === id);
}

function findModel(catalogue: VehicleCatalogue, id: string | null): FoundModel | undefined {
  if (id === null) return undefined;
  for (const make of catalogue.makes) {
    const model = make.models.find((candidate) => candidate.id === id);
    if (model) return { make, model };
  }
  return undefined;
}

/** What the picker offers for a selection. Every list is in display order. */
export type VehicleOptions = {
  /** The kinds that have at least one brand. */
  kinds: VehicleKind[];
  /** All brands, or only those of the chosen kind. */
  makes: VehicleMake[];
  /** Models grouped by brand: all of them, or only the chosen kind's or brand's. */
  modelGroups: { make: VehicleMake; models: readonly VehicleModel[] }[];
  /** The chosen model's fuels, or every fuel the offered models run on. */
  fuels: Fuel[];
};

/**
 * What the picker offers. Every list is complete until an earlier choice
 * narrows it: no kind means every brand, no brand means every model. A fuel
 * never narrows the models: it's the last question.
 */
export function vehicleOptions(catalogue: VehicleCatalogue, selection: VehicleSelection): VehicleOptions {
  const kinds = VEHICLE_KINDS.filter((kind) => catalogue.makes.some((make) => make.kind === kind));
  const makes = catalogue.makes.filter((make) => selection.kind === null || make.kind === selection.kind);
  const modelGroups = makes
    .filter((make) => selection.makeId === null || make.id === selection.makeId)
    .map((make) => ({ make, models: make.models }))
    .filter((group) => group.models.length > 0);

  const chosen = findModel(catalogue, selection.modelId);
  const offered = new Set<Fuel>(
    chosen ? chosen.model.fuels : modelGroups.flatMap((group) => group.models.flatMap((model) => model.fuels)),
  );
  return { kinds, makes, modelGroups, fuels: FUELS.filter((fuel) => offered.has(fuel)) };
}

/**
 * Makes a selection consistent: drops ids the catalogue doesn't have, fills
 * the brand and kind in from the model (or the kind from the brand), drops a
 * later choice that doesn't fit an earlier one, and picks the fuel when the
 * model has only one. Use it on a saved or posted selection before showing it.
 */
export function normalizeSelection(catalogue: VehicleCatalogue, selection: VehicleSelection): VehicleSelection {
  const next = { ...selection };
  const found = findModel(catalogue, next.modelId);
  if (found) {
    next.makeId = found.make.id;
    next.kind = found.make.kind;
  } else {
    next.modelId = null;
    const make = findMake(catalogue, next.makeId);
    if (make) next.kind = make.kind;
    else next.makeId = null;
  }
  return settleFuel(catalogue, next);
}

/** Drops a fuel the current choices don't offer, then picks a model's only fuel. */
function settleFuel(catalogue: VehicleCatalogue, selection: VehicleSelection): VehicleSelection {
  const offered = vehicleOptions(catalogue, selection).fuels;
  const next = { ...selection };
  if (next.fuel !== null && !offered.includes(next.fuel)) next.fuel = null;
  const found = findModel(catalogue, next.modelId);
  if (found && found.model.fuels.length === 1) next.fuel = found.model.fuels[0]!;
  return next;
}

/**
 * One choice, and what it does to the others. The field the visitor changed
 * wins: a model fills in its brand and kind, a brand its kind. A later choice
 * that no longer fits is cleared. `changed` lists the other fields whose
 * value the picker changed by itself, so a screen reader can be told.
 */
export function changeSelection(
  catalogue: VehicleCatalogue,
  selection: VehicleSelection,
  change: SelectionChange,
): { selection: VehicleSelection; changed: VehicleField[] } {
  let next: VehicleSelection = { ...selection };

  switch (change.field) {
    case "kind":
      next.kind = change.value;
      break;
    case "make": {
      next.makeId = change.value;
      const make = findMake(catalogue, change.value);
      if (make) next.kind = make.kind;
      else next.makeId = null;
      break;
    }
    case "model": {
      next.modelId = change.value;
      const found = findModel(catalogue, change.value);
      if (found) {
        next.makeId = found.make.id;
        next.kind = found.make.kind;
      } else next.modelId = null;
      break;
    }
    case "fuel":
      next.fuel = change.value;
      break;
  }

  // Clear what no longer fits the earlier choices: a brand of the other kind,
  // and a model of another brand (or of no brand: going back to "Choose a
  // brand" clears the model too).
  const make = findMake(catalogue, next.makeId);
  if (make && make.kind !== next.kind) next.makeId = null;
  const found = findModel(catalogue, next.modelId);
  if (found && found.make.id !== next.makeId) next.modelId = null;

  next = settleFuel(catalogue, next);

  const changed = FIELD_ORDER.filter(
    (field) => field !== change.field && valueOf(selection, field) !== valueOf(next, field),
  );
  return { selection: next, changed };
}

function valueOf(selection: VehicleSelection, field: VehicleField): string | null {
  switch (field) {
    case "kind":
      return selection.kind;
    case "make":
      return selection.makeId;
    case "model":
      return selection.modelId;
    case "fuel":
      return selection.fuel;
  }
}

// --- Posted choices ---------------------------------------------------------------

/** A chosen vehicle: its kind, brand, model and fuel. */
export type ResolvedVehicle = {
  kind: VehicleKind;
  make: VehicleMake;
  model: VehicleModel;
  fuel: Fuel;
};

export type ResolveVehicleResult =
  | { ok: true; vehicle: ResolvedVehicle }
  | { ok: false; problem: "unknown-model" | "fuel-not-offered" };

/**
 * Turns a model id and a fuel (what the picker's form posts) into a vehicle,
 * or says what's wrong. The picker uses it to know when the choice is
 * complete; the forms of tasks 21 and 23 check a posted choice with it.
 */
export function resolveVehicle(catalogue: VehicleCatalogue, modelId: string, fuel: Fuel): ResolveVehicleResult {
  const found = findModel(catalogue, modelId);
  if (!found) return { ok: false, problem: "unknown-model" };
  if (!found.model.fuels.includes(fuel)) return { ok: false, problem: "fuel-not-offered" };
  return { ok: true, vehicle: { kind: found.make.kind, make: found.make, model: found.model, fuel } };
}
