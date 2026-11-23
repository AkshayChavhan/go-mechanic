import { describe, expect, test } from "vitest";

import {
  bookingDayReached,
  canMoveJob,
  canMoveJobFromBoard,
  isBoardJobTarget,
  canSendEstimateFrom,
  checkJobUpdateInput,
  JOB_STATUSES,
  JOB_STEPS,
  JOB_UPDATE_RULES,
  type JobStatus,
  type JobUpdateInput,
  jobStep,
} from "./jobs";

const BOOKING = "11111111-2222-4333-8444-555555555555";
const TOKEN = "3f2b8c4e-1d2a-4b6c-9e8f-0a1b2c3d4e5f";
const SET = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";

function input(overrides: Partial<JobUpdateInput> = {}): JobUpdateInput {
  return { bookingId: BOOKING, toStatus: "", note: "Front pads worn", photoSetId: "", requestToken: TOKEN, ...overrides };
}

test("the steps are Booked and then the statuses, in the customer's order", () => {
  expect(JOB_STEPS).toEqual(["booked", "vehicle-received", "inspection", "awaiting-approval", "in-service", "ready", "completed"]);
  expect(jobStep(null)).toBe("booked");
  expect(jobStep("ready")).toBe("ready");
});

describe("canMoveJob", () => {
  test.each([
    [null, "vehicle-received"],
    ["vehicle-received", "inspection"],
    ["inspection", "in-service"],
    ["inspection", "ready"],
    ["in-service", "ready"],
    ["ready", "in-service"],
    ["ready", "completed"],
  ] as const)("%s → %s is allowed", (from, to) => {
    expect(canMoveJob(from, to)).toBe(true);
  });

  test("every other move is refused, nothing reaches awaiting approval by hand, and nothing leaves completed", () => {
    const allowed = new Set(["null>vehicle-received", "vehicle-received>inspection", "inspection>in-service", "inspection>ready", "in-service>ready", "ready>in-service", "ready>completed"]);
    for (const from of [null, ...JOB_STATUSES] as (JobStatus | null)[]) {
      for (const to of JOB_STATUSES) {
        expect(canMoveJob(from, to), `${from} → ${to}`).toBe(allowed.has(`${from}>${to}`));
      }
    }
    // Only sending an estimate moves a job to awaiting approval (canSendEstimateFrom).
    expect([null, ...JOB_STATUSES].some((from) => canMoveJob(from, "awaiting-approval"))).toBe(false);
    expect(JOB_STATUSES.some((to) => canMoveJob("completed", to))).toBe(false);
  });
});

describe("bookingDayReached (owner, 2026-11-22)", () => {
  // A 10:00 India slot on 20 Nov 2026 (04:30 UTC).
  const slot = new Date("2026-11-20T04:30:00Z");

  test("false the day before, even late in the evening India time", () => {
    expect(bookingDayReached(slot, new Date("2026-11-19T18:29:00Z"))).toBe(false); // 23:59 on the 19th in India
  });

  test("true from India midnight of the slot's day (still the 19th in UTC), before the slot and after it", () => {
    expect(bookingDayReached(slot, new Date("2026-11-19T18:30:00Z"))).toBe(true); // 00:00 on the 20th in India
    expect(bookingDayReached(slot, new Date("2026-11-21T10:00:00Z"))).toBe(true);
  });
});

describe("the board's Job step control", () => {
  test("never offers completed, and vehicle received only once the booking's day has come", () => {
    expect(isBoardJobTarget("completed", { slotDayReached: true })).toBe(false);
    expect(isBoardJobTarget("vehicle-received", { slotDayReached: false })).toBe(false);
    expect(isBoardJobTarget("vehicle-received", { slotDayReached: true })).toBe(true);
    expect(isBoardJobTarget("inspection", { slotDayReached: false })).toBe(true);
  });

  test("offers the by-hand moves it may offer, from the job's step", () => {
    expect(canMoveJobFromBoard(null, "vehicle-received", { slotDayReached: true })).toBe(true);
    expect(canMoveJobFromBoard(null, "vehicle-received", { slotDayReached: false })).toBe(false);
    expect(canMoveJobFromBoard("ready", "completed", { slotDayReached: true })).toBe(false);
    expect(canMoveJobFromBoard("vehicle-received", "inspection", { slotDayReached: false })).toBe(true);
    expect(canMoveJobFromBoard(null, "inspection", { slotDayReached: true })).toBe(false);
    expect(canMoveJobFromBoard("inspection", "awaiting-approval", { slotDayReached: true })).toBe(false);
  });
});

describe("canSendEstimateFrom", () => {
  test("a send moves the job from inspection or in service only", () => {
    const from = [null, ...JOB_STATUSES].filter((step) => canSendEstimateFrom(step));
    expect(from).toEqual(["inspection", "in-service"]);
  });
});

describe("checkJobUpdateInput", () => {
  test("a note only passes, cleaned", () => {
    expect(checkJobUpdateInput(input({ note: "  Pads worn \r\nDiscs fine\u0000 \n" }))).toEqual({
      ok: true,
      update: { bookingId: BOOKING, toStatus: null, note: "Pads worn\nDiscs fine", photoSetId: null, requestToken: TOKEN },
    });
  });

  test("a move only, or photos only, passes; ids are lowercased", () => {
    const moved = checkJobUpdateInput(input({ note: "", toStatus: " inspection " }));
    expect(moved.ok && moved.update).toMatchObject({ toStatus: "inspection", note: null });
    const photos = checkJobUpdateInput(input({ note: "", photoSetId: SET.toUpperCase(), bookingId: BOOKING.toUpperCase() }));
    expect(photos.ok && photos.update).toMatchObject({ photoSetId: SET, bookingId: BOOKING, note: null, toStatus: null });
  });

  test("nothing to update", () => {
    expect(checkJobUpdateInput(input({ note: "  \n " }))).toEqual({ ok: false, problems: [{ field: "update", problem: "nothing-to-update" }] });
  });

  test("an unknown step", () => {
    expect(checkJobUpdateInput(input({ toStatus: "fixed" }))).toEqual({ ok: false, problems: [{ field: "status", problem: "status-unknown" }] });
  });

  test("the note's length counts characters: 1,000 emoji pass, 1,001 characters are too long", () => {
    expect(checkJobUpdateInput(input({ note: "🔧".repeat(JOB_UPDATE_RULES.noteMaxLength) })).ok).toBe(true);
    expect(checkJobUpdateInput(input({ note: "x".repeat(JOB_UPDATE_RULES.noteMaxLength + 1) }))).toEqual({
      ok: false,
      problems: [{ field: "note", problem: "note-too-long" }],
    });
  });

  test.each([
    [{ bookingId: "1; drop" }],
    [{ requestToken: "" }],
    [{ photoSetId: "abc" }],
  ])("an id that isn't a uuid (%o) is a bad request", (overrides) => {
    expect(checkJobUpdateInput(input(overrides))).toEqual({ ok: false, problems: [{ field: "form", problem: "bad-request" }] });
  });

  test("several problems come back together", () => {
    expect(checkJobUpdateInput(input({ toStatus: "x", note: "y".repeat(1001), requestToken: "z" }))).toEqual({
      ok: false,
      problems: [
        { field: "status", problem: "status-unknown" },
        { field: "note", problem: "note-too-long" },
        { field: "form", problem: "bad-request" },
      ],
    });
  });
});
