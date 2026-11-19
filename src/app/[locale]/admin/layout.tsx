import type { Metadata } from "next";
import { useLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AdminBar } from "@/components/admin/admin-bar";
import { ADMIN_MANIFEST_PATH, HOME_SCREEN_ICONS } from "@/components/admin/home-screen";
import { AdminNavGate } from "@/components/admin/admin-nav-gate";

// The staff area, /admin (task 26). Beside login/, outside (site) and (book),
// so no public shell: a slim staff bar, then the page.
//
// Who may see what:
// - the proxy sends a logged-out visitor to /login with a real 307
//   (PROTECTED_PREFIXES in src/lib/access-routes.ts);
// - each page checks its own permission inside its <Suspense> gate
//   (requirePermission), never this layout alone: a layout doesn't run again
//   on every navigation, and a page must be safe even without it;
// - a customer who gets past the proxy sees the site's 404 page, which
//   replaces this layout. There's no admin/not-found.tsx on purpose: one
//   here would draw the 404 inside the staff bar.
//
// What is built ahead of time (and so reaches anyone): the brand, "Back to
// site", "Log out" and each page's neutral loading line. The section links
// and every staff word render after the session is read.

// Static: reads no session. The title is the brand alone, and pages set no
// title of their own, so a customer's <head> names nothing staff-specific.
// noindex: nothing here is for search engines.
export async function generateMetadata(): Promise<Metadata> {
  const tBrand = await getTranslations("Brand");
  return {
    title: tBrand("name"),
    robots: { index: false, follow: false },
    // Add to home screen (R10). Only this layout links the manifest, so
    // public pages offer nothing. A URL and the brand: no staff word.
    manifest: ADMIN_MANIFEST_PATH,
    // iOS reads no manifest icons: it wants these tags and the apple-touch-icon.
    appleWebApp: { capable: true, title: tBrand("name"), statusBarStyle: "default" },
    icons: {
      // An `icons` export here replaces the link Next.js makes for
      // src/app/icon.svg, so the tab's favicon is listed again.
      icon: [{ url: "/icon.svg", type: "image/svg+xml", sizes: "any" }],
      apple: [{ url: HOME_SCREEN_ICONS.apple, type: "image/png", sizes: "180x180" }],
    },
  };
}

export default function AdminLayout({ children }: LayoutProps<"/[locale]/admin">) {
  const locale = useLocale();
  return (
    <>
      <AdminBar
        locale={locale}
        nav={
          // No fallback: the bar keeps the links' space, so nothing moves.
          <Suspense fallback={null}>
            <AdminNavGate locale={locale} />
          </Suspense>
        }
      />
      <main id="main">{children}</main>
    </>
  );
}
