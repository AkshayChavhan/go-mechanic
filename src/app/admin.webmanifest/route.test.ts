import { readFileSync } from "node:fs";

import { describe, expect, test, vi } from "vitest";

import { HOME_SCREEN_ICONS } from "@/components/admin/home-screen";
import messages from "../../../messages/en.json";

import { GET } from "./route";

// The staff area's web app manifest (task 26, R10): what Android and Chrome
// read to offer "Add to home screen" on /admin. getTranslations is
// next-intl's own translator over the real messages.
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const { default: allMessages } = await import("../../../messages/en.json");
  return {
    getTranslations: async ({ locale, namespace }: { locale: "en"; namespace: "Brand" }) =>
      createTranslator({ locale, messages: allMessages, namespace }),
  };
});

const globalsCss = readFileSync(new URL("../globals.css", import.meta.url), "utf8");
/** The first value of a design token in globals.css (the :root one). */
const token = (name: string) => new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, "i").exec(globalsCss)?.[1];

describe("/admin.webmanifest", () => {
  test("is served as a web app manifest", async () => {
    const response = await GET();
    expect(response.headers.get("content-type")).toBe("application/manifest+json");
  });

  test("names the brand from messages, opens on /admin and keeps the whole site in the app", async () => {
    const manifest = await (await GET()).json();
    expect(manifest).toMatchObject({
      name: messages.Brand.name,
      short_name: messages.Brand.name,
      id: "/admin",
      start_url: "/admin",
      scope: "/",
      display: "standalone",
    });
  });

  test("its colours are the design tokens' page background", async () => {
    const manifest = await (await GET()).json();
    expect(token("background")).toBeDefined();
    expect(manifest.background_color).toBe(token("background"));
    expect(manifest.theme_color).toBe(token("background"));
  });

  test("lists the 192 and 512 PNG icons", async () => {
    const manifest = await (await GET()).json();
    expect(manifest.icons).toEqual([
      { src: HOME_SCREEN_ICONS[192], sizes: "192x192", type: "image/png", purpose: "any" },
      { src: HOME_SCREEN_ICONS[512], sizes: "512x512", type: "image/png", purpose: "any" },
    ]);
  });
});
