import { randomUUID } from "node:crypto";

import { and, asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import type { BookingStatus } from "@/domain/bookings";
import type { JobStatus } from "@/domain/jobs";
import { can } from "@/domain/permissions";
import type { Role } from "@/domain/roles";
import { AccessDeniedError } from "@/server/auth/access";
import { getCurrentUser } from "@/server/auth/session";
import { closeDatabase, createDatabase, type Database, getDatabase } from "@/server/db";
import { bookingEvents, bookings, estimateLines, estimates, servicePrices, users } from "@/server/db/schema";

import {
  addEstimateLine,
  readEstimateForStaff,
  removeEstimateLine,
  sendEstimate,
  startEstimateVersion,
} from "./estimates";

// Starting and migrating PGlite takes a few seconds, much longer in a full
// run on a busy machine: database test files get the longer limits.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

// A real (in-memory) database with the draft catalogue and services;
// getDatabase is swapped for it, next/cache for spies (only Next.js provides
// them), the session for a fake (the manager unless a test says otherwise),
// and `can` stays real unless a test stubs it.
vi.mock("@/server/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/db")>()),
  getDatabase: vi.fn(),
}));
vi.mock("next/cache", () => ({ cacheTag: vi.fn(), cacheLife: vi.fn(), updateTag: vi.fn() }));
vi.mock("@/server/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/domain/permissions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/domain/permissions")>();
  return { ...actual, can: vi.fn(actual.can) };
});

type TestUser = { id: string; phoneNumber: string; role: Role };
const asha: TestUser = { id: "asha", phoneNumber: "+919876500001", role: "customer" };
const mona: TestUser = { id: "mona", phoneNumber: "+919876500003", role: "mechanic" };
const manu: TestUser = { id: "manu", phoneNumber: "+919876500004", role: "manager" };
const omar: TestUser = { id: "omar", phoneNumber: "+919876500005", role: "owner" };

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

beforeEach(async () => {
  vi.clearAllMocks();
  // clearAllMocks keeps a stubbed implementation: put the real rule back.
  const permissions = await vi.importActual<typeof import("@/domain/permissions")>("@/domain/permissions");
  vi.mocked(can).mockImplementation(permissions.can);
  vi.mocked(getDatabase).mockResolvedValue(db);
  // Deleting a booking deletes its events, estimates and lines (cascade).
  await db.delete(bookings);
  await db.delete(servicePrices);
  await db.delete(users);
  await db.insert(users).values(
    [asha, mona, manu, omar].map(({ id, phoneNumber, role }) => ({
      id,
      name: id[0]!.toUpperCase() + id.slice(1),
      email: `${phoneNumber.slice(1)}@phone.invalid`,
      phoneNumber,
      role,
    })),
  );
  // A real price for brakes on a sedan (the Honda City's group), any fuel. Battery has none.
  await db.insert(servicePrices).values({ serviceId: "brakes", categoryId: "sedan", fuel: null, pricePaise: 150_000 });
  logIn(manu);
});

const unknownId = "6f1c1f0e-8a7c-4c1e-9d55-0b7a2a8c1e11";
let codes = 0;

/** A booking of Asha's (a petrol Honda City, a sedan), written straight into the table. */
async function book({ status = "confirmed" as BookingStatus, jobStatus = "inspection" as JobStatus | null } = {}) {
  codes += 1;
  const code = `K7Q4${"ABCDEFGHJKMNPQRSTUVWXYZ"[codes % 23]}${"23456789"[Math.floor(codes / 23) % 8]}`;
  const [row] = await db
    .insert(bookings)
    .values({
      code,
      userId: "asha",
      vehicleKind: "car",
      modelId: "car-honda-city",
      fuel: "petrol",
      categoryId: "sedan",
      registrationNumber: "MH12AB1234",
      startsAt: new Date("2026-11-24T04:30:00.000Z"),
      isEstimate: true,
      requestToken: randomUUID(),
      status,
      jobStatus,
    })
    .returning({ id: bookings.id });
  return { id: row!.id, code };
}

