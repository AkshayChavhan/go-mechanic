// The vehicle catalogue every new database starts with.
//
// - The brands are the owner's: the 12 car brands and 10 two-wheeler brands
//   the garage serves, in the owner's order (given on 2026-10-28, task 17).
// - The models, their fuels and their price groups are a DRAFT written by
//   Claude on 2026-10-28, for the owner to check before task 18 shows any
//   model on a public page. It lists current models plus a few recently
//   discontinued ones still common on Pune roads (Santro, Jazz, WR-V, Polo,
//   Vento, Rapid, Micra, Sunny, older Duster), with the fuels each was sold
//   with in roughly the last ten years (a 2018 Swift diesel still comes in).
// - Fuel rules (src/domain/vehicles.ts): a strong hybrid counts as petrol; an
//   electric version sold under the same name is a fuel of that model; an
//   electric-only name is its own model.
//
// A new database gets all of this (src/server/db/seed.ts); an existing one
// gets only the rows it doesn't have yet, so the owner's later edits stay.
// The owner corrects the catalogue from the admin screens (task 39), not
// here.
//
// Plain data, with no server-only import: the unit tests and the Playwright
// tests (e2e/) import `draftCatalogue` as the values they expect on the page.

import type { Fuel, VehicleCatalogue, VehicleKind, VehicleMake } from "@/domain/vehicles";

/** One model: [its id within the brand, its name, its price group, its fuels]. */
type ModelLine = readonly [slug: string, name: string, categoryId: string, fuels: readonly Fuel[]];

/** A brand of `kind`, with ids built from the slugs: "car-honda", "car-honda-city". */
function brand(kind: VehicleKind, slug: string, name: string, models: readonly ModelLine[]): VehicleMake {
  const id = `${kind}-${slug}`;
  return {
    id,
    kind,
    name: { en: name },
    models: models.map(([modelSlug, modelName, categoryId, fuels]) => ({
      id: `${id}-${modelSlug}`,
      name: { en: modelName },
      categoryId,
      fuels,
    })),
  };
}

const P = ["petrol"] as const;
const PC = ["petrol", "cng"] as const;
const PD = ["petrol", "diesel"] as const;
const PDC = ["petrol", "diesel", "cng"] as const;
const D = ["diesel"] as const;
const E = ["electric"] as const;

