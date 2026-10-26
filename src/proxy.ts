import createMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing";

// Runs before each page request (Next.js 16 calls this "proxy"; it used to be
// "middleware"). next-intl uses it to send "/" to the English pages and to
// redirect "/en/..." to the clean URL.
export default createMiddleware(routing);

export const config = {
  // Skip API routes, Next.js internals and any path with a dot (files such as
  // /icon.svg, later /robots.txt and /sitemap.xml). So page slugs must never
  // contain a dot.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
