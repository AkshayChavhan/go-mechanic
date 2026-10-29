import { describe, expect, test } from "vitest";

import { formatRegistration, parseRegistration, STATE_CODES } from "./registration";

// Indian registration numbers, as people type them. Two shapes are accepted:
// a state series (MH 12 AB 1234) and the Bharat series (22 BH 1234 AB).

const accepted = (typed: string) => {
  const result = parseRegistration(typed);
  if (!result.ok) throw new Error(`expected ${typed} to be accepted, got ${result.problem}`);
  return result;
};

describe("parseRegistration: what people type becomes one stored form", () => {
  test.each(["mh12ab1234", "MH 12 AB 1234", "MH-12-AB-1234", "mh.12.ab.1234", " MH12AB1234 "])("%s is MH12AB1234", (typed) => {
    expect(accepted(typed).compact).toBe("MH12AB1234");
  });

  test("the number pads to four digits, so MH12AB1 and MH12AB0001 are one plate", () => {
    expect(accepted("MH12AB1").compact).toBe("MH12AB0001");
    expect(accepted("MH12AB0001").compact).toBe("MH12AB0001");
  });

  test("the RTO pads to two digits, so MH 1 AB 1234 and MH 01 AB 1234 are one plate", () => {
    expect(accepted("MH 1 AB 1234").compact).toBe("MH01AB1234");
    expect(accepted("MH 01 AB 1234").compact).toBe("MH01AB1234");
    expect(accepted("DL 3C AB 1234").compact).toBe(accepted("DL 03 CAB 1234").compact);
  });

  test.each([
    ["a one-letter series", "MH12A1234", "MH12A1234"],
    ["a three-letter Delhi series", "DL3CAB1234", "DL03CAB1234"],
    ["a one-digit RTO", "DL1CAB1234", "DL01CAB1234"],
  ])("accepts %s", (_case, typed, compact) => {
    expect(accepted(typed).compact).toBe(compact);
  });

  test.each(["OR02AB1234", "UA07AB1234", "TS09AB1234", "OD02AB1234", "UK07AB1234", "TG09AB1234", "LA01AB1234"])(
    "accepts the old and new state codes: %s",
    (typed) => {
      expect(accepted(typed).compact).toBe(typed);
    },
  );

  test.each([
    ["22BH1234AB", "22BH1234AB"],
    ["22 BH 1234 A", "22BH1234A"],
    ["21BH0001AA", "21BH0001AA"],
    ["23 bh 42 c", "23BH0042C"],
  ])("accepts the Bharat series: %s", (typed, compact) => {
    expect(accepted(typed).compact).toBe(compact);
  });

  test.each([
    ["an empty string", "", "registration-missing"],
    ["only spaces", "   ", "registration-missing"],
    ["an unknown state", "MX12AB1234", "registration-unknown-state"],
    ["no series letters", "MH121234", "registration-invalid"],
    ["the pre-1989 three-letter series", "MHF1234", "registration-invalid"],
    ["four series letters", "MH12ABCD1234", "registration-invalid"],
    ["five number digits", "MH12AB12345", "registration-invalid"],
    ["no number", "MH12AB", "registration-invalid"],
    ["a Bharat year before the series began (2021)", "20BH1234AB", "registration-invalid"],
    ["a Bharat number with five digits", "22BH12345AB", "registration-invalid"],
    ["a 21-character input", "MH 12 AB 1234 -------", "registration-invalid"],
    ["a full-width digit", "MH12AB12３4", "registration-invalid"],
    ["other characters", "MH12AB/1234", "registration-invalid"],
  ])("refuses %s", (_case, typed, problem) => {
    expect(parseRegistration(typed)).toEqual({ ok: false, problem });
  });

  test("every allowed state code is two capital letters, listed once", () => {
    expect(new Set(STATE_CODES).size).toBe(STATE_CODES.length);
    for (const code of STATE_CODES) expect(code).toMatch(/^[A-Z]{2}$/);
  });
});

describe("formatRegistration: the stored form, grouped for reading", () => {
  test.each([
    ["MH12AB1234", "MH 12 AB 1234"],
    ["DL03CAB0042", "DL 03 CAB 0042"],
    ["22BH1234AB", "22 BH 1234 AB"],
  ])("%s shows as %s", (compact, display) => {
    expect(formatRegistration(compact)).toBe(display);
    expect(accepted(compact).display).toBe(display);
  });

  test("formatting then parsing gives back the same stored form", () => {
    for (const compact of ["MH12AB1234", "DL03CAB0042", "22BH1234AB", "KA01A0007"]) {
      expect(accepted(formatRegistration(compact)).compact).toBe(compact);
    }
  });

  test("something that isn't a stored registration is shown as it is", () => {
    expect(formatRegistration("ODDVALUE")).toBe("ODDVALUE");
  });
});
