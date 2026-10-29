import { act, fireEvent, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { defaultLocale, GARAGE_TIME_ZONE } from "@/i18n/config";
import { renderWithIntl } from "@/i18n/test-utils";
import { initialLoginState } from "@/lib/login-state";
import { loginStep } from "@/server/actions/login";
import { readGarage } from "@/server/dal/garage";
import { ownerGarage } from "@/server/db/seed-data";
import messages from "../../../../messages/en.json";

import LoginPage, { generateMetadata } from "./page";

// /login is an async Server Component: each test renders `await LoginPage()`.
// Stand-ins replace what only works inside a Next.js request:
// - readGarage() (the database) returns the owner's garage;
// - the Server Action module (Better Auth, cookies) becomes empty functions;
// - getTranslations and getLocale (next-intl/server) are next-intl's own
//   translator over the real messages, in English;
// - RedirectIfSignedIn (it reads the session cookie) draws nothing here.
//   redirect-if-signed-in.test.ts tests it on its own.
vi.mock("@/server/dal/garage", () => ({ readGarage: vi.fn() }));
vi.mock("@/server/actions/login", () => ({ loginStep: vi.fn(), logOut: vi.fn() }));
vi.mock("./redirect-if-signed-in", () => ({ RedirectIfSignedIn: () => null }));
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const { default: allMessages } = await import("../../../../messages/en.json");
  return {
    getLocale: async () => "en",
    getTranslations: async (namespace: "Login" | "Brand") =>
      createTranslator({ locale: "en", messages: allMessages, namespace }),
  };
});

const t = messages.Login;
const brand = messages.Brand.name;

beforeEach(() => {
  vi.mocked(readGarage).mockResolvedValue(ownerGarage);
});

describe("/login", () => {
  test("a slim bar with the Wordmark linking home, and no site shell", async () => {
    renderWithIntl(await LoginPage());
    const header = screen.getByRole("banner");
    expect(within(header).getByRole("link", { name: brand }).getAttribute("href")).toBe("/");
    // No footer, no phone bar, no navigation: the visitor has one job here.
    expect(screen.queryByRole("contentinfo")).toBeNull();
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  test("one main and one h1: the heading, with the intro under it", async () => {
    const { container } = renderWithIntl(await LoginPage());
    expect(container.querySelectorAll("main#main")).toHaveLength(1);
    expect(screen.getAllByRole("heading", { level: 1 }).map((heading) => heading.textContent)).toEqual([t.heading]);
    expect(screen.getByText(t.intro)).toBeTruthy();
  });

  test("the form: +91, the number, both boxes (the brand in the consent), the notice and Send code", async () => {
    renderWithIntl(await LoginPage());
    expect(screen.getByText(t.countryCode)).toBeTruthy();
    expect(screen.getByLabelText(t.phoneLabel)).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: t.ageLabel })).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: t.consentLabel.replace("{brand}", brand) })).toBeTruthy();
    expect(screen.getByRole("button", { name: t.sendCode })).toBeTruthy();
  });

  test("the notice links the full privacy notice, in a new tab, and says so to screen readers", async () => {
    renderWithIntl(await LoginPage());
    const link = screen.getAllByRole("link").find((anchor) => anchor.getAttribute("href") === "/privacy");
    expect(link?.textContent).toBe(`privacy notice ${t.opensInNewTab}`);
    expect(link?.getAttribute("target")).toBe("_blank");
    // The paragraph reads as the notice, plus the hidden "(opens in a new tab)".
    expect(link?.closest("p")?.textContent).toBe(
      t.notice.replace("<privacy>privacy notice</privacy>", `privacy notice ${t.opensInNewTab}`),
    );
  });

  test("the form posts to loginStep, with the locale bound as its first argument", async () => {
    vi.mocked(loginStep).mockResolvedValue(initialLoginState);
    renderWithIntl(await LoginPage());
    fireEvent.change(screen.getByLabelText(t.phoneLabel), { target: { value: "98765 43210" } });
    fireEvent.click(screen.getByRole("checkbox", { name: t.ageLabel }));
    fireEvent.click(screen.getByRole("checkbox", { name: t.consentLabel.replace("{brand}", brand) }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: t.sendCode }));
    });
    expect(loginStep).toHaveBeenCalledWith("en", initialLoginState, expect.any(FormData));
  });

  test("the help line: the garage's number from the database, as a link that dials it", async () => {
    vi.mocked(readGarage).mockResolvedValue({ ...ownerGarage, phone: "+912012345678" });
    renderWithIntl(await LoginPage());
    const call = screen.getByRole("link", { name: "+912012345678" });
    expect(call.getAttribute("href")).toBe("tel:+912012345678");
    expect(call.closest("p")?.textContent).toBe("Trouble logging in? Call us on +912012345678.");
  });

  test("a mobile number is shown the way people read it", async () => {
    renderWithIntl(await LoginPage());
    const call = screen.getByRole("link", { name: "+91 97647 50567" });
    expect(call.getAttribute("href")).toBe("tel:+919764750567");
  });

  test("without JavaScript: the server's HTML has a <noscript> line offering the phone", async () => {
    // React in the browser leaves <noscript> empty, so this reads the HTML
    // the server sends, which is what a visitor without JavaScript gets.
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale={defaultLocale} messages={messages} timeZone={GARAGE_TIME_ZONE}>
        {await LoginPage()}
      </NextIntlClientProvider>,
    );
    const noscript = /<noscript>([\s\S]*?)<\/noscript>/.exec(html)?.[1] ?? "";
    expect(noscript).toContain("Logging in needs JavaScript. You can still call us on ");
    expect(noscript).toContain('href="tel:+919764750567"');
    expect(noscript).toContain(">+91 97647 50567</a> to book.");
  });

  test("metadata: the title with the brand, and noindex", async () => {
    expect(await generateMetadata()).toEqual({
      title: `Log in | ${brand}`,
      robots: { index: false, follow: false },
    });
  });
});
