import { fileURLToPath } from "node:url";

import { ESLint } from "eslint";
import { beforeAll, describe, expect, test } from "vitest";

// Locks in the language lint guards in eslint.config.mjs: a later config
// change could quietly switch them off while `npm run lint` stays green.
// Each snippet is linted with the real config as if it were the given file
// (nothing is written to disk).

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const PAGE = "src/app/[locale]/example.tsx";

let eslint: ESLint;
beforeAll(() => {
  eslint = new ESLint({ cwd: repoRoot });
});

/** The rule ids of the errors ESLint reports for `code` in `filePath`. */
async function errorRules(code: string, filePath = PAGE): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages
    .filter((message) => message.severity === 2)
    .map((message) => message.ruleId ?? "parse error");
}

// Made-up components for snippets that use our own components' props
// (without an import, lint reports react/jsx-no-undef and an "allows" case fails).
const withDemoComponents = 'import { useTranslations } from "next-intl";\nimport { Badge, Chart, Menu } from "./demo";';

/** Wraps JSX in a small component so each snippet is a valid module. */
function component(jsx: string, imports = 'import { useTranslations } from "next-intl";') {
  return `${imports}
export function Example({ isOpen }: { isOpen: boolean }) {
  const t = useTranslations("HomePage");
  return (${jsx});
}
`;
}

