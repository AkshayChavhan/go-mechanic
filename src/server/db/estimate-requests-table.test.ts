import { eq } from "drizzle-orm";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import { ESTIMATE_REQUEST_RULES } from "@/domain/estimate-requests";

import { closeDatabase, createDatabase, type Database } from "./index";
import { customerVehicles, estimateRequests, photoSets, users } from "./schema";

// Starting PGlite (Postgres compiled to WebAssembly) and migrating it takes a
// few seconds, and much longer when the full test run shares a busy machine
// (task 14 saw the 10-second hook limit time out under load). Database test
// files get the longer limits.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

// The estimate_requests table's own rules (task 32), on a real Postgres: the
// save relies on them as a backstop.
let db: Database;

beforeAll(async () => {
  db = await createDatabase({ driver: "pglite", dataDir: null });
});
afterAll(async () => {
  await closeDatabase(db);
});

beforeEach(async () => {
  await db.delete(estimateRequests);
  await db.delete(photoSets);
  await db.delete(customerVehicles);
  await db.delete(users);
  await db.insert(users).values([
    { id: "asha", name: "Asha", email: "919876500001@phone.invalid", phoneNumber: "+919876500001" },
    { id: "ravi", name: "Ravi", email: "919876500002@phone.invalid", phoneNumber: "+919876500002" },
  ]);
});

/** The constraint a failed query broke. */
async function brokenConstraint(query: Promise<unknown>): Promise<string | undefined> {
  const error = await query.then(
    () => {
      throw new Error("expected the query to fail");
    },
    (failure: unknown) => failure,
  );
  if (!(error instanceof DrizzleQueryError)) throw error;
  return (error.cause as { constraint?: string }).constraint;
}

/** A request for a seeded Honda City on petrol, from the picker. */
function request(overrides: Partial<typeof estimateRequests.$inferInsert> = {}): typeof estimateRequests.$inferInsert {
  return {
    userId: "asha",
    vehicleKind: "car",
    modelId: "car-honda-city",
    fuel: "petrol",
    description: "Brakes squeal when I stop",
    requestToken: "6f1c2a52-6a8e-4c43-9a7e-0d4b5b1e2f30",
    ...overrides,
  };
}

describe("estimate_requests", () => {
  test("the description CHECK matches ESTIMATE_REQUEST_RULES", async () => {
    const { descriptionMinLength: min, descriptionMaxLength: max } = ESTIMATE_REQUEST_RULES;
    await db.insert(estimateRequests).values(request({ description: "x".repeat(min) }));
    await db.insert(estimateRequests).values(
      request({ description: "x".repeat(max), requestToken: "7f1c2a52-6a8e-4c43-9a7e-0d4b5b1e2f30" }),
    );
    expect(await brokenConstraint(db.insert(estimateRequests).values(request({ description: "x".repeat(min - 1) })))).toBe(
      "estimate_requests_description_length",
    );
    expect(await brokenConstraint(db.insert(estimateRequests).values(request({ description: "x".repeat(max + 1) })))).toBe(
      "estimate_requests_description_length",
    );
  });

  test("a registration number must be the compact form when set", async () => {
    expect(await brokenConstraint(db.insert(estimateRequests).values(request({ registrationNumber: "mh12ab1234" })))).toBe(
      "estimate_requests_registration_compact",
    );
  });

  test("one photo set belongs to one request", async () => {
    const [set] = await db.insert(photoSets).values({ userId: "asha" }).returning();
    await db.insert(estimateRequests).values(request({ photoSetId: set!.id }));
    expect(
      await brokenConstraint(
        db.insert(estimateRequests).values(request({ photoSetId: set!.id, requestToken: "8f1c2a52-6a8e-4c43-9a7e-0d4b5b1e2f30" })),
      ),
    ).toBe("estimate_requests_photo_set_id_unique");
  });

  test("deleting the photo set keeps the request, without photos", async () => {
    const [set] = await db.insert(photoSets).values({ userId: "asha" }).returning();
    const [saved] = await db.insert(estimateRequests).values(request({ photoSetId: set!.id })).returning();
    await db.delete(photoSets).where(eq(photoSets.id, set!.id));
    const [after] = await db.select().from(estimateRequests).where(eq(estimateRequests.id, saved!.id));
    expect(after?.photoSetId).toBeNull();
  });

  test("removing the saved vehicle keeps the request's copy", async () => {
    const [vehicle] = await db
      .insert(customerVehicles)
      .values({ userId: "asha", modelId: "car-honda-city", fuel: "petrol", registrationNumber: "MH12AB1234" })
      .returning();
    const [saved] = await db
      .insert(estimateRequests)
      .values(request({ vehicleId: vehicle!.id, registrationNumber: "MH12AB1234" }))
      .returning();
    await db.delete(customerVehicles).where(eq(customerVehicles.id, vehicle!.id));
    const [after] = await db.select().from(estimateRequests).where(eq(estimateRequests.id, saved!.id));
    expect(after).toMatchObject({ vehicleId: null, modelId: "car-honda-city", registrationNumber: "MH12AB1234" });
  });

  test("a request token is unique per customer, not across customers", async () => {
    await db.insert(estimateRequests).values(request());
    expect(await brokenConstraint(db.insert(estimateRequests).values(request()))).toBe(
      "estimate_requests_user_request_token",
    );
    await db.insert(estimateRequests).values(request({ userId: "ravi" }));
    expect(await db.select().from(estimateRequests)).toHaveLength(2);
  });

  test("a customer with a request can't be deleted (task 43 decides)", async () => {
    await db.insert(estimateRequests).values(request());
    expect(await brokenConstraint(db.delete(users).where(eq(users.id, "asha")))).toBe("estimate_requests_user_id_users_id_fk");
  });
});
