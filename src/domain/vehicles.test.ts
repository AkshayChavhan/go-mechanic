import { describe, expect, test } from "vitest";

import {
  changeSelection,
  checkCatalogue,
  EMPTY_SELECTION,
  FUELS,
  normalizeSelection,
  resolveVehicle,
  type VehicleCatalogue,
  type VehicleSelection,
  vehicleOptions,
} from "./vehicles";

// A small catalogue with the awkward cases of the real one: Honda under both
// kinds, a model with one fuel, a model with three, an electric-only model.
const catalogue: VehicleCatalogue = {
  categories: [
    { id: "hatchback", kind: "car", name: { en: "Hatchback" } },
    { id: "sedan", kind: "car", name: { en: "Sedan" } },
    { id: "scooter", kind: "two-wheeler", name: { en: "Scooter" } },
    { id: "motorcycle", kind: "two-wheeler", name: { en: "Motorcycle" } },
  ],
  makes: [
    {
      id: "car-tata",
      kind: "car",
      name: { en: "Tata" },
      models: [
        { id: "car-tata-tiago", name: { en: "Tiago" }, categoryId: "hatchback", fuels: ["petrol", "cng", "electric"] },
      ],
    },
    {
      id: "car-honda",
      kind: "car",
      name: { en: "Honda" },
      models: [
        { id: "car-honda-city", name: { en: "City" }, categoryId: "sedan", fuels: ["petrol", "diesel"] },
        { id: "car-honda-elevate", name: { en: "Elevate" }, categoryId: "hatchback", fuels: ["petrol"] },
      ],
    },
    {
      id: "two-wheeler-honda",
      kind: "two-wheeler",
      name: { en: "Honda" },
      models: [
        { id: "two-wheeler-honda-activa", name: { en: "Activa" }, categoryId: "scooter", fuels: ["petrol"] },
        { id: "two-wheeler-honda-shine", name: { en: "Shine" }, categoryId: "motorcycle", fuels: ["petrol"] },
      ],
    },
    {
      id: "two-wheeler-ather",
      kind: "two-wheeler",
      name: { en: "Ather" },
      models: [{ id: "two-wheeler-ather-rizta", name: { en: "Rizta" }, categoryId: "scooter", fuels: ["electric"] }],
    },
  ],
};

/** The catalogue with its brands replaced. */
const withMakes = (makes: VehicleCatalogue["makes"]): VehicleCatalogue => ({ ...catalogue, makes });
const select = (changes: Partial<VehicleSelection>): VehicleSelection => ({ ...EMPTY_SELECTION, ...changes });
const ids = (rows: readonly { id: string }[]) => rows.map((row) => row.id);

