import { screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { use } from "react";
import { describe, expect, test, vi } from "vitest";

import { defaultLocale, GARAGE_TIME_ZONE } from "@/i18n/config";
import { renderWithIntl } from "@/i18n/test-utils";
import messages from "../../../../messages/en.json";

import AdminLayout, { generateMetadata } from "./layout";

// The layout is what anyone who reaches an /admin address receives before
// the session is read. Stand-ins:
// - AdminNavGate (it reads the session) waits forever, as it does while the
//   page is built ahead of time, so what shows is its <Suspense> fallback;
//   it's tested on its own;
// - the Server Action module (Better Auth, cookies) becomes empty functions;
// - getTranslations (next-intl/server, for the metadata) is next-intl's own
//   translator over the real messages.
vi.mock("@/components/admin/admin-nav-gate", () => ({
  AdminNavGate: () => use(new Promise<never>(() => {})),
}));
vi.mock("@/server/actions/login", () => ({ loginStep: vi.fn(), logOut: vi.fn() }));
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const { default: allMessages } = await import("../../../../messages/en.json");
  return {
    getTranslations: async (namespace: "Brand") => createTranslator({ locale: "en", messages: allMessages, namespace }),
  };
});

const brand = messages.Brand.name;
const layoutProps = {
  params: Promise.resolve({ locale: "en" }),
  children: <p data-testid="page">page</p>,
} as unknown as LayoutProps<"/[locale]/admin">;

/** Every string in the Admin namespace's staff parts: the nav and the overview. */
const staffWords = [...Object.values(messages.Admin.nav), ...Object.values(messages.Admin.overview)];

describe("the /admin layout", () => {
  test("the staff bar, then the page in one <main>", () => {
    const { container } = renderWithIntl(<AdminLayout {...layoutProps} />);
    expect(screen.getByRole("banner")).toBeTruthy();
    expect(container.querySelectorAll("main#main")).toHaveLength(1);
    expect(screen.getByRole("main").contains(screen.getByTestId("page"))).toBe(true);
  });

  test("before the session is read: the brand, Back to site and Log out, and no staff word", () => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale={defaultLocale} messages={messages} timeZone={GARAGE_TIME_ZONE}>
        <AdminLayout {...layoutProps} />
      </NextIntlClientProvider>,
    );
    expect(html).toContain(brand);
    expect(html).toContain(messages.Admin.backToSite);
    expect(html).toContain(messages.Account.logOut);
    for (const word of staffWords) expect(html).not.toContain(word);
    expect(html).not.toContain("<nav");
  });

  test("metadata: the brand alone as the title, noindex, and add to home screen (R10)", async () => {
    expect(await generateMetadata()).toEqual({
      title: brand,
      robots: { index: false, follow: false },
      manifest: "/admin.webmanifest",
      appleWebApp: { capable: true, title: brand, statusBarStyle: "default" },
      icons: {
        // The site's favicon, kept: an `icons` export replaces icon.svg's link.
        icon: [{ url: "/icon.svg", type: "image/svg+xml", sizes: "any" }],
        apple: [{ url: "/admin-apple-icon.png", type: "image/png", sizes: "180x180" }],
      },
    });
  });
});
