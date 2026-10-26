import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

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
          selector:
            ":matches(JSXElement, JSXFragment) > JSXExpressionContainer > :matches(ConditionalExpression, LogicalExpression) > :matches(Literal[value=/\\S/], TemplateLiteral)",
          message: "Put text people read in messages/en.json and show it with t().",
        },
        {
          // alt="...", aria-label="...", placeholder="...", title="..."
          selector:
            "JSXAttribute[name.name=/^(alt|aria-label|aria-description|aria-valuetext|placeholder|title)$/] > Literal[value=/\\S/]",
          message: "Text people read or hear (alt, title, placeholder, aria-*) goes in messages/en.json.",
        },
        {
          // The same attributes written as {"..."} or {`...`}
          selector:
            "JSXAttribute[name.name=/^(alt|aria-label|aria-description|aria-valuetext|placeholder|title)$/] > JSXExpressionContainer > :matches(Literal[value=/\\S/], TemplateLiteral)",
          message: "Text people read or hear (alt, title, placeholder, aria-*) goes in messages/en.json.",
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