describe("checkCatalogue (what must be true before a catalogue is saved)", () => {
  test("a valid catalogue has no problems", () => {
    expect(checkCatalogue(catalogue)).toEqual([]);
  });

  test("an id may only use lowercase letters, digits and single hyphens", () => {
    const [tata, ...rest] = catalogue.makes;
    const badModel = { ...tata!.models[0]!, id: "car-tata-nexon.ev" };
    expect(checkCatalogue(withMakes([{ ...tata!, models: [badModel] }, ...rest]))).toContainEqual({
      problem: "bad-id",
      id: "car-tata-nexon.ev",
    });
    const capital = { ...tata!, id: "car-Tata", models: [] };
    expect(checkCatalogue(withMakes([capital]))).toContainEqual({ problem: "bad-id", id: "car-Tata" });
    const doubleHyphen = { ...catalogue.categories[0]!, id: "hatch--back" };
    expect(checkCatalogue({ ...catalogue, categories: [doubleHyphen] })).toContainEqual({
      problem: "bad-id",
      id: "hatch--back",
    });
  });

  test("a brand id starts with its kind, so car Honda and two-wheeler Honda never clash", () => {
    const misfiled = { ...catalogue.makes[1]!, kind: "two-wheeler" as const };
    expect(checkCatalogue(withMakes([misfiled]))).toContainEqual({ problem: "make-id-prefix", id: "car-honda" });
  });

  test("a model id starts with its brand id", () => {
    const [tata, ...rest] = catalogue.makes;
    const stray = { ...tata!.models[0]!, id: "car-tiago" };
    expect(checkCatalogue(withMakes([{ ...tata!, models: [stray] }, ...rest]))).toContainEqual({
      problem: "model-id-prefix",
      id: "car-tiago",
    });
    // The brand id alone isn't a model id: something must follow it.
    const bare = { ...tata!.models[0]!, id: "car-tata-" };
    expect(checkCatalogue(withMakes([{ ...tata!, models: [bare] }]))).toContainEqual({
      problem: "bad-id",
      id: "car-tata-",
    });
  });

  test("ids are unique in each list", () => {
    const twice = [catalogue.makes[0]!, catalogue.makes[0]!];
    expect(checkCatalogue(withMakes(twice))).toContainEqual({ problem: "duplicate-id", id: "car-tata" });
    const sameGroup = [catalogue.categories[0]!, catalogue.categories[0]!];
    expect(checkCatalogue({ ...catalogue, categories: sameGroup })).toContainEqual({
      problem: "duplicate-id",
      id: "hatchback",
    });
  });

  test("a model's price group exists and has the brand's kind", () => {
    const [tata, ...rest] = catalogue.makes;
    const noGroup = { ...tata!.models[0]!, categoryId: "minivan" };
    expect(checkCatalogue(withMakes([{ ...tata!, models: [noGroup] }, ...rest]))).toContainEqual({
      problem: "unknown-category",
      id: "car-tata-tiago",
    });
    const scooterCar = { ...tata!.models[0]!, categoryId: "scooter" };
    expect(checkCatalogue(withMakes([{ ...tata!, models: [scooterCar] }, ...rest]))).toContainEqual({
      problem: "category-kind",
      id: "car-tata-tiago",
    });
  });

  test("a model runs on at least one fuel, each listed once", () => {
    const [tata, ...rest] = catalogue.makes;
    const noFuel = { ...tata!.models[0]!, fuels: [] };
    expect(checkCatalogue(withMakes([{ ...tata!, models: [noFuel] }, ...rest]))).toContainEqual({
      problem: "no-fuels",
      id: "car-tata-tiago",
    });
    const repeated = { ...tata!.models[0]!, fuels: ["petrol", "cng", "petrol"] as const };
    expect(checkCatalogue(withMakes([{ ...tata!, models: [repeated] }, ...rest]))).toContainEqual({
      problem: "repeated-fuel",
      id: "car-tata-tiago",
    });
  });

  test("every brand has at least one model", () => {
    const empty = { ...catalogue.makes[0]!, models: [] };
    expect(checkCatalogue(withMakes([empty]))).toContainEqual({ problem: "no-models", id: "car-tata" });
  });

  test("every English name is filled in", () => {
    const [tata, ...rest] = catalogue.makes;
    const blankBrand = { ...tata!, name: { en: "  " } };
    expect(checkCatalogue(withMakes([blankBrand, ...rest]))).toContainEqual({ problem: "blank-name", id: "car-tata" });
    const blankModel = { ...tata!.models[0]!, name: { en: "" } };
    expect(checkCatalogue(withMakes([{ ...tata!, models: [blankModel] }, ...rest]))).toContainEqual({
      problem: "blank-name",
      id: "car-tata-tiago",
    });
    const blankGroup = { ...catalogue.categories[0]!, name: { en: "" } };
    expect(checkCatalogue({ ...catalogue, categories: [blankGroup, ...catalogue.categories.slice(1)] })).toContainEqual({
      problem: "blank-name",
      id: "hatchback",
    });
  });
});

