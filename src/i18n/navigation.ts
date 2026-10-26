import { createNavigation } from "next-intl/navigation";

import { routing } from "./routing";

// Use these instead of next/link and next/navigation: they keep the visitor's
// language in every link and redirect (e.g. /hi/... stays /hi/...).
// ESLint blocks the plain Next.js versions (eslint.config.mjs).
export const { Link, redirect, permanentRedirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