/** A typed line's form fields, with overrides. */
function lineFields(overrides: Partial<Record<"kind" | "description" | "amount" | "needed" | "serviceId", string>> = {}) {
  return { kind: "part", description: "Brake pads", amount: "1,500", needed: "needed", serviceId: "", ...overrides };
}

async function start(bookingId: string, requestToken = randomUUID()) {
  const result = await startEstimateVersion({ bookingId, requestToken });
  if (result.status !== "started") throw new Error(`expected started, got ${result.status}`);
  return result.estimateId;
}

async function add(bookingId: string, estimateId: string, overrides: Parameters<typeof lineFields>[0] = {}) {
  const result = await addEstimateLine({ bookingId, estimateId, requestToken: randomUUID(), ...lineFields(overrides) });
  if (result.status !== "added") throw new Error(`expected added, got ${result.status}`);
  return result.lineId;
}

async function revisionOf(estimateId: string) {
  const [row] = await db.select({ revision: estimates.revision }).from(estimates).where(eq(estimates.id, estimateId));
  return String(row!.revision);
}

async function send(bookingId: string, estimateId: string, requestToken = randomUUID()) {
  return sendEstimate({ bookingId, estimateId, revision: await revisionOf(estimateId), requestToken });
}

async function jobStepOf(bookingId: string) {
  const [row] = await db.select({ jobStatus: bookings.jobStatus }).from(bookings).where(eq(bookings.id, bookingId));
  return row!.jobStatus;
}

async function jobUpdatesOf(bookingId: string) {
  return db
    .select()
    .from(bookingEvents)
    .where(and(eq(bookingEvents.bookingId, bookingId), eq(bookingEvents.kind, "job-update")));
}

async function linesOf(estimateId: string) {
  return db.select().from(estimateLines).where(eq(estimateLines.estimateId, estimateId)).orderBy(asc(estimateLines.position));
}

async function versionOf(estimateId: string) {
  const [row] = await db.select().from(estimates).where(eq(estimates.id, estimateId));
  return row!;
}

describe("access", () => {
  test.each([
    ["logged out", null],
    ["a customer", asha],
    ["a mechanic", mona],
  ])("%s gets AccessDeniedError from every function before getDatabase is called", async (_, user) => {
    logIn(user);
    const ids = { bookingId: unknownId, estimateId: unknownId };
    await expect(startEstimateVersion({ bookingId: unknownId, requestToken: randomUUID() })).rejects.toBeInstanceOf(AccessDeniedError);
    await expect(addEstimateLine({ ...ids, requestToken: randomUUID(), ...lineFields() })).rejects.toBeInstanceOf(AccessDeniedError);
    await expect(removeEstimateLine({ ...ids, lineId: unknownId })).rejects.toBeInstanceOf(AccessDeniedError);
    await expect(sendEstimate({ ...ids, revision: "0", requestToken: randomUUID() })).rejects.toBeInstanceOf(AccessDeniedError);
    await expect(readEstimateForStaff(unknownId)).rejects.toBeInstanceOf(AccessDeniedError);
    expect(getDatabase).not.toHaveBeenCalled();
  });

  test("malformed ids answer not-found (or null) without a query", async () => {
    const token = randomUUID();
    expect(await startEstimateVersion({ bookingId: "nope", requestToken: token })).toEqual({ status: "not-found" });
    expect(await addEstimateLine({ bookingId: "nope", estimateId: unknownId, requestToken: token, ...lineFields() })).toEqual({
      status: "not-found",
    });
    expect(await addEstimateLine({ bookingId: unknownId, estimateId: "nope", requestToken: token, ...lineFields() })).toEqual({
      status: "not-found",
    });
    expect(await removeEstimateLine({ bookingId: unknownId, estimateId: "nope", lineId: unknownId })).toEqual({ status: "not-found" });
    expect(await sendEstimate({ bookingId: unknownId, estimateId: "nope", revision: "0", requestToken: token })).toEqual({
      status: "not-found",
    });
    expect(await readEstimateForStaff("nope")).toBeNull();
    expect(getDatabase).not.toHaveBeenCalled();
  });

  test("a bad token or revision answers problems without a query", async () => {
    expect(await startEstimateVersion({ bookingId: unknownId, requestToken: "x" })).toEqual({
      status: "problems",
      problems: [{ field: "token", problem: "bad-token" }],
    });
    expect(await sendEstimate({ bookingId: unknownId, estimateId: unknownId, revision: "one", requestToken: randomUUID() })).toEqual({
      status: "problems",
      problems: [{ field: "revision", problem: "bad-revision" }],
    });
    const added = await addEstimateLine({ bookingId: unknownId, estimateId: unknownId, requestToken: randomUUID(), ...lineFields({ amount: "" }) });
    expect(added).toEqual({ status: "problems", problems: [{ field: "amount", problem: "amount-missing" }] });
    expect(getDatabase).not.toHaveBeenCalled();
  });
});