describe("vehicleOptions (what the picker offers for a selection)", () => {
  test("with nothing chosen, everything is offered", () => {
    const options = vehicleOptions(catalogue, EMPTY_SELECTION);
    expect(options.kinds).toEqual(["car", "two-wheeler"]);
    expect(ids(options.makes)).toEqual(["car-tata", "car-honda", "two-wheeler-honda", "two-wheeler-ather"]);
    expect(options.modelGroups.map((group) => group.make.id)).toEqual(ids(options.makes));
    expect(options.fuels).toEqual(["petrol", "diesel", "cng", "electric"]);
  });

  test("a type narrows brands, models and fuels to that type", () => {
    const options = vehicleOptions(catalogue, select({ kind: "two-wheeler" }));
    expect(ids(options.makes)).toEqual(["two-wheeler-honda", "two-wheeler-ather"]);
    expect(options.modelGroups.flatMap((group) => ids(group.models))).toEqual([
      "two-wheeler-honda-activa",
      "two-wheeler-honda-shine",
      "two-wheeler-ather-rizta",
    ]);
    // No two-wheeler here runs on diesel or CNG.
    expect(options.fuels).toEqual(["petrol", "electric"]);
  });

  test("a brand narrows the models to its own", () => {
    const options = vehicleOptions(catalogue, select({ kind: "car", makeId: "car-honda" }));
    expect(options.modelGroups.map((group) => group.make.id)).toEqual(["car-honda"]);
    expect(ids(options.modelGroups[0]!.models)).toEqual(["car-honda-city", "car-honda-elevate"]);
  });

  test("a model offers exactly its own fuels, in the usual order", () => {
    const options = vehicleOptions(catalogue, select({ kind: "car", makeId: "car-tata", modelId: "car-tata-tiago" }));
    expect(options.fuels).toEqual(["petrol", "cng", "electric"]);
  });

  test("an empty catalogue offers nothing", () => {
    const options = vehicleOptions({ categories: [], makes: [] }, EMPTY_SELECTION);
    expect(options).toEqual({ kinds: [], makes: [], modelGroups: [], fuels: [] });
  });
});

describe("changeSelection (how one choice changes the others)", () => {
  test("choosing a type clears a brand and model of the other type, and says so", () => {
    const before = normalizeSelection(catalogue, select({ modelId: "two-wheeler-honda-activa" }));
    expect(before.fuel).toBe("petrol");
    const { selection, changed } = changeSelection(catalogue, before, { field: "kind", value: "car" });
    // Cars run on petrol too, so the fuel stays.
    expect(selection).toEqual(select({ kind: "car", fuel: "petrol" }));
    expect(changed).toEqual(["make", "model"]);
  });

  test("choosing a brand sets its type and offers only its models", () => {
    const { selection, changed } = changeSelection(catalogue, EMPTY_SELECTION, {
      field: "make",
      value: "two-wheeler-honda",
    });
    expect(selection).toEqual(select({ kind: "two-wheeler", makeId: "two-wheeler-honda" }));
    expect(changed).toEqual(["kind"]);
  });

  test("choosing a model first fills in its brand and type", () => {
    const { selection, changed } = changeSelection(catalogue, EMPTY_SELECTION, {
      field: "model",
      value: "car-honda-city",
    });
    expect(selection).toEqual(select({ kind: "car", makeId: "car-honda", modelId: "car-honda-city" }));
    expect(changed).toEqual(["kind", "make"]);
  });

  test("a model with one fuel selects it; a model with three selects none", () => {
    const one = changeSelection(catalogue, EMPTY_SELECTION, { field: "model", value: "car-honda-elevate" });
    expect(one.selection.fuel).toBe("petrol");
    expect(one.changed).toContain("fuel");

    const three = changeSelection(catalogue, EMPTY_SELECTION, { field: "model", value: "car-tata-tiago" });
    expect(three.selection.fuel).toBeNull();
    expect(three.changed).not.toContain("fuel");
  });

  test("moving to an electric-only model replaces a chosen fuel it lacks", () => {
    const before = normalizeSelection(catalogue, select({ modelId: "car-honda-city", fuel: "diesel" }));
    const toActiva = changeSelection(catalogue, before, { field: "model", value: "two-wheeler-ather-rizta" });
    expect(toActiva.selection).toEqual(
      select({ kind: "two-wheeler", makeId: "two-wheeler-ather", modelId: "two-wheeler-ather-rizta", fuel: "electric" }),
    );
    expect(toActiva.changed).toEqual(["kind", "make", "fuel"]);
  });

  test("changing the brand clears a model of the old brand but keeps the type", () => {
    const before = normalizeSelection(catalogue, select({ modelId: "car-honda-city" }));
    const { selection, changed } = changeSelection(catalogue, before, { field: "make", value: "car-tata" });
    expect(selection).toEqual(select({ kind: "car", makeId: "car-tata" }));
    expect(changed).toEqual(["model"]);
  });

  test("setting the brand back to its placeholder clears the brand and model, keeps type and fuel", () => {
    const before = normalizeSelection(catalogue, select({ modelId: "car-honda-city", fuel: "diesel" }));
    const { selection, changed } = changeSelection(catalogue, before, { field: "make", value: null });
    expect(selection).toEqual(select({ kind: "car", fuel: "diesel" }));
    expect(changed).toEqual(["model"]);
  });

  test("setting the model back to its placeholder clears only the model, and every fuel is offered again", () => {
    const before = normalizeSelection(catalogue, select({ modelId: "car-honda-elevate" }));
    expect(before.fuel).toBe("petrol");
    const { selection, changed } = changeSelection(catalogue, before, { field: "model", value: null });
    expect(selection).toEqual(select({ kind: "car", makeId: "car-honda", fuel: "petrol" }));
    expect(changed).toEqual([]);
    expect(vehicleOptions(catalogue, selection).fuels).toEqual(["petrol", "diesel"]);
  });

  test("a fuel never narrows the models", () => {
    const { selection } = changeSelection(catalogue, EMPTY_SELECTION, { field: "fuel", value: "electric" });
    expect(vehicleOptions(catalogue, selection).modelGroups.flatMap((group) => ids(group.models))).toHaveLength(6);
  });

  test("a fuel the current choices don't offer is cleared", () => {
    const before = select({ fuel: "diesel" });
    const { selection, changed } = changeSelection(catalogue, before, { field: "kind", value: "two-wheeler" });
    expect(selection.fuel).toBeNull();
    expect(changed).toEqual(["fuel"]);
  });
});

