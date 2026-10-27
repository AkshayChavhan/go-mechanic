import createMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing";

// Runs before each page request (Next.js 16 calls this "proxy"; it used to be
// "middleware"). next-intl uses it to send "/" to the English pages and to
// redirect "/en/..." to the clean URL.
export default createMiddleware(routing);

export const config = {
  // Which paths the proxy runs on: everything except
  // - api, _next and _vercel: API routes and Next.js's own files;
  // - real files: paths ending in one of the extensions below (images,
  //   icons, txt, xml, webmanifest, fonts, js, css, map, pdf). They're served
  //   from public/ or src/app/ (icon.svg; later robots.txt, sitemap.xml) and
  //   must not be rewritten to /en/..., where they don't exist.
  // Any other path with a dot, such as /index.html or /contact.php (old links
  // to a previous website), runs through the proxy like a page, so it gets
  // the branded 404 instead of Next.js's bare one.
  // A missing file with a listed extension (/old-brochure.pdf) gets Next.js's
  // plain 404 (status 404, noindex, no shell), by design: it's a file, not a page.
  //
  // Written out in full: Next.js reads this value as text when it builds,
  // so it can't come from a variable. A new kind of file (say .json in
  // public/) needs its extension here: src/proxy.test.ts fails until it is.
  matcher: [
    "/((?!api|_next|_vercel|.*\\.(?:svg|png|jpe?g|gif|webp|avif|ico|txt|xml|webmanifest|woff2?|ttf|otf|eot|js|css|map|pdf)$).*)",
  ],
};