describe("start, add and send", () => {
  test("a manager starts version 1, adds two lines and sends: the job awaits approval with one job-update event", async () => {
    const booking = await book();
    const estimateId = await start(booking.id);
    await add(booking.id, estimateId);
    await add(booking.id, estimateId, { kind: "labour", description: "Fitting", amount: "400", needed: "optional" });
    expect(await revisionOf(estimateId)).toBe("2");

    const sendToken = randomUUID();
    expect(await send(booking.id, estimateId, sendToken)).toEqual({ status: "sent", estimateId, version: 1, moved: true });
    expect(await jobStepOf(booking.id)).toBe("awaiting-approval");
    const events = await jobUpdatesOf(booking.id);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ jobStatus: "awaiting-approval", actorUserId: "manu", requestToken: sendToken });
    expect(await versionOf(estimateId)).toMatchObject({ sentBy: "manu", sendToken, supersededAt: null });
    expect((await versionOf(estimateId)).sentAt).toBeInstanceOf(Date);
    expect((await linesOf(estimateId)).map((line) => [line.position, line.description, line.amountPaise, line.needed])).toEqual([
      [0, "Brake pads", 150_000, true],
      [1, "Fitting", 40_000, false],
    ]);
  });

  test("the owner may build one too, from in service", async () => {
    logIn(omar);
    const booking = await book({ jobStatus: "in-service" });
    const estimateId = await start(booking.id);
    await add(booking.id, estimateId);
    expect(await send(booking.id, estimateId)).toMatchObject({ status: "sent", moved: true });
  });

  test("a line from a service with a real price takes that price and the service's name", async () => {
    const booking = await book();
    const estimateId = await start(booking.id);
    const lineId = await add(booking.id, estimateId, { serviceId: "brakes", description: "", amount: "" });
    const [line] = await db.select().from(estimateLines).where(eq(estimateLines.id, lineId));
    expect(line).toMatchObject({ description: "Brakes", amountPaise: 150_000, serviceId: "brakes" });
  });

  test("a service line keeps what was typed over the service's name and price", async () => {
    const booking = await book();
    const estimateId = await start(booking.id);
    const lineId = await add(booking.id, estimateId, { serviceId: "battery", description: "New battery", amount: "5,000" });
    const [line] = await db.select().from(estimateLines).where(eq(estimateLines.id, lineId));
    expect(line).toMatchObject({ description: "New battery", amountPaise: 500_000, serviceId: "battery" });
  });

  test("a service line with a blank amount and no real price answers no-price and writes nothing", async () => {
    const booking = await book();
    const estimateId = await start(booking.id);
    const result = await addEstimateLine({
      bookingId: booking.id,
      estimateId,
      requestToken: randomUUID(),
      ...lineFields({ serviceId: "battery", amount: "" }),
    });
    expect(result).toEqual({ status: "no-price" });
    expect(await linesOf(estimateId)).toEqual([]);
    expect(await revisionOf(estimateId)).toBe("0");
  });

  test("a service the garage doesn't list answers problems", async () => {
    const booking = await book();
    const estimateId = await start(booking.id);
    const result = await addEstimateLine({
      bookingId: booking.id,
      estimateId,
      requestToken: randomUUID(),
      ...lineFields({ serviceId: "no-such-service" }),
    });
    expect(result).toEqual({ status: "problems", problems: [{ field: "form", problem: "bad-request" }] });
  });

  test("the same token again answers duplicate with the first answer for start, add and send", async () => {
    const booking = await book();
    const startToken = randomUUID();
    const first = await startEstimateVersion({ bookingId: booking.id, requestToken: startToken });
    if (first.status !== "started") throw new Error("expected started");
    expect(await startEstimateVersion({ bookingId: booking.id, requestToken: startToken })).toEqual({
      status: "duplicate",
      estimateId: first.estimateId,
      version: 1,
    });

    const addInput = { bookingId: booking.id, estimateId: first.estimateId, requestToken: randomUUID(), ...lineFields() };
    const added = await addEstimateLine(addInput);
    if (added.status !== "added") throw new Error("expected added");
    expect(await addEstimateLine(addInput)).toEqual({ status: "duplicate", lineId: added.lineId });
    expect(await linesOf(first.estimateId)).toHaveLength(1);

    const sendInput = { bookingId: booking.id, estimateId: first.estimateId, revision: "1", requestToken: randomUUID() };
    expect(await sendEstimate(sendInput)).toMatchObject({ status: "sent", moved: true });
    // After its own move to awaiting approval and its own seal: still the first answer.
    expect(await sendEstimate(sendInput)).toEqual({ status: "duplicate", estimateId: first.estimateId, version: 1, moved: true });
    expect(await addEstimateLine(addInput)).toEqual({ status: "duplicate", lineId: added.lineId });
    expect(await startEstimateVersion({ bookingId: booking.id, requestToken: startToken })).toMatchObject({ status: "duplicate" });
    expect(await jobUpdatesOf(booking.id)).toHaveLength(1);
  });

  test("an add or send against a sent version answers not-a-draft and writes nothing", async () => {
    const booking = await book();
    const estimateId = await start(booking.id);
    await add(booking.id, estimateId);
    await send(booking.id, estimateId);

    const added = await addEstimateLine({ bookingId: booking.id, estimateId, requestToken: randomUUID(), ...lineFields() });
    expect(added).toEqual({ status: "not-a-draft" });
    expect(await send(booking.id, estimateId)).toEqual({ status: "not-a-draft" });
    expect(await linesOf(estimateId)).toHaveLength(1);
    expect(await jobUpdatesOf(booking.id)).toHaveLength(1);
  });

  test("send with the wrong revision answers estimate-changed; with no lines, no-lines", async () => {
    const booking = await book();
    const estimateId = await start(booking.id);
    expect(await send(booking.id, estimateId)).toEqual({ status: "no-lines" });
    await add(booking.id, estimateId);
    expect(await sendEstimate({ bookingId: booking.id, estimateId, revision: "0", requestToken: randomUUID() })).toEqual({
      status: "estimate-changed",
    });
    expect((await versionOf(estimateId)).sentAt).toBeNull();
    expect(await jobStepOf(booking.id)).toBe("inspection");
  });

  test.each([
    ["ready", "confirmed", "wrong-step"],
    ["vehicle-received", "booked", "wrong-step"],
    [null, "confirmed", "wrong-step"],
    ["inspection", "cancelled", "booking-closed"],
    ["inspection", "no-show", "booking-closed"],
  ] as const)("starting at job step %j on a %s booking answers %s", async (jobStatus, status, answer) => {
    const booking = await book({ status, jobStatus });
    expect(await startEstimateVersion({ bookingId: booking.id, requestToken: randomUUID() })).toEqual({ status: answer });
    expect(await db.select().from(estimates)).toEqual([]);
  });

  test("a draft on a booking that was cancelled since takes no line and no send", async () => {
    const booking = await book();
    const estimateId = await start(booking.id);
    const lineId = await add(booking.id, estimateId);
    await db.update(bookings).set({ status: "cancelled" }).where(eq(bookings.id, booking.id));

    expect(await addEstimateLine({ bookingId: booking.id, estimateId, requestToken: randomUUID(), ...lineFields() })).toEqual({
      status: "booking-closed",
    });
    expect(await removeEstimateLine({ bookingId: booking.id, estimateId, lineId })).toEqual({ status: "booking-closed" });
    expect(await send(booking.id, estimateId)).toEqual({ status: "booking-closed" });
  });

  test("a missing booking answers not-found", async () => {
    expect(await startEstimateVersion({ bookingId: unknownId, requestToken: randomUUID() })).toEqual({ status: "not-found" });
    expect(await sendEstimate({ bookingId: unknownId, estimateId: unknownId, revision: "0", requestToken: randomUUID() })).toEqual({
      status: "not-found",
    });
  });
});

