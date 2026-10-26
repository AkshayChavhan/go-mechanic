import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Selector pieces for the "no text in JSX" rule below.
// Attributes whose text people read, or hear from a screen reader. Not every
// aria-* attribute: aria-hidden="true" or aria-current="page" aren't text.
const readAttributes =
  "/^(alt|title|placeholder|aria-label|aria-description|aria-valuetext|aria-roledescription|aria-placeholder)$/";
const readAttributeMessage =
  "Text people read or hear (alt, title, placeholder, aria-label...) goes in messages/en.json.";
const condition = ":matches(ConditionalExpression, LogicalExpression)";
// A non-blank string or a template string
const text = ":matches(Literal[value=/\\S/], TemplateLiteral)";

// A stock Tailwind text size (text-xs ... text-9xl) as a class, with or
// without prefixes (md:text-lg, hover:text-sm, !text-sm). text-muted-foreground,
// text-link and text-center don't match. No "/" allowed inside: esquery
// ends a regex at the first one.
const stockTextSize = "(?:^|[\\s:!])text-(?:xs|sm|base|lg|[2-9]?xl)(?![\\w-])";
// className="md:text-lg", cn("text-sm", ...), `text-base ${extra}`
const stockTextSizeRule = {
  selector: `:matches(Literal[value=/${stockTextSize}/], TemplateElement[value.raw=/${stockTextSize}/])`,
  message:
    "Use a type-* class (type-body, type-callout, type-title...) for text size. Tailwind puts text-sm, text-lg... after type-* in the CSS, so they would win.",
};

// Points people to the language-aware versions in src/i18n/navigation.ts.
const useI18nNavigation =
  "Use the version from @/i18n/navigation: it keeps the language prefix (/hi/...) in the URL.";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Links and redirects must keep the language in the URL. A plain next/link
  // would quietly drop "/hi" once Hindi exists. global-not-found.tsx is outside
  // next-intl's routing, so it uses next/link on purpose.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/app/global-not-found.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "next/link", message: useI18nNavigation },
            {
              name: "next/navigation",
              importNames: ["redirect", "permanentRedirect", "useRouter", "usePathname"],
              message: useI18nNavigation,
            },
          ],
        },
      ],
    },
  },
  // Text people read or hear goes in messages/en.json, not typed into JSX, so
  // it can be translated. jsx-no-literals catches text between tags; it skips
  // all props (className, href... aren't text) and text inside a condition, so
  // no-restricted-syntax adds those cases. shadcn's ui/ folder is third-party
  // style code. src/i18n/lint-guards.test.ts checks these rules still fire.
  {
    files: ["src/app/**/*.tsx", "src/components/**/*.tsx"],
    ignores: [
      "**/*.test.tsx",
      "src/components/ui/**",
      // Development-only pages (/dev/design...) may type demo text: devOnly()
      // makes them a 404 in production. Only src/app/[locale]/dev/, not any
      // folder named dev. Kept here, not in a new block: a second block with
      // its own no-restricted-syntax list would replace this one's.
      "src/app/*/dev/**",
    ],
    rules: {
      "react/jsx-no-literals": ["error", { noStrings: true, ignoreProps: true }],
      "no-restricted-syntax": [
        "error",
        {
          // {isOpen ? "Open now" : "Closed"}, {error && "Oops"}, {name ?? "Guest"}
          selector: `:matches(JSXElement, JSXFragment) > JSXExpressionContainer > ${condition} > ${text}`,
          message: "Put text people read in messages/en.json and show it with t().",
        },
        {
          // One condition inside another: {a ? t("x") : b ? "Closed today" : "Closed"}
          selector: `:matches(JSXElement, JSXFragment) > JSXExpressionContainer > ${condition} > ${condition} > ${text}`,
          message: "Put text people read in messages/en.json and show it with t().",
        },
        {
          // aria-label="Open menu", placeholder="Phone"...
          selector: `JSXAttribute[name.name=${readAttributes}] > Literal[value=/\\S/]`,
          message: readAttributeMessage,
        },
        {
          // The same written as {"..."} or {`...`}
          selector: `JSXAttribute[name.name=${readAttributes}] > JSXExpressionContainer > ${text}`,
          message: readAttributeMessage,
        },
        {
          // ...or chosen by a condition: {isOpen ? "Close menu" : "Open menu"}
          selector: `JSXAttribute[name.name=${readAttributes}] > JSXExpressionContainer > ${condition} > ${text}`,
          message: readAttributeMessage,
        },
        stockTextSizeRule,
      ],
    },
  },
  // The stock text-size rule alone, for files the block above doesn't cover:
  // plain .ts files (class lists kept in constants) and the dev pages, which
  // may type demo text but must still show the real type scale. These files
  // never match the block above, so this block's no-restricted-syntax list
  // doesn't replace that block's list (flat config replaces, never merges,
  // two lists for one file).
  {
    files: ["src/**/*.ts", "src/app/*/dev/**/*.tsx"],
    ignores: ["**/*.test.ts", "**/*.test.tsx", "**/*.d.ts"],
    rules: {
      "no-restricted-syntax": ["error", stockTextSizeRule],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Not our app code: third-party Claude skills, and Claude/Compound
    // Engineering scratch folders (ESLint doesn't read .gitignore).
    ".claude/**",
    ".worktrees/**",
    ".context/**",
  ]),
]);

export default eslintConfig;
