import { describe, expect, test } from "vitest";

import { checkName, needsName, normalizeName } from "./profile";

describe("normalizeName", () => {
  test("trims and collapses spaces", () => {
    expect(normalizeName("  asha   patil ")).toBe("asha patil");
  });
});

describe("checkName (the name a customer gives once)", () => {
  test.each([["asha patil"], ["आशा पाटिल"], ["R. K. D'Souza"], ["Anne-Marie"], ["O’Brien"], ["Li"]])("accepts %s", (name) => {
    expect(checkName(name)).toEqual({ ok: true, name: normalizeName(name) });
  });

  test.each([
    ["an empty name", "", "name-missing"],
    ["only spaces", "   ", "name-missing"],
    ["one letter", "A", "name-too-short"],
    ["61 characters", "a".repeat(61), "name-too-long"],
    ["only digits", "1234", "name-invalid"],
    ["a digit inside", "Asha2", "name-invalid"],
    ["no letter at all", ". - '", "name-invalid"],
    ["an emoji", "Asha 🙂", "name-invalid"],
  ])("refuses %s", (_case, name, problem) => {
    expect(checkName(name)).toEqual({ ok: false, problem });
  });

  test("60 characters is the longest accepted", () => {
    expect(checkName("a".repeat(60)).ok).toBe(true);
  });
});

describe("needsName", () => {
  test("true for an empty or blank name, false once one is saved", () => {
    expect(needsName({ name: "" })).toBe(true);
    expect(needsName({ name: "   " })).toBe(true);
    expect(needsName({ name: "Asha Patil" })).toBe(false);
  });
});