describe("remove", () => {
  test("removing a line twice answers removed both times and bumps the revision once", async () => {
    const booking = await book();
    const estimateId = await start(booking.id);
    const lineId = await add(booking.id, estimateId);
    const input = { bookingId: booking.id, estimateId, lineId };
    expect(await removeEstimateLine(input)).toEqual({ status: "removed" });
    expect(await removeEstimateLine(input)).toEqual({ status: "removed" });
    expect(await linesOf(estimateId)).toEqual([]);
    expect(await revisionOf(estimateId)).toBe("2");
  });

  test("a remove retried after the version was sent still answers removed", async () => {
    const booking = await book();
    const estimateId = await start(booking.id);
    await add(booking.id, estimateId);
    const gone = await add(booking.id, estimateId);
    await removeEstimateLine({ bookingId: booking.id, estimateId, lineId: gone });
    await send(booking.id, estimateId);
    expect(await removeEstimateLine({ bookingId: booking.id, estimateId, lineId: gone })).toEqual({ status: "removed" });
  });

  test("a line still on a sent version answers not-a-draft and stays", async () => {
    const booking = await book();
    const estimateId = await start(booking.id);
    const lineId = await add(booking.id, estimateId);
    await send(booking.id, estimateId);
    expect(await removeEstimateLine({ bookingId: booking.id, estimateId, lineId })).toEqual({ status: "not-a-draft" });
    expect(await linesOf(estimateId)).toHaveLength(1);
  });
});

