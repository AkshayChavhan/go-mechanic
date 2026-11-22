import { describe, expect, test } from "vitest";

import { BOOKING_STATUSES } from "./bookings";
import {
  canEditEstimate,
  checkEstimateLineInput,
  ESTIMATE_LINE_KINDS,
  ESTIMATE_RULES,
  type EstimateLineInput,
  estimateTotals,
} from "./estimates";
import { JOB_STATUSES } from "./jobs";
import { PRICE_RULES } from "./money";

function input(overrides: Partial<EstimateLineInput> = {}): EstimateLineInput {
  return { kind: "part", description: "Front brake pads", amount: "1,500", needed: "needed", serviceId: "", ...overrides };
}

test("the line kinds are part and labour", () => {
  expect(ESTIMATE_LINE_KINDS).toEqual(["part", "labour"]);
});

describe("checkEstimateLineInput", () => {
  test("a typed line passes, cleaned, with its amount in paise", () => {
    expect(checkEstimateLineInput(input({ kind: " labour ", description: "  Fit pads \r\n", amount: " ₹ 1,23,456 ", needed: "optional" }))).toEqual({
      ok: true,
      line: { kind: "labour", description: "Fit pads", amountPaise: 12_345_600, needed: false, serviceId: null },
    });
  });

  test("an amount with paise is refused as not whole, through task 39's parser", () => {
    expect(checkEstimateLineInput(input({ amount: "450.50" }))).toEqual({ ok: false, problems: [{ field: "amount", problem: "not-whole" }] });
  });

  test.each([
    ["0", "too-small"],
    [String(PRICE_RULES.maxPaise / 100 + 1), "too-large"],
    ["12a", "not-a-number"],
  ] as const)("the amount %s is %s", (amount, problem) => {
    expect(checkEstimateLineInput(input({ amount }))).toEqual({ ok: false, problems: [{ field: "amount", problem }] });
  });

  test("a blank description and amount are refused without a service", () => {
    expect(checkEstimateLineInput(input({ description: " \n ", amount: " " }))).toEqual({
      ok: false,
      problems: [
        { field: "description", problem: "description-missing" },
        { field: "amount", problem: "amount-missing" },
      ],
    });
  });

  test("with a service, a blank description and amount are left for the save to fill", () => {
    expect(checkEstimateLineInput(input({ description: "", amount: "", serviceId: " brakes " }))).toEqual({
      ok: true,
      line: { kind: "part", description: null, amountPaise: null, needed: true, serviceId: "brakes" },
    });
  });

  test("with a service, a typed description and amount win", () => {
    const checked = checkEstimateLineInput(input({ serviceId: "brakes", amount: "900" }));
    expect(checked.ok && checked.line).toMatchObject({ description: "Front brake pads", amountPaise: 90_000, serviceId: "brakes" });
  });

  test("the description's length counts characters: 120 emoji pass, 121 characters are too long", () => {
    expect(checkEstimateLineInput(input({ description: "🔧".repeat(ESTIMATE_RULES.descriptionMaxLength) })).ok).toBe(true);
    expect(checkEstimateLineInput(input({ description: "x".repeat(ESTIMATE_RULES.descriptionMaxLength + 1) }))).toEqual({
      ok: false,
      problems: [{ field: "description", problem: "description-too-long" }],
    });
  });

  test("a missing or unknown kind, and a missing or unknown needed choice", () => {
    expect(checkEstimateLineInput(input({ kind: "", needed: "" }))).toEqual({
      ok: false,
      problems: [
        { field: "kind", problem: "kind-missing" },
        { field: "needed", problem: "needed-missing" },
      ],
    });
    expect(checkEstimateLineInput(input({ kind: "tyre", needed: "yes" }))).toEqual({
      ok: false,
      problems: [
        { field: "kind", problem: "kind-unknown" },
        { field: "needed", problem: "needed-unknown" },
      ],
    });
  });

  test("a malformed service id is a bad request", () => {
    expect(checkEstimateLineInput(input({ serviceId: "../brakes" }))).toEqual({ ok: false, problems: [{ field: "form", problem: "bad-request" }] });
  });
});

describe("estimateTotals", () => {
  test("two needed lines and one optional line", () => {
    expect(
      estimateTotals([
        { amountPaise: 150_000, needed: true },
        { amountPaise: 50_000, needed: false },
        { amountPaise: 30_000, needed: true },
      ]),
    ).toEqual({ neededPaise: 180_000, optionalPaise: 50_000, totalPaise: 230_000 });
  });

  test("no lines add up to zero", () => {
    expect(estimateTotals([])).toEqual({ neededPaise: 0, optionalPaise: 0, totalPaise: 0 });
  });
});

describe("canEditEstimate", () => {
  test("only an active booking whose job is at inspection, in service or awaiting approval", () => {
    const allowed = new Set(["booked>inspection", "booked>in-service", "booked>awaiting-approval", "confirmed>inspection", "confirmed>in-service", "confirmed>awaiting-approval"]);
    for (const status of BOOKING_STATUSES) {
      for (const step of [null, ...JOB_STATUSES]) {
        expect(canEditEstimate(status, step), `${status} / ${step}`).toBe(allowed.has(`${status}>${step}`));
      }
    }
  });

  test.each([
    ["cancelled", "inspection"],
    ["no-show", "in-service"],
    ["booked", null],
    ["confirmed", "ready"],
    ["booked", "completed"],
  ] as const)("%s with %s is read-only", (status, step) => {
    expect(canEditEstimate(status, step)).toBe(false);
  });
});
