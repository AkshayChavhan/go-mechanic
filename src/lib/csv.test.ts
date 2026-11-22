import { expect, test } from "vitest";

import { toCsv } from "./csv";

test("starts with the byte-order mark and ends every line with CRLF", () => {
  expect(toCsv([["Day", "Total"], ["2026-11-21", 3]])).toBe('﻿"Day","Total"\r\n"2026-11-21",3\r\n');
});

test("quotes text and doubles inner quotes, so commas and line breaks stay in their cell", () => {
  expect(toCsv([['Wash, "premium"\nplus']])).toBe('﻿"Wash, ""premium""\nplus"\r\n');
});

test.each([["=SUM(A1)"], ["+1"], ["-x"], ["@a"], ["\tx"], ["\rx"]])("%j can't run as a formula", (value) => {
  expect(toCsv([[value]])).toBe(`﻿"'${value}"\r\n`);
});

test("numbers stay unquoted, including a one-decimal average", () => {
  expect(toCsv([[4.5, 0, -2]])).toBe("﻿4.5,0,-2\r\n");
});

test("Hindi text is written as it is", () => {
  expect(toCsv([["ब्रेक"]])).toBe('﻿"ब्रेक"\r\n');
});