describe("ids from another booking", () => {
  test("a line or estimate of booking B, posted through booking A's bound ids, changes neither booking", async () => {
    const a = await book();
    const b = await book();
    const draftA = await start(a.id);
    const draftB = await start(b.id);
    const lineB = await add(b.id, draftB);

    // B's line under A's draft: not on that version, so already "removed"; B's line stays.
    expect(await removeEstimateLine({ bookingId: a.id, estimateId: draftA, lineId: lineB })).toEqual({ status: "removed" });
    // B's draft under A's booking: not found.
    expect(await removeEstimateLine({ bookingId: a.id, estimateId: draftB, lineId: lineB })).toEqual({ status: "not-found" });
    expect(await addEstimateLine({ bookingId: a.id, estimateId: draftB, requestToken: randomUUID(), ...lineFields() })).toEqual({
      status: "not-found",
    });
    expect(await sendEstimate({ bookingId: a.id, estimateId: draftB, revision: "1", requestToken: randomUUID() })).toEqual({
      status: "not-found",
    });

    expect(await linesOf(draftB)).toHaveLength(1);
    expect(await linesOf(draftA)).toEqual([]);
    expect(await revisionOf(draftA)).toBe("0");
    expect(await revisionOf(draftB)).toBe("1");
    expect((await versionOf(draftB)).sentAt).toBeNull();
    expect(await jobStepOf(a.id)).toBe("inspection");
    expect(await jobStepOf(b.id)).toBe("inspection");
  });
});

