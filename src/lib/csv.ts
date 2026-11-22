// Writes a CSV file that Excel and Google Sheets both open correctly (task 41).
//
// - A UTF-8 byte-order mark first: without it Excel reads the file as the
//   computer's old code page and garbles any Hindi (or "₹").
// - CRLF line ends, which is what the CSV standard (RFC 4180) asks for.
// - Text is always quoted, with inner quotes doubled, so commas and line
//   breaks inside a cell stay in that cell.
// - Text that starts with = + - @, a tab or a carriage return gets a leading
//   ' : a spreadsheet would otherwise run it as a formula ("CSV injection").
//   Service names and mechanics' names are typed by staff.
// - Numbers are written as plain ASCII digits, unquoted.

const BYTE_ORDER_MARK = "﻿";
const FORMULA_START = /^[=+\-@\t\r]/;

function textCell(value: string): string {
  const safe = FORMULA_START.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

/** The CSV text for `rows` (the first row is usually the headings). */
export function toCsv(rows: readonly (readonly (string | number)[])[]): string {
  const lines = rows.map((row) => row.map((cell) => (typeof cell === "number" ? String(cell) : textCell(cell))).join(","));
  return BYTE_ORDER_MARK + lines.map((line) => `${line}\r\n`).join("");
}
