import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import type { Role } from "@/domain/roles";
import { closeDatabase, createDatabase, type Database, getDatabase } from "@/server/db";
import { users } from "@/server/db/schema";

import { syncOwnerRole } from "./users";

// Starting PGlite (Postgres compiled to WebAssembly) and migrating it takes a
// few seconds, and much longer when the full test run shares a busy machine
// (task 14). Only the database test files get the longer limits.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

vi.mock("@/server/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/db")>()),
  getDatabase: vi.fn(),
}));

const owner = "+919764750567";
const someoneElse = "+919876543210";
let db: Database;

beforeAll(async () => {
  db = await createDatabase({ driver: "pglite", dataDir: null });
});
afterAll(async () => {
  await closeDatabase(db);
});
beforeEach(async () => {
  vi.mocked(getDatabase).mockResolvedValue(db);
  await db.delete(users);
});

async function userWith(phoneNumber: string, role: Role): Promise<string> {
  const id = `user-${phoneNumber}`;
  await db.insert(users).values({ id, name: "", email: `${phoneNumber.slice(1)}@phone.invalid`, phoneNumber, role });
  return id;
}

async function roleOf(id: string): Promise<Role | undefined> {
  const [row] = await db.select({ role: users.role }).from(users).where(eq(users.id, id));
  return row?.role;
}

describe("syncOwnerRole (the stored role, after a correct login code)", () => {
  test("a customer on the owner's number becomes the owner", async () => {
    const id = await userWith(owner, "customer");
    await syncOwnerRole(id, owner, owner);
    expect(await roleOf(id)).toBe("owner");
  });

  test("a stored owner on any other number becomes a customer (the owner's number moved)", async () => {
    const id = await userWith(someoneElse, "owner");
    await syncOwnerRole(id, someoneElse, owner);
    expect(await roleOf(id)).toBe("customer");
  });

  test("a manager on another number is left alone", async () => {
    const id = await userWith(someoneElse, "manager");
    await syncOwnerRole(id, someoneElse, owner);
    expect(await roleOf(id)).toBe("manager");
  });

  test("an unknown user changes nothing, and doesn't throw", async () => {
    await expect(syncOwnerRole("nobody", owner, owner)).resolves.toBeUndefined();
    expect(await db.$count(users)).toBe(0);
  });
});
