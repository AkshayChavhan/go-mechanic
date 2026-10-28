import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

// No database code in the JavaScript that visitors download (task 14).
//
// Pages read the garage from the database on the server. If a browser
// ("use client") component ever imported server code, Next.js would bundle
// it into the files every visitor downloads: the database driver, the table
// names, even the name of a secret. This reads every file the production
// build made for browsers (.next/static/: every chunk, not only the home
// page's) and looks for words only database code contains.
//
// Positive control: the same words must turn up in the server's own build
// output (.next/server/). Otherwise a renamed table or a minifier change
// would leave this test passing while it checks nothing.
//
// It reads files, not pages: playwright.config.ts builds the site (its
// webServer) before any test starts.

const nextFolder = path.join(__dirname, "..", ".next");

/**
 * Words that appear in database or login code and nowhere else. Matched
 * ignoring case. The login ones (task 15): a table, a setting, and the
 * Better Auth call only the login service makes. The catalogue (task 17):
 * the models table, which the browser's vehicle picker must never import.
 */
const MARKERS = [
  "garage_settings",
  "opening_hours",
  "pglite",
  "DATABASE_URL",
  "login_attempts",
  "BETTER_AUTH_SECRET",
  "sendPhoneNumberOTP",
  "vehicle_models",
];

/** Every file under a folder, as full paths. */
function filesUnder(folder: string): string[] {
  return readdirSync(folder, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(entry.parentPath, entry.name));
}

/** For each marker, the files (relative to .next/) that contain it. */
function whereMarkersAppear(files: string[]): Record<string, string[]> {
  const texts = files.map((file) => ({ file: path.relative(nextFolder, file), text: readFileSync(file, "utf8").toLowerCase() }));
  return Object.fromEntries(
    MARKERS.map((marker) => [marker, texts.filter(({ text }) => text.includes(marker.toLowerCase())).map(({ file }) => file)]),
  );
}

test("no file the browser downloads (.next/static/) contains database code", () => {
  const files = filesUnder(path.join(nextFolder, "static"));
  expect(files.filter((file) => file.endsWith(".js")).length).toBeGreaterThan(0);

  const found = whereMarkersAppear(files);
  expect(found).toEqual(Object.fromEntries(MARKERS.map((marker) => [marker, []])));
});

test("the server's JavaScript (.next/server/) does contain every marker, so the scan can find them", () => {
  // JavaScript only: the .nft.json files list node_modules/@electric-sql/pglite
  // as a path, which would make "pglite" pass without any code.
  const files = filesUnder(path.join(nextFolder, "server")).filter((file) => file.endsWith(".js"));
  const found = whereMarkersAppear(files);
  for (const marker of MARKERS) {
    expect(found[marker].length, `${marker} in .next/server/**/*.js`).toBeGreaterThan(0);
  }
});
