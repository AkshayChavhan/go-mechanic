import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import type { Role } from "@/domain/roles";
import { AccessDeniedError } from "@/server/auth/access";
import { getCurrentUser } from "@/server/auth/session";
import { closeDatabase, createDatabase, type Database, getDatabase } from "@/server/db";
import { bookings, users } from "@/server/db/schema";

import { listMechanics } from "./staff-users";

// Starting and migrating PGlite takes a few seconds, much longer in a full
// run on a busy machine: database test files get the longer limits.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

vi.mock("@/server/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/db")>()),
  getDatabase: vi.fn(),
}));
vi.mock("@/server/auth/session", () => ({ getCurrentUser: vi.fn() }));
// The owner's number, fixed here so a test can store a mechanic on it.
vi.mock("@/server/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/env")>();
  return { ...actual, serverEnv: () => ({ ...actual.parseServerEnv({}), ownerPhoneNumber: "+919876500099" }) };
});

type TestUser = { id: string; name: string; phoneNumber: string; role: Role };
const asha: TestUser = { id: "asha", name: "Asha", phoneNumber: "+919876500001", role: "customer" };
const zoya: TestUser = { id: "zoya", name: "Zoya", phoneNumber: "+919876500002", role: "mechanic" };
const mona: TestUser = { id: "mona", name: "Mona", phoneNumber: "+919876500003", role: "mechanic" };
const nameless: TestUser = { id: "nn", name: "", phoneNumber: "+919876500007", role: "mechanic" };
const manu: TestUser = { id: "manu", name: "Manu", phoneNumber: "+919876500004", role: "manager" };
const omar: TestUser = { id: "omar", name: "Omar", phoneNumber: "+919876500005", role: "owner" };
// Stored as a mechanic on the owner's number: effectiveRole makes them the owner.
const otto: TestUser = { id: "otto", name: "Otto", phoneNumber: "+919876500099", role: "mechanic" };

function logIn(user: TestUser | null) {
  vi.mocked(getCurrentUser).mockResolvedValue(user);
}

let db: Database;

beforeAll(async () => {
  db = await createDatabase({ driver: "pglite", dataDir: null });
});
afterAll(async () => {
  await closeDatabase(db);
});

async function seed(list: TestUser[]) {
  await db.insert(users).values(
    list.map(({ id, name, phoneNumber, role }) => ({ id, name, email: `${phoneNumber.slice(1)}@phone.invalid`, phoneNumber, role })),
  );
}

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(getDatabase).mockResolvedValue(db);
  await db.delete(bookings);
  await db.delete(users);
  logIn(manu);
});

describe("listMechanics", () => {
  test.each([
    ["logged out", null],
    ["a customer", asha],
    ["a mechanic", mona],
  ])("%s: refused before the database is opened", async (_label, user) => {
    logIn(user);
    await expect(listMechanics()).rejects.toBeInstanceOf(AccessDeniedError);
    expect(getDatabase).not.toHaveBeenCalled();
  });

  test("mechanics only, by name, with no phone number; not a mechanic stored on the owner's number", async () => {
    await seed([asha, zoya, mona, nameless, manu, omar, otto]);
    logIn(omar);
    expect(await listMechanics()).toEqual([
      { id: "nn", name: "" },
      { id: "mona", name: "Mona" },
      { id: "zoya", name: "Zoya" },
    ]);
  });

  test("nobody when there are no mechanics", async () => {
    await seed([asha, manu, omar, otto]);
    expect(await listMechanics()).toEqual([]);
  });
});
