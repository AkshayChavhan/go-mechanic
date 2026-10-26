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
  ])("allows %s", async (_name, code) => {
    expect(await errorRules(code)).toEqual([]);
  });

  test("allows next/link in global-not-found.tsx (outside next-intl's routing)", async () => {
    const code = 'import Link from "next/link";\nexport const x = Link;\n';
    expect(await errorRules(code, "src/app/global-not-found.tsx")).toEqual([]);
  });

  test("leaves shadcn's components/ui alone", async () => {
    expect(await errorRules(component("<p>Close</p>"), "src/components/ui/example.tsx")).toEqual([]);
  });
});
