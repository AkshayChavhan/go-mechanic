import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

import messages from "../../messages/en.json";

// The brand name lives in one place: messages/en.json (Brand.name, plus the
// page titles that mention it). Code shows it through the Wordmark component.
// So a rename means editing messages/en.json and redrawing the icon's letter,
// and nothing else. This test fails if the name is typed anywhere else.

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const name = messages.Brand.name;

/** Lower case, spaces removed: "Go Mechanic" and "GOMECHANIC" count as the name. */
const squash = (text: string) => text.toLowerCase().replace(/\s+/g, "");

/** Whether `text` mentions `brand`, whatever its case or spacing. Hyphens count. */
function mentions(text: string, brand: string): boolean {
  return squash(text).includes(squash(brand));
}

/** Every file under a folder, as paths from the repo root (none if it doesn't exist). */
function filesIn(folder: string): string[] {
  const absolute = path.join(repoRoot, folder);
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute, { recursive: true, encoding: "utf8" })
    .map((file) => path.join(folder, file))
    .filter((file) => statSync(path.join(repoRoot, file)).isFile());
}

describe("the brand name", () => {
  test("is set in messages/en.json", () => {
    expect(name.trim()).not.toBe("");
  });

  test("is found whatever its case or spacing, but not in a hyphenated slug", () => {
    expect(mentions("Welcome to go Mechanic", name)).toBe(true);
    expect(mentions(name.toUpperCase(), name)).toBe(true);
    // The repo folder and design-system/go-mechanic/ are slugs, not the name.
    expect(mentions("design-system/go-mechanic/MASTER.md", name)).toBe(false);
  });

  test("is typed in no file under src/ or public/ (tests aside)", () => {
    const files = [...filesIn("src"), ...filesIn("public")].filter((file) => !/\.test\.tsx?$/.test(file));
    expect(files.length).toBeGreaterThan(0);
    const typedIn = files.filter((file) => mentions(readFileSync(path.join(repoRoot, file), "utf8"), name));
    expect(typedIn, "use the Wordmark component or t() from messages/en.json").toEqual([]);
  });
});
