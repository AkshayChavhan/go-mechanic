import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, test, vi } from "vitest";

import { devOnly } from "@/lib/dev-only";

// What notFound() throws: Next.js shows the 404 page when it catches it.
const NOT_FOUND = "NEXT_HTTP_ERROR_FALLBACK;404";

/** The error `run` throws (fails the test if it throws nothing). */
function errorFrom(run: () => void): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error("expected an error, but nothing was thrown");
}

describe("devOnly", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("is a 404 in a production build", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(errorFrom(devOnly)).toMatchObject({ digest: NOT_FOUND });
  });

  test("is a 404 anywhere else that isn't development (here: tests)", () => {
    expect(process.env.NODE_ENV).toBe("test");
    expect(errorFrom(devOnly)).toMatchObject({ digest: NOT_FOUND });
  });

  test("lets the page render under npm run dev", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(() => devOnly()).not.toThrow();
  });
});

// The lint carve-out lets every page under src/app/<locale>/dev/ type demo
// text, but only devOnly() keeps those pages out of production. Task 15 adds
// /dev/outbox, which shows fake OTP codes: it must never render on the live site.
const appFolder = fileURLToPath(new URL("../app", import.meta.url));

/** Every page file under src/app/<locale>/dev/, as a path from src/app. */
function devPages(): string[] {
  return readdirSync(appFolder, { recursive: true, encoding: "utf8" })
    .map((file) => file.split(path.sep).join("/"))
    .filter((file) => /^[^/]+\/dev\/(?:.+\/)?page\.(?:tsx|ts|jsx|js)$/.test(file));
}

const guardedPage = "export default function Page() {\n  devOnly();\n  return null;\n}\n";
const guardedMetadata = "export function generateMetadata(): Metadata {\n  devOnly();\n  return {};\n}\n";

/** What a dev page gets wrong about calling devOnly() first. */
function devOnlyProblems(code: string): string[] {
  const problems: string[] = [];
  // "{" then devOnly(); as the first statement of the function.
  const callsFirst = (head: string) => new RegExp(`${head}\\s*\\([^)]*\\)[^{]*\\{\\s*devOnly\\(\\);`).test(code);
  if (!callsFirst("export\\s+default\\s+(?:async\\s+)?function\\s*\\w*")) problems.push("the page doesn't call devOnly() first");
  if (/export\s+const\s+metadata\b/.test(code)) problems.push("static metadata export: use generateMetadata");
  if (/export\s+(?:async\s+)?function\s+generateMetadata\b/.test(code) && !callsFirst("export\\s+(?:async\\s+)?function\\s+generateMetadata")) {
    problems.push("generateMetadata doesn't call devOnly() first");
  }
  return problems;
}

describe("development-only pages", () => {
  test("every page under src/app/*/dev/ calls devOnly()", () => {
    const pages = devPages();
    expect(pages.length).toBeGreaterThan(0); // the walk really finds pages
    const unguarded = pages.filter((file) => {
      // Comments removed, so a commented-out call doesn't count.
      const code = readFileSync(path.join(appFolder, file), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
      const imported = /import\s*\{[^}]*\bdevOnly\b[^}]*\}\s*from\s*["']@\/lib\/dev-only["']/.test(code);
      return !imported || !/\bdevOnly\(\)/.test(code);
    });
    expect(unguarded, "call devOnly() first in these pages").toEqual([]);
  });

  // The page's 404 alone isn't enough. A notFound() from the page body keeps
  // the page's own title ("Design system") on the production 404. Only a
  // notFound() thrown while Next.js works out the metadata swaps in the 404's
  // title, so dev pages put their metadata in a generateMetadata that calls
  // devOnly() first, never in a static `metadata` export.
  test("every page under src/app/*/dev/ calls devOnly() first, in the page and in generateMetadata", () => {
    const problems = devPages().flatMap((file) => {
      const code = readFileSync(path.join(appFolder, file), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
      return devOnlyProblems(code).map((problem) => `${file}: ${problem}`);
    });
    expect(problems).toEqual([]);
  });

  test.each([
    ["a guarded page with guarded metadata", guardedPage + guardedMetadata, []],
    ["a page that calls devOnly() after other code", "export default function Page() {\n  const x = 1;\n  devOnly();\n}", ["the page doesn't call devOnly() first"]],
    ["a static metadata export", guardedPage + 'export const metadata = { title: "Demo" };', ["static metadata export: use generateMetadata"]],
    ["a generateMetadata without devOnly()", guardedPage + "export function generateMetadata() {\n  return {};\n}", ["generateMetadata doesn't call devOnly() first"]],
    ["an async page and generateMetadata", "export default async function Page() {\n  devOnly();\n}\nexport async function generateMetadata(): Promise<Metadata> {\n  devOnly();\n  return {};\n}", []],
  ])("the check reads %s", (_case, code, expected) => {
    expect(devOnlyProblems(code)).toEqual(expected);
  });
});

