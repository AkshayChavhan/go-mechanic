import { expect, test } from "vitest";

import { ownerGarage } from "@/server/db/seed-data";

import { garage } from "./garage";

// The owner's details are now checked in src/server/db/seed-data.test.ts.
// Until task 14 switches the site to the database and deletes this file, the
// site still reads garage.ts, so it must hold the same values as the seed.

test("garage.ts holds the same details as the database seed", () => {
  expect(garage).toEqual(ownerGarage);
});
