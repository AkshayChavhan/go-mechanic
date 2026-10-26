import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

import messages from "../../../messages/en.json";

import { bookPage, bookTarget, liveNavItems, navItems, type NavItem } from "./navigation";

// The shell must never link to a page that doesn't exist (and must show the
// link once it does). So each `live` flag in navigation.ts is checked against
// the real files: a page task can't ship its page without switching its link
// on, or switch a link on without its page.

const localeFolder = fileURLToPath(new URL("../../app/[locale]", import.meta.url));

/**
 * The URL of every page under src/app/[locale]/. Next.js leaves some folders
 * out of the URL: route groups like (site), and parallel routes like @modal.
 * Folders starting with _ are private (never a page).
 */
function pageUrls(): Set<string> {
  const pageFiles = readdirSync(localeFolder, { recursive: true, encoding: "utf8" }).filter((file) =>
    /^page\.(tsx|ts|jsx|js|mdx)$/.test(path.basename(file)),
  );
  const urls = pageFiles
    .map((file) => path.dirname(file).split(path.sep))
    .filter((folders) => !folders.some((folder) => folder.startsWith("_")))
    .map((folders) => folders.filter((folder) => folder !== "." && !/^\(.+\)$/.test(folder) && !folder.startsWith("@")))
    .map((folders) => `/${folders.join("/")}`);
  return new Set(urls);
}

describe("the navigation registry", () => {
  test("the page scan finds the pages that exist today", () => {
    // Without this, a broken scan (finding nothing) would make every check below pass.
    expect([...pageUrls()]).toEqual(expect.arrayContaining(["/", "/dev/design"]));
  });

  test.each([...navItems, bookPage].map((page) => [page.href, page] as const))(
    "%s is live exactly when its page.tsx exists",
    (href, page) => {
      const exists = pageUrls().has(href);
      expect(page.live, `${href} has live: ${page.live}, but its page.tsx ${exists ? "exists" : "doesn't exist"}`).toBe(
        exists,
      );
    },
  );

  test("every menu label has its text in messages/en.json (Nav)", () => {
    for (const item of navItems) {
      expect(messages.Nav[item.label], item.label).toBeTruthy();
    }
  });

  test("liveNavItems keeps only live items, in order", () => {
    const items: NavItem[] = [
      { label: "services", href: "/services", live: true },
      { label: "prices", href: "/packages", live: false },
      { label: "contact", href: "/contact", live: true },
    ];
    expect(liveNavItems(items).map((item) => item.href)).toEqual(["/services", "/contact"]);
  });
});

describe("bookTarget (where \"Book a service\" goes)", () => {
  const whatsappBooking = "https://wa.me/919764750567?text=Hi";

  test("a WhatsApp chat with the booking message while /book isn't live", () => {
    expect(bookTarget(whatsappBooking, { href: "/book", live: false })).toEqual({
      kind: "whatsapp",
      href: whatsappBooking,
    });
  });

  test("the booking page once it's live (task 23)", () => {
    expect(bookTarget(whatsappBooking, { href: "/book", live: true })).toEqual({ kind: "page", href: "/book" });
  });

  test("uses the real booking page entry by default", () => {
    expect(bookTarget(whatsappBooking).kind).toBe(bookPage.live ? "page" : "whatsapp");
  });
});
