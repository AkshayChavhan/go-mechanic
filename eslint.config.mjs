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
    ignores: ["**/*.test.tsx", "src/components/ui/**"],
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
      ],
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