export const draftCatalogue: VehicleCatalogue = {
  // Price groups (task 18 prices by group and fuel). Visitors never pick one.
  categories: [
    { id: "hatchback", kind: "car", name: { en: "Hatchback" } },
    { id: "sedan", kind: "car", name: { en: "Sedan" } },
    { id: "suv", kind: "car", name: { en: "SUV or MUV" } },
    { id: "scooter", kind: "two-wheeler", name: { en: "Scooter" } },
    { id: "motorcycle", kind: "two-wheeler", name: { en: "Motorcycle" } },
    // Royal Enfield, KTM, and other bikes of 250 cc and above.
    { id: "premium-motorcycle", kind: "two-wheeler", name: { en: "Premium motorcycle" } },
  ],

  makes: [
    // --- Cars, in the owner's order ---
    brand("car", "maruti-suzuki", "Maruti Suzuki", [
      ["alto-k10", "Alto K10", "hatchback", PC],
      ["wagon-r", "Wagon R", "hatchback", PC],
      ["celerio", "Celerio", "hatchback", PC],
      ["swift", "Swift", "hatchback", PDC],
      ["baleno", "Baleno", "hatchback", PDC],
      ["dzire", "Dzire", "sedan", PDC],
      ["brezza", "Brezza", "suv", PDC],
      ["ertiga", "Ertiga", "suv", PDC],
      ["fronx", "Fronx", "suv", PC],
      ["grand-vitara", "Grand Vitara", "suv", PC],
    ]),
    brand("car", "hyundai", "Hyundai", [
      ["grand-i10-nios", "Grand i10 Nios", "hatchback", PDC],
      ["i20", "i20", "hatchback", PD],
      ["santro", "Santro", "hatchback", PC],
      ["aura", "Aura", "sedan", PDC],
      ["verna", "Verna", "sedan", PD],
      ["exter", "Exter", "suv", PC],
      ["venue", "Venue", "suv", PD],
      ["creta", "Creta", "suv", ["petrol", "diesel", "electric"]],
      ["alcazar", "Alcazar", "suv", PD],
    ]),
    brand("car", "tata", "Tata", [
      ["tiago", "Tiago", "hatchback", ["petrol", "cng", "electric"]],
      ["altroz", "Altroz", "hatchback", PDC],
      ["tigor", "Tigor", "sedan", ["petrol", "cng", "electric"]],
      ["punch", "Punch", "suv", ["petrol", "cng", "electric"]],
      ["nexon", "Nexon", "suv", ["petrol", "diesel", "cng", "electric"]],
      ["curvv", "Curvv", "suv", ["petrol", "diesel", "electric"]],
      ["harrier", "Harrier", "suv", ["diesel", "electric"]],
      ["safari", "Safari", "suv", D],
    ]),
    brand("car", "mahindra", "Mahindra", [
      ["thar", "Thar", "suv", PD],
      ["thar-roxx", "Thar Roxx", "suv", PD],
      ["scorpio-n", "Scorpio N", "suv", PD],
      ["scorpio-classic", "Scorpio Classic", "suv", D],
      ["xuv-3xo", "XUV 3XO", "suv", PD],
      ["xuv700", "XUV700", "suv", PD],
      ["bolero", "Bolero", "suv", D],
      ["be-6", "BE 6", "suv", E],
      ["xev-9e", "XEV 9e", "suv", E],
    ]),
    brand("car", "kia", "Kia", [
      ["sonet", "Sonet", "suv", PD],
      ["seltos", "Seltos", "suv", PD],
      ["syros", "Syros", "suv", PD],
      ["carens", "Carens", "suv", PD],
      ["carnival", "Carnival", "suv", D],
    ]),
    brand("car", "toyota", "Toyota", [
      ["glanza", "Glanza", "hatchback", PC],
      ["urban-cruiser-taisor", "Urban Cruiser Taisor", "suv", PC],
      ["urban-cruiser-hyryder", "Urban Cruiser Hyryder", "suv", PC],
      ["rumion", "Rumion", "suv", PC],
      ["innova-crysta", "Innova Crysta", "suv", PD],
      ["innova-hycross", "Innova Hycross", "suv", P],
      ["fortuner", "Fortuner", "suv", PD],
    ]),
    brand("car", "honda", "Honda", [
      ["amaze", "Amaze", "sedan", PD],
      ["city", "City", "sedan", PD],
      ["elevate", "Elevate", "suv", P],
      ["jazz", "Jazz", "hatchback", PD],
      ["wr-v", "WR-V", "suv", PD],
    ]),
    brand("car", "mg", "MG", [
      ["hector", "Hector", "suv", PD],
      ["astor", "Astor", "suv", P],
      ["gloster", "Gloster", "suv", D],
      ["comet-ev", "Comet EV", "hatchback", E],
      ["zs-ev", "ZS EV", "suv", E],
      ["windsor-ev", "Windsor EV", "suv", E],
    ]),
    brand("car", "renault", "Renault", [
      ["kwid", "Kwid", "hatchback", P],
      ["triber", "Triber", "suv", P],
      ["kiger", "Kiger", "suv", P],
      ["duster", "Duster", "suv", PD],
    ]),
    brand("car", "skoda", "Skoda", [
      ["kylaq", "Kylaq", "suv", P],
      ["kushaq", "Kushaq", "suv", P],
      ["slavia", "Slavia", "sedan", P],
      ["rapid", "Rapid", "sedan", PD],
      ["octavia", "Octavia", "sedan", PD],
      ["kodiaq", "Kodiaq", "suv", PD],
    ]),
    brand("car", "volkswagen", "Volkswagen", [
      ["polo", "Polo", "hatchback", PD],
      ["vento", "Vento", "sedan", PD],
      ["virtus", "Virtus", "sedan", P],
      ["taigun", "Taigun", "suv", P],
      ["tiguan", "Tiguan", "suv", PD],
    ]),
    brand("car", "nissan", "Nissan", [
      ["magnite", "Magnite", "suv", P],
      ["kicks", "Kicks", "suv", PD],
      ["micra", "Micra", "hatchback", PD],
      ["sunny", "Sunny", "sedan", PD],
    ]),

    // --- Two-wheelers, in the owner's order ---
    brand("two-wheeler", "hero", "Hero", [
      ["splendor-plus", "Splendor Plus", "motorcycle", P],
      ["hf-deluxe", "HF Deluxe", "motorcycle", P],
      ["passion", "Passion", "motorcycle", P],
      ["glamour", "Glamour", "motorcycle", P],
      ["super-splendor", "Super Splendor", "motorcycle", P],
      ["xtreme-125r", "Xtreme 125R", "motorcycle", P],
      ["xpulse-200", "Xpulse 200", "motorcycle", P],
      ["destini-125", "Destini 125", "scooter", P],
      ["pleasure-plus", "Pleasure Plus", "scooter", P],
    ]),
    brand("two-wheeler", "honda", "Honda", [
      ["activa", "Activa", "scooter", P],
      ["dio", "Dio", "scooter", P],
      ["shine", "Shine", "motorcycle", P],
      ["sp-125", "SP 125", "motorcycle", P],
      ["unicorn", "Unicorn", "motorcycle", P],
      ["hornet-2-0", "Hornet 2.0", "motorcycle", P],
      ["hness-cb350", "H'ness CB350", "premium-motorcycle", P],
    ]),
    brand("two-wheeler", "tvs", "TVS", [
      ["jupiter", "Jupiter", "scooter", P],
      ["ntorq-125", "Ntorq 125", "scooter", P],
      ["iqube", "iQube", "scooter", E],
      ["xl100", "XL100", "motorcycle", P],
      ["raider-125", "Raider 125", "motorcycle", P],
      ["radeon", "Radeon", "motorcycle", P],
      ["apache-rtr-160", "Apache RTR 160", "motorcycle", P],
      ["apache-rtr-200", "Apache RTR 200 4V", "motorcycle", P],
    ]),
    brand("two-wheeler", "bajaj", "Bajaj", [
      ["platina", "Platina", "motorcycle", P],
      ["ct-110x", "CT 110X", "motorcycle", P],
      ["pulsar-150", "Pulsar 150", "motorcycle", P],
      ["pulsar-n160", "Pulsar N160", "motorcycle", P],
      ["pulsar-ns200", "Pulsar NS200", "motorcycle", P],
      // The first motorcycle sold with a factory CNG tank (2024).
      ["freedom-125", "Freedom 125", "motorcycle", PC],
      ["dominar-400", "Dominar 400", "premium-motorcycle", P],
      ["chetak", "Chetak", "scooter", E],
    ]),
    brand("two-wheeler", "royal-enfield", "Royal Enfield", [
      ["classic-350", "Classic 350", "premium-motorcycle", P],
      ["bullet-350", "Bullet 350", "premium-motorcycle", P],
      ["hunter-350", "Hunter 350", "premium-motorcycle", P],
      ["meteor-350", "Meteor 350", "premium-motorcycle", P],
      ["himalayan-450", "Himalayan 450", "premium-motorcycle", P],
      ["interceptor-650", "Interceptor 650", "premium-motorcycle", P],
      ["continental-gt-650", "Continental GT 650", "premium-motorcycle", P],
    ]),
    brand("two-wheeler", "yamaha", "Yamaha", [
      ["fz-s", "FZ-S", "motorcycle", P],
      ["r15", "R15", "motorcycle", P],
      ["mt-15", "MT-15", "motorcycle", P],
      ["fascino-125", "Fascino 125", "scooter", P],
      ["rayzr-125", "RayZR 125", "scooter", P],
      ["aerox-155", "Aerox 155", "scooter", P],
    ]),
    brand("two-wheeler", "suzuki", "Suzuki", [
      ["access-125", "Access 125", "scooter", P],
      ["burgman-street", "Burgman Street", "scooter", P],
      ["avenis", "Avenis", "scooter", P],
      ["gixxer", "Gixxer", "motorcycle", P],
      ["gixxer-sf-250", "Gixxer SF 250", "premium-motorcycle", P],
    ]),
    brand("two-wheeler", "ktm", "KTM", [
      ["200-duke", "200 Duke", "premium-motorcycle", P],
      ["250-duke", "250 Duke", "premium-motorcycle", P],
      ["390-duke", "390 Duke", "premium-motorcycle", P],
      ["rc-200", "RC 200", "premium-motorcycle", P],
      ["rc-390", "RC 390", "premium-motorcycle", P],
      ["390-adventure", "390 Adventure", "premium-motorcycle", P],
    ]),
    brand("two-wheeler", "ather", "Ather", [
      ["rizta", "Rizta", "scooter", E],
      ["450s", "450S", "scooter", E],
      ["450x", "450X", "scooter", E],
      ["450-apex", "450 Apex", "scooter", E],
    ]),
    brand("two-wheeler", "ola-electric", "Ola Electric", [
      ["s1-pro", "S1 Pro", "scooter", E],
      ["s1-air", "S1 Air", "scooter", E],
      ["s1-x", "S1 X", "scooter", E],
      ["roadster-x", "Roadster X", "motorcycle", E],
    ]),
  ],
};
