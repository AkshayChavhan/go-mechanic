import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

// GSAP is about 117 KB of JavaScript, and it calls Date.now() the moment it's
// imported, which would stop a page being built ahead of time if a Server
// Component pulled it in (plan KTD2). So only two kinds of file may import it:
// - scroll-scene-effects.tsx, which ScrollScene loads lazily, in the browser,
//   and only for visitors who allow motion;
// - development-only pages under src/app/<locale>/dev/ (the motion demo).
// This test reads the code under src/ and fails for any other importer. It's
// a test, not an ESLint rule: a second no-restricted-imports block would
// replace the existing one's options instead of adding to them
// (document/solutions/conventions/lint-guards-test-real-jsx-shapes.md, point 5).
//
// Test files are left out: they run in Node, never reach a page, and
// motion.test.ts uses GSAP to check our ease names.

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const src = path.join(repoRoot, "src");

/** Code files under src/, tests and type declarations left out, as paths from the repo root ("src/..."). */
function sourceFiles(): string[] {
  return readdirSync(src, { recursive: true, encoding: "utf8" })
    .map((file) => path.join("src", file).split(path.sep).join("/"))
    .filter((file) => /\.(?:ts|tsx|js|jsx|mjs)$/.test(file) && !/\.test\.[jt]sx?$|\.d\.ts$/.test(file));
}

/** Whether a file may import GSAP. */
function mayImportGsap(file: string): boolean {
  return file === "src/components/site/scroll-scene-effects.tsx" || /^src\/app\/[^/]+\/dev\//.test(file);
}

/** "gsap", "gsap/ScrollTrigger", "@gsap/react"... but not "gsap-something". */
const isGsap = (specifier: string) => /^(?:gsap|@gsap\/[^/]+)(?:\/|$)/.test(specifier);

/** Every module a file loads at run time: static imports, re-exports, import() and require(). */
function loadedModules(code: string): string[] {
  // Comments removed, so a commented-out import or one in an explanation doesn't count.
  const withoutComments = code.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  const patterns = [
    // import x from "m", import { a, b } from "m" (over several lines too),
    // export { a } from "m", export * from "m". Not `import type`: it
    // disappears from the build.
    /\b(?:import|export)\s+(?!type\s)[^;"'`]*?\bfrom\s*["']([^"']+)["']/g,
    // import "m" (only its side effects)
    /\bimport\s*["']([^"']+)["']/g,
    // import("m"), require("m")
    /\b(?:import|require)\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  return patterns.flatMap((pattern) => [...withoutComments.matchAll(pattern)].map(([, specifier]) => specifier));
}

/** The files, from those given, that import GSAP. */
function gsapImporters(files: { file: string; code: string }[]): string[] {
  return files.filter(({ code }) => loadedModules(code).some(isGsap)).map(({ file }) => file);
}

function readSourceFiles() {
  return sourceFiles().map((file) => ({ file, code: readFileSync(path.join(repoRoot, file), "utf8") }));
}

describe("only the scroll scene's effects and dev pages import GSAP", () => {
  test("the scan finds today's importers, and they're all allowed", () => {
    const importers = gsapImporters(readSourceFiles());
    // Without this, a scan that found nothing would pass the check below.
    expect(importers).toEqual(
      expect.arrayContaining([
        "src/components/site/scroll-scene-effects.tsx",
        "src/app/[locale]/dev/design/_components/motion-demo.tsx",
      ]),
    );
    expect(
      importers.filter((file) => !mayImportGsap(file)),
      "load GSAP only in scroll-scene-effects.tsx (mark the markup with scroll-scene-attributes.ts instead)",
    ).toEqual([]);
  });

  test("a component that imports GSAP is reported; the same import in a dev page isn't", () => {
    const code = 'import gsap from "gsap";\n';
    const files = [
      { file: "src/components/site/fancy-hero.tsx", code },
      { file: "src/app/[locale]/dev/fancy/page.tsx", code },
    ];
    expect(gsapImporters(files).filter((file) => !mayImportGsap(file))).toEqual(["src/components/site/fancy-hero.tsx"]);
  });

  test.each([
    ["a default import", 'import gsap from "gsap";'],
    ["a named import", 'import { gsap } from "gsap";'],
    ["a plugin", 'import { ScrollTrigger } from "gsap/ScrollTrigger";'],
    ["the React hook", 'import { useGSAP } from "@gsap/react";'],
    ["an import over several lines", 'import {\n  gsap,\n  type GSAPTween,\n} from "gsap";'],
    ["an import for its side effects", 'import "gsap/ScrollTrigger";'],
    ["a re-export", 'export { gsap } from "gsap";'],
    ["a dynamic import", 'const { gsap } = await import("gsap");'],
    ["a require", 'const gsap = require("gsap");'],
  ])("catches %s", (_case, code) => {
    expect(gsapImporters([{ file: "src/components/site/example.tsx", code }])).toEqual(["src/components/site/example.tsx"]);
  });

  test.each([
    ["a type-only import", 'import type { gsap } from "gsap";'],
    ["a commented-out import", '// import gsap from "gsap";\n/* import "gsap"; */'],
    ["a string that mentions it", 'const note = "made with gsap";'],
    ["a package whose name starts the same", 'import x from "gsap-lite";'],
    ["the scroll scene's own modules", 'import { sceneMark } from "@/components/site/scroll-scene-attributes";'],
  ])("ignores %s", (_case, code) => {
    expect(gsapImporters([{ file: "src/components/site/example.tsx", code }])).toEqual([]);
  });
});