describe("normalizeSelection (a saved or posted selection made consistent)", () => {
  test("a model fills in its brand, type and only fuel", () => {
    expect(normalizeSelection(catalogue, select({ modelId: "two-wheeler-honda-shine" }))).toEqual(
      select({ kind: "two-wheeler", makeId: "two-wheeler-honda", modelId: "two-wheeler-honda-shine", fuel: "petrol" }),
    );
  });

  test("ids that aren't in the catalogue are dropped", () => {
    expect(normalizeSelection(catalogue, select({ makeId: "car-ford", modelId: "car-ford-figo" }))).toEqual(
      EMPTY_SELECTION,
    );
  });

  test("a model wins over a brand that doesn't match it", () => {
    expect(normalizeSelection(catalogue, select({ kind: "car", makeId: "car-tata", modelId: "car-honda-city" }))).toEqual(
      select({ kind: "car", makeId: "car-honda", modelId: "car-honda-city" }),
    );
  });
});

describe("resolveVehicle (turning a posted model and fuel into a vehicle)", () => {
  test("a model and one of its fuels give the vehicle", () => {
    const result = resolveVehicle(catalogue, "car-honda-city", "diesel");
    expect(result.ok && result.vehicle.make.id).toBe("car-honda");
    expect(result.ok && result.vehicle.model.id).toBe("car-honda-city");
    expect(result.ok && result.vehicle.kind).toBe("car");
    expect(result.ok && result.vehicle.fuel).toBe("diesel");
  });

  test("a model that isn't in the catalogue", () => {
    expect(resolveVehicle(catalogue, "car-ford-figo", "petrol")).toEqual({ ok: false, problem: "unknown-model" });
  });

  test("a fuel the model doesn't run on", () => {
    expect(resolveVehicle(catalogue, "two-wheeler-ather-rizta", "petrol")).toEqual({
      ok: false,
      problem: "fuel-not-offered",
    });
  });
});

test("the fuels are listed in the order the picker shows them", () => {
  expect(FUELS).toEqual(["petrol", "diesel", "cng", "electric"]);
});
