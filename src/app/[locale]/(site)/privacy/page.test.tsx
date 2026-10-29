import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { LOGIN_NOTICE_VERSION } from "@/domain/consent";
import { indiaInstantOn } from "@/domain/india-time";
import { LOGIN_RULES } from "@/domain/login";
import { formatDate } from "@/i18n/format";
import { renderWithIntl } from "@/i18n/test-utils";
import { readGarage } from "@/server/dal/garage";
import { ownerGarage } from "@/server/db/seed-data";
import messages from "../../../../../messages/en.json";

import PrivacyPage, { ensureStatic, generateMetadata } from "./page";

vi.mock("@/server/dal/garage", () => ({ readGarage: vi.fn() }));
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const { default: allMessages } = await import("../../../../../messages/en.json");
  return {
    getLocale: async () => "en",
    getTranslations: async (namespace: "PrivacyPage") => createTranslator({ locale: "en", messages: allMessages, namespace }),
  };
});

const t = messages.PrivacyPage;

beforeEach(() => {
  vi.mocked(readGarage).mockResolvedValue(ownerGarage);
});

describe("Privacy page", () => {
  test("has one h1, the draft line and the notice version as its last-updated date", async () => {
    const { container } = renderWithIntl(await PrivacyPage());
    expect(screen.getAllByRole("heading", { level: 1 }).map((h) => h.textContent)).toEqual([t.heading]);
    expect(screen.getByText(t.draft)).toBeTruthy();
    const date = formatDate(indiaInstantOn(LOGIN_NOTICE_VERSION, 12 * 60), "en");
    expect(container.textContent).toContain(t.updated.replace("{date}", date));
  });

  test("describes each kind of data, with what, why, who and how long, and no table", async () => {
    const { container } = renderWithIntl(await PrivacyPage());
    const items = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(items).toEqual(Object.values(t.items).map((item) => item.title));
    expect(container.querySelectorAll("dl")).toHaveLength(Object.keys(t.items).length);
    expect(container.querySelector("table")).toBeNull();
  });

  test("states the real retention, with the numbers the code runs on", async () => {
    const { container } = renderWithIntl(await PrivacyPage());
    const text = container.textContent ?? "";
    // Login attempts go at the next code request after the limit, not on a timer.
    expect(text).toContain(t.items.attempts.howLong.replace("{hours}", String(LOGIN_RULES.keepRecordsHours)));
    expect(t.items.attempts.howLong).toContain("the next time anyone asks for a code");
    expect(text).toContain(t.items.codes.howLong.replace("{minutes}", String(LOGIN_RULES.codeLifetimeSeconds / 60)));
    expect(text).toContain(t.items.session.why.replace("{days}", String(LOGIN_RULES.sessionDays)));
  });

  test("says sessions keep the IP address and the browser's description", () => {
    expect(t.items.session.what).toMatch(/IP address/);
    expect(t.items.session.what).toMatch(/user agent/);
  });

  test("gives the garage's phone and WhatsApp from the database, and names the Board without a link", async () => {
    vi.mocked(readGarage).mockResolvedValue({ ...ownerGarage, phone: "+912012345678", whatsapp: "+919812345678" });
    const { container } = renderWithIntl(await PrivacyPage());
    const hrefs = [...container.querySelectorAll("a")].map((link) => link.getAttribute("href") ?? "");
    expect(hrefs).toContain("tel:+912012345678");
    expect(hrefs.some((href) => href.startsWith("https://wa.me/919812345678"))).toBe(true);
    expect(container.textContent).toContain("Data Protection Board of India");
    // No external link except WhatsApp: no unverified Board portal.
    expect(hrefs.filter((href) => href.startsWith("http") && !href.startsWith("https://wa.me/"))).toEqual([]);
  });

  test("every link in the contents list leads to a heading on the page", async () => {
    const { container } = renderWithIntl(await PrivacyPage());
    const nav = screen.getByRole("navigation", { name: t.contents });
    const anchors = [...nav.querySelectorAll("a")].map((link) => link.getAttribute("href") ?? "");
    expect(anchors.length).toBeGreaterThan(5);
    for (const anchor of anchors) expect(container.querySelector(anchor), anchor).not.toBeNull();
  });

  test("must be built ahead of time, and stays out of search results while it's a draft", async () => {
    expect(ensureStatic).toBe("navigation");
    expect(await generateMetadata()).toEqual({
      title: t.metaTitle.replace("{brand}", messages.Brand.name),
      description: t.metaDescription.replace("{brand}", messages.Brand.name),
      robots: { index: false },
    });
  });
});
