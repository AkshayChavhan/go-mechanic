import { getTranslations } from "next-intl/server";

import { HOME_SCREEN_ICONS } from "@/components/admin/home-screen";

// /admin.webmanifest: the staff area's web app manifest (task 26). Android
// and Chrome read it to offer "Add to home screen" on /admin; only the admin
// layout links it, so public pages offer nothing. (Next.js's app/manifest.ts
// convention would link it from every page.)
//
// A Route Handler outside [locale], so it passes the language itself. The
// brand comes from messages (brand-name.test.ts forbids typing it). It reads
// no request data, so the build writes it once.
export async function GET() {
  const tBrand = await getTranslations({ locale: "en", namespace: "Brand" });
  const manifest = {
    name: tBrand("name"),
    short_name: tBrand("name"),
    id: "/admin",
    start_url: "/admin",
    // The whole site, so /login and /account (an ended login, Log out) stay
    // inside the installed app instead of opening a browser tab.
    scope: "/",
    display: "standalone",
    // The page background, --background in src/app/globals.css. The admin
    // bar is white too, so the phone's status bar matches it.
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: HOME_SCREEN_ICONS[192], sizes: "192x192", type: "image/png", purpose: "any" },
      { src: HOME_SCREEN_ICONS[512], sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: { "content-type": "application/manifest+json" },
  });
}
