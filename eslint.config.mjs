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
  // Text people read goes in messages/en.json, not typed into JSX, so it can
  // be translated. Props (className, href...) are not text people read.
  {
    files: ["src/app/**/*.tsx", "src/components/{site,account,admin}/**/*.tsx"],
    ignores: ["**/*.test.tsx"],
    rules: {
      "react/jsx-no-literals": ["error", { noStrings: true, ignoreProps: true }],
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
