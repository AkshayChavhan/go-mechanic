import type { Metadata } from "next";
import { useLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AdminBar } from "@/components/admin/admin-bar";
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
    // Task 26's U5 adds `manifest` and `appleWebApp` here (add to home screen).
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
