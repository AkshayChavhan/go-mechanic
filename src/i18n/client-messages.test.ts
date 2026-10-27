import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

import messages from "../../messages/en.json";

import { clientNamespaces, pickClientMessages } from "./client-messages";

// The browser only gets the message namespaces in clientNamespaces. If a
// client component asks for any other namespace, it shows the raw key (and
// logs an error) instead of the text. So this test reads the code: every
// "use client" file, and every src/ module it imports, must only ask for
// listed namespaces.

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const src = path.join(repoRoot, "src");

/** Every source file under src/, tests and type declarations left out. */
function sourceFiles(): string[] {
  return readdirSync(src, { recursive: true, encoding: "utf8" })
    .filter((file) => /\.(ts|tsx)$/.test(file) && !/\.test\.tsx?$|\.d\.ts$/.test(file))
    .map((file) => path.join(src, file));
}

/** Whether a file starts with the "use client" directive (comments before it allowed). */
function isClientFile(code: string): boolean {
  const withoutLeadingComments = code.replace(/^(?:\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*/, "");
  return /^["']use client["']/.test(withoutLeadingComments);
}

/** The src/ files a module imports (not `import type`, which disappears from the build). */
function importedSourceFiles(file: string, code: string): string[] {
  const specifiers = [...code.matchAll(/^\s*(?:import|export)\s+(?!type\b)[^;]*?from\s+["']([^"']+)["']/gm)].map(
    ([, specifier]) => specifier,
  );
  return specifiers.flatMap((specifier) => {
    const base = specifier.startsWith("@/")
      ? path.join(src, specifier.slice(2))
      : specifier.startsWith(".")
        ? path.resolve(path.dirname(file), specifier)
        : null; // a package, not our code
    if (!base) return [];
    const found = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]
      .map((ending) => base + ending)
      .find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
    return found ? [found] : [];
  });
}

/** Every client file plus everything it imports from src/, followed all the way down. */
function clientModules(): string[] {
  const seen = new Set<string>();
  const queue = sourceFiles().filter((file) => isClientFile(readFileSync(file, "utf8")));
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    queue.push(...importedSourceFiles(file, readFileSync(file, "utf8")));
  }
  return [...seen];
}

/**
 * What a module asks useTranslations for: the top-level namespace
 * ("OpenStatus" for useTranslations("OpenStatus.badge")), or null for a call
 * without a plain text namespace (no argument, or a variable). Null is always
 * a problem: the whole messages file would have to be sent to the browser.
 */
function requestedNamespaces(code: string): (string | null)[] {
  return [...code.matchAll(/\buseTranslations\s*\(([^)]*)\)/g)].map(([, argument]) => {
    const literal = /^\s*["'`]([^"'`$]+)["'`]\s*$/.exec(argument);
    return literal ? literal[1].split(".")[0] : null;
  });
}

/** Each module (path and code) that asks for a namespace the browser doesn't get. */
function problems(modules: { file: string; code: string }[], listed: readonly string[]) {
  return modules.flatMap(({ file, code }) =>
    requestedNamespaces(code)
      .filter((namespace) => namespace === null || !listed.includes(namespace))
      .map((namespace) => ({ file, namespace })),
  );
}

/** The client modules, read from disk, with paths from the repo root. */
function readClientModules() {
  return clientModules().map((file) => ({ file: path.relative(repoRoot, file), code: readFileSync(file, "utf8") }));
}

describe("pickClientMessages", () => {
  test("returns exactly the listed namespaces, unchanged", () => {
    const picked = pickClientMessages(messages);
    expect(Object.keys(picked).sort()).toEqual([...clientNamespaces].sort());
    for (const namespace of clientNamespaces) expect(picked[namespace]).toEqual(messages[namespace]);
  });

  test("leaves out the rest (the home page's and the metadata's text stay on the server)", () => {
    const picked = pickClientMessages(messages) as Record<string, unknown>;
    expect(picked.HomePage).toBeUndefined();
    expect(picked.Metadata).toBeUndefined();
  });
});

describe("client components only ask for namespaces the browser gets", () => {
  test("the scan finds the client code (open-status.tsx and its OpenStatus messages)", () => {
    // Without this, a scan that found nothing would pass every check below.
    const modules = readClientModules();
    expect(modules.map(({ file }) => file)).toContain(path.join("src", "components", "site", "open-status.tsx"));
    expect(modules.flatMap(({ code }) => requestedNamespaces(code))).toContain("OpenStatus");
  });

  test("every namespace a client module asks for is in clientNamespaces", () => {
    expect(problems(readClientModules(), clientNamespaces), "add it to clientNamespaces, or pass the text as a prop").toEqual(
      [],
    );
  });

  test.each([
    ["no namespace", 'const t = useTranslations();', [null]],
    ["a namespace in a variable", "const t = useTranslations(namespace);", [null]],
    ["a nested key", 'const t = useTranslations("OpenStatus.badge");', ["OpenStatus"]],
    ["single quotes", "const t = useTranslations('Header');", ["Header"]],
  ])("reads %s", (_case, code, expected) => {
    expect(requestedNamespaces(code)).toEqual(expected);
  });

  test("a client file without a namespace, or with an unlisted one, is reported", () => {
    const fixture = [
      { file: "no-namespace.tsx", code: '"use client";\nconst t = useTranslations();\n' },
      { file: "server-namespace.tsx", code: '"use client";\nconst t = useTranslations("HomePage");\n' },
      { file: "fine.tsx", code: '"use client";\nconst t = useTranslations("OpenStatus");\n' },
    ];
    expect(problems(fixture, clientNamespaces)).toEqual([
      { file: "no-namespace.tsx", namespace: null },
      { file: "server-namespace.tsx", namespace: "HomePage" },
    ]);
  });

  test("recognises the directive only at the top of a file", () => {
    expect(isClientFile('"use client";\nexport const x = 1;')).toBe(true);
    expect(isClientFile("// A comment first\n'use client';\n")).toBe(true);
    expect(isClientFile('export const note = "use client";')).toBe(false);
  });
});

describe("the providers send only the client messages", () => {
  test.each(["src/app/[locale]/layout.tsx", "src/app/global-not-found.tsx"])("%s passes messages to NextIntlClientProvider", (file) => {
    const code = readFileSync(path.join(repoRoot, file), "utf8");
    // Without a messages prop, next-intl sends every message to the browser.
    expect(code).toMatch(/<NextIntlClientProvider\b[^>]*\bmessages=\{/);
    expect(code).toContain("pickClientMessages(");
  });
});