describe("change estimate", () => {
  test("copies the lines into version 2; version 1 stays current until version 2 is sent, which moves nothing", async () => {
    const booking = await book();
    const first = await start(booking.id);
    const pads = await add(booking.id, first);
    const fitting = await add(booking.id, first, { kind: "labour", description: "Fitting", amount: "400", needed: "optional" });
    await send(booking.id, first);

    const changeToken = randomUUID();
    const changed = await startEstimateVersion({ bookingId: booking.id, requestToken: changeToken });
    if (changed.status !== "started") throw new Error("expected started");
    expect(changed.version).toBe(2);
    const copies = await linesOf(changed.estimateId);
    expect(copies.map((line) => [line.copiedFromLineId, line.description, line.amountPaise, line.needed, line.requestToken, line.addedBy])).toEqual([
      [pads, "Brake pads", 150_000, true, null, "manu"],
      [fitting, "Fitting", 40_000, false, null, "manu"],
    ]);
    expect(await versionOf(changed.estimateId)).toMatchObject({ revision: 0, sentAt: null, createToken: changeToken });
    // The first version stays the current one.
    expect(await versionOf(first)).toMatchObject({ supersededAt: null });

    // Another Change while the draft is open opens that draft.
    expect(await startEstimateVersion({ bookingId: booking.id, requestToken: randomUUID() })).toEqual({
      status: "draft-exists",
      estimateId: changed.estimateId,
      version: 2,
    });

    await removeEstimateLine({ bookingId: booking.id, estimateId: changed.estimateId, lineId: copies[1]!.id });
    // Sent while the job awaits approval: supersedes version 1 (no constraint error), moves nothing.
    expect(await send(booking.id, changed.estimateId)).toEqual({ status: "sent", estimateId: changed.estimateId, version: 2, moved: false });
    expect((await versionOf(first)).supersededAt).toBeInstanceOf(Date);
    expect((await versionOf(changed.estimateId)).supersededAt).toBeNull();
    expect(await jobStepOf(booking.id)).toBe("awaiting-approval");
    expect(await jobUpdatesOf(booking.id)).toHaveLength(1);
    // Version 1's lines are untouched.
    expect(await linesOf(first)).toHaveLength(2);
  });

  test("a retried send of version 2 answers duplicate with moved false", async () => {
    const booking = await book();
    const first = await start(booking.id);
    await add(booking.id, first);
    await send(booking.id, first);
    const second = await start(booking.id);
    const input = { bookingId: booking.id, estimateId: second, revision: "0", requestToken: randomUUID() };
    expect(await sendEstimate(input)).toMatchObject({ status: "sent", moved: false });
    expect(await sendEstimate(input)).toEqual({ status: "duplicate", estimateId: second, version: 2, moved: false });
  });
});

describe("readEstimateForStaff", () => {
  test("a missing booking answers null", async () => {
    expect(await readEstimateForStaff(unknownId)).toBeNull();
  });

  test("the booking's copies, every version newest first with needed lines first, totals and canEdit", async () => {
    const booking = await book();
    const first = await start(booking.id);
    await add(booking.id, first, { description: "Wiper", amount: "300", needed: "optional" });
    await add(booking.id, first, { description: "Brake pads", amount: "1,500" });
    await send(booking.id, first);
    const second = await start(booking.id);

    const view = await readEstimateForStaff(booking.id);
    expect(view).toMatchObject({
      bookingId: booking.id,
      code: booking.code,
      status: "confirmed",
      jobStatus: "awaiting-approval",
      vehicle: { kind: "car", makeName: { en: "Honda" }, modelName: { en: "City" }, fuel: "petrol", registrationNumber: "MH12AB1234" },
      customerName: "Asha",
      phoneNumber: asha.phoneNumber,
      canEdit: true,
    });
    expect(view!.versions.map((version) => [version.id, version.version, version.state])).toEqual([
      [second, 2, "draft"],
      [first, 1, "sent"],
    ]);
    const sent = view!.versions[1]!;
    expect(sent.lines.map((line) => line.description)).toEqual(["Brake pads", "Wiper"]);
    expect(sent.totals).toEqual({ neededPaise: 150_000, optionalPaise: 30_000, totalPaise: 180_000 });
    expect(sent.sentBy).toEqual({ id: "manu", name: "Manu" });
    expect(view!.versions[0]!.sentBy).toBeNull();
    expect(view!.versions[0]!.lines.every((line) => line.copiedFromLineId !== null)).toBe(true);
  });

  test("without customers.contact the phone number is hidden; a closed booking reads with canEdit false", async () => {
    const booking = await book({ status: "cancelled" });
    vi.mocked(can).mockImplementation((_, permission) => permission === "estimates.manage");
    expect(await readEstimateForStaff(booking.id)).toMatchObject({ phoneNumber: null, canEdit: false, versions: [] });
  });
});
