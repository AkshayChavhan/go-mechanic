import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
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