describe("lint guards (eslint.config.mjs)", { timeout: 30_000 }, () => {
  test.each([
    ["next/link", 'import Link from "next/link";\nexport const x = Link;\n', "no-restricted-imports"],
    ["redirect from next/navigation", 'import { redirect } from "next/navigation";\nexport const x = redirect;\n', "no-restricted-imports"],
    ["text between tags", component("<p>Hello</p>"), "react/jsx-no-literals"],
    ["text inside a condition", component('<p>{isOpen ? "Open now" : "Closed"}</p>'), "no-restricted-syntax"],
    ["text after &&", component('<p>{isOpen && "Open now"}</p>'), "no-restricted-syntax"],
    ["a typed aria-label", component('<button aria-label="Open menu" />'), "no-restricted-syntax"],
    ["a placeholder in braces", component('<input placeholder={"Phone"} />'), "no-restricted-syntax"],
    ["text in a condition inside a condition", component('<p>{isOpen ? t("title") : isOpen === false ? "Closed today" : "Closed"}</p>'), "no-restricted-syntax"],
    ["an aria-label chosen by a condition", component('<button aria-label={isOpen ? "Close menu" : "Open menu"} />'), "no-restricted-syntax"],
    ["a typed aria-roledescription", component('<section aria-roledescription="carousel" />'), "no-restricted-syntax"],
    // Our components' label props end up as an aria-label or on screen.
    ["a typed label prop ending in Label", component('<Menu closeLabel="Close" />', withDemoComponents), "no-restricted-syntax"],
    ["a typed label prop in braces", component('<Menu openLabel={"Open the menu"} />', withDemoComponents), "no-restricted-syntax"],
    ["a label prop chosen by a condition", component('<Chart label={isOpen ? "A" : "B"} />', withDemoComponents), "no-restricted-syntax"],
  ])("rejects %s", async (_name, code, rule) => {
    expect(await errorRules(code)).toContain(rule);
  });

  test("rejects typed text in any component folder, not just a few", async () => {
    expect(await errorRules(component("<p>Hello</p>"), "src/components/booking/example.tsx")).toContain(
      "react/jsx-no-literals",
    );
  });

  test.each([
    ["notFound from next/navigation", 'import { notFound } from "next/navigation";\nexport const x = notFound;\n'],
    ["text from t()", component('<p>{t("title")}</p>')],
    ["a translated aria-label", component('<button aria-label={t("title")} />')],
    ["a className chosen by a condition", component('<p className={isOpen ? "text-green-700" : "text-red-700"}>{t("title")}</p>')],
    ["a condition between t() and nothing", component('<p>{isOpen ? t("title") : null}</p>')],
    ["numbers inside a condition", component("<p>{isOpen ? 1 : 0}</p>")],
    ["a key chosen by a condition inside t()", component('<p>{t(isOpen ? "title" : "tagline")}</p>')],
    ["non-text aria attributes", component('<button aria-hidden="true" aria-expanded={isOpen} aria-current="page" />')],
    ["a label prop from t()", component('<Menu closeLabel={t("title")} label={t("tagline")} />', withDemoComponents)],
    // Settings and ids, not text: none of these may trip the label-prop rule.
    [
      "className, aria-labelledby, htmlFor and variant",
      component(
        '<label className="type-caption" htmlFor="phone"><Badge variant="secondary" aria-labelledby="x" /></label>',
        withDemoComponents,
      ),
    ],
    ["a label prop that isn't text", component("<Chart showLabel={true} maxLabel={3} />", withDemoComponents)],
  ])("allows %s", async (_name, code) => {
    expect(await errorRules(code)).toEqual([]);
  });

  test("rejects next/link in global-not-found.tsx too (it has next-intl's provider since task 12)", async () => {
    const code = 'import Link from "next/link";\nexport const x = Link;\n';
    expect(await errorRules(code, "src/app/global-not-found.tsx")).toContain("no-restricted-imports");
  });

  test("leaves shadcn's components/ui alone", async () => {
    expect(await errorRules(component("<p>Close</p>"), "src/components/ui/example.tsx")).toEqual([]);
  });

  // Development-only pages (/dev/design...) may type demo text: devOnly()
  // makes them a 404 in production, so no visitor ever reads it.
  test.each([
    ["the dev page itself", "src/app/[locale]/dev/design/page.tsx"],
    ["a component next to a dev page", "src/app/[locale]/dev/design/_components/demo.tsx"],
  ])("allows typed text on %s", async (_name, filePath) => {
    expect(await errorRules(component('<button aria-label="Play the demo">Play</button>'), filePath)).toEqual([]);
  });

  test.each([
    ["a page whose name starts with dev", "src/app/[locale]/devices/page.tsx"],
    ["a dev folder deeper in the site", "src/app/[locale]/services/dev/page.tsx"],
  ])("still rejects typed text on %s", async (_name, filePath) => {
    expect(await errorRules(component("<p>Hello</p>"), filePath)).toContain("react/jsx-no-literals");
  });

  // Text sizes come from the type-* classes in globals.css. Tailwind puts its
  // own text-sm, text-lg... after them in the CSS, so a stock size would win
  // over a type-* class on the same element.
  test.each([
    ["a size inside cn()", 'import { cn } from "@/lib/utils";\nexport const classes = cn("text-sm", "font-bold");\n'],
    ["a size with a screen prefix", component('<p className="md:text-lg">{t("title")}</p>')],
    ["a size with a state prefix", component('<p className="hover:text-2xl">{t("title")}</p>')],
    ["a size in a template string", "export const classes = (extra: string) => `text-base ${extra}`;\n"],
    ["text-xs", component('<p className="text-xs text-muted-foreground">{t("title")}</p>')],
    ["text-9xl", component('<p className="text-9xl">{t("title")}</p>')],
  ])("rejects a stock text size: %s", async (_name, code) => {
    expect(await errorRules(code)).toContain("no-restricted-syntax");
  });

  test.each([
    ["type-* sizes", component('<p className="type-title">{t("title")}</p>')],
    ["text colours", component('<p className="text-muted-foreground hover:text-link text-white">{t("title")}</p>')],
    ["text alignment", component('<p className="text-center md:text-left">{t("title")}</p>')],
    ["text colours in cn()", 'import { cn } from "@/lib/utils";\nexport const classes = cn("text-link", "text-foreground");\n'],
  ])("allows %s", async (_name, code) => {
    expect(await errorRules(code)).toEqual([]);
  });

  // The stock-size rule also covers plain .ts files (class lists kept in
  // constants) and the dev-page catalogue, which the main text block skips.
  test.each([
    ["a .ts file (a class list in a constant)", 'export const sizes = "type-body text-sm";\n', "src/components/site/sizes.ts"],
    ["a dev page", component('<p className="text-sm">Demo</p>'), "src/app/[locale]/dev/design/page.tsx"],
  ])("rejects a stock text size in %s", async (_name, code, filePath) => {
    expect(await errorRules(code, filePath)).toContain("no-restricted-syntax");
  });

  test.each([
    ["a .ts test file", 'export const sizes = "text-sm";\n', "src/components/site/sizes.test.ts"],
    ["a .tsx test file", component('<p className="text-sm">{t("title")}</p>'), "src/components/site/sizes.test.tsx"],
  ])("leaves stock text sizes alone in %s", async (_name, code, filePath) => {
    expect(await errorRules(code, filePath)).toEqual([]);
  });

  test("leaves stock text sizes alone in shadcn's components/ui", async () => {
    const code = 'import { cn } from "cn";\nexport const classes = cn("text-sm");\n';
    expect(await errorRules(code, "src/components/ui/example.tsx")).toEqual([]);
  });

  test("still rejects next/link on dev pages", async () => {
    const code = 'import Link from "next/link";\nexport const x = Link;\n';
    expect(await errorRules(code, "src/app/[locale]/dev/design/page.tsx")).toContain("no-restricted-imports");
  });
});
