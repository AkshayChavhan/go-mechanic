import { screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, onTestFinished, test, vi } from "vitest";

import { isLivePage } from "@/components/site/navigation";
import { sceneSelector } from "@/components/site/scroll-scene-attributes";
import { services } from "@/content/services";
import { renderWithIntl } from "@/i18n/test-utils";
import { readGarage } from "@/server/dal/garage";
import { ownerGarage } from "@/server/db/seed-data";
import messages from "../../../../messages/en.json";

import { FOOTER_TONE } from "./_components/home-tones";
import Home, { ensureStatic } from "./page";

// The page is an async Server Component: each test renders `await Home()`.
// It reads the garage from the database through readGarage(), replaced here
// by a stand-in that returns the owner's details (or what a test sets), and
// its text with getTranslations from next-intl/server, which only works
// inside a Next.js render: here it's next-intl's own translator over the
// real messages.
vi.mock("@/server/dal/garage", () => ({ readGarage: vi.fn() }));
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const { default: allMessages } = await import("../../../../messages/en.json");
  return {
    getTranslations: async (namespace: "Contact") => createTranslator({ locale: "en", messages: allMessages, namespace }),
  };
});

const home = messages.HomePage;

beforeEach(() => {
  vi.mocked(readGarage).mockResolvedValue(ownerGarage);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

/** The section headings (h2), top to bottom. */
function sectionHeadings(): string[] {
  return screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent ?? "");
}

/** Each <section>'s tone, top to bottom, then the footer's. */
function tones(container: HTMLElement): string[] {
  const sections = [...container.querySelectorAll("section")].map((section) =>
    section.classList.contains("dark") ? "dark" : section.classList.contains("surface-grey") ? "grey" : "white",
  );
  return [...sections, FOOTER_TONE];
}

/** The section a heading names (its aria-labelledby). */
function sectionOf(heading: string): HTMLElement {
  return screen.getByRole("heading", { name: heading }).closest("section")!;
}

describe("Home page", () => {
  test("has exactly one h1: the service and the area", async () => {
    renderWithIntl(await Home());
    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0].textContent).toBe(home.title);
    expect(home.title).toContain("Kiwale, Pune");
  });

  test("the lead under it names cars, two-wheelers and Mukai Chowk", async () => {
    renderWithIntl(await Home());
    expect(screen.getByText(home.hero.lead)).toBeTruthy();
    expect(home.hero.lead).toMatch(/cars/i);
    expect(home.hero.lead).toMatch(/two-wheelers/i);
    expect(home.hero.lead).toContain("Mukai Chowk");
  });

  test("outside npm run dev: story, services and the call to action, with no samples anywhere", async () => {
    expect(process.env.NODE_ENV).toBe("test");
    const { container } = renderWithIntl(await Home());
    expect(sectionHeadings()).toEqual([home.story.title, home.services.title, home.cta.title]);
    expect(container.querySelector("[data-sample]")).toBeNull();
    expect(container.textContent).not.toContain(home.sample);
  });

  test("under npm run dev: the sample stats and reviews too, in order, each one marked", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { container } = renderWithIntl(await Home());
    expect(sectionHeadings()).toEqual([
      home.story.title,
      home.services.title,
      home.stats.title,
      home.reviews.title,
      home.cta.title,
    ]);
    const stats = sectionOf(home.stats.title).querySelectorAll("dl > div");
    const reviews = sectionOf(home.reviews.title).querySelectorAll("li");
    expect(stats).toHaveLength(4);
    expect(reviews).toHaveLength(3);
    for (const item of [...stats, ...reviews]) {
      // A stat's <div> is itself marked; a review's card sits inside its <li>.
      expect(item.matches("[data-sample]") || item.querySelector("[data-sample]") !== null).toBe(true);
      expect(within(item as HTMLElement).getByText(home.sample)).toBeTruthy();
    }
    expect(container.querySelectorAll("[data-sample]")).toHaveLength(7);
  });

  test.each(["test", "development"])("neighbouring sections never share a tone, the footer included (%s)", async (nodeEnv) => {
    vi.stubEnv("NODE_ENV", nodeEnv);
    const { container } = renderWithIntl(await Home());
    const order = tones(container);
    order.slice(1).forEach((tone, index) => expect(tone, order.join(", ")).not.toBe(order[index]));
  });

  test.each([
    ["the hero", () => screen.getByRole("heading", { level: 1 }).closest("section")!],
    ["the call to action", () => sectionOf(home.cta.title)],
  ])("%s: one blue Book link to WhatsApp with the booking message, and Call", async (_name, section) => {
    renderWithIntl(await Home());
    const links = within(section()).getAllByRole("link");
    const book = links.filter((link) => link.textContent?.includes(messages.Header.book));
    expect(book).toHaveLength(1);
    const href = new URL(book[0].getAttribute("href")!);
    expect(href.host).toBe("wa.me");
    expect(href.searchParams.get("text")).toBe(messages.Contact.bookingMessage);
    expect(book[0].getAttribute("target")).toBe("_blank");
    expect(book[0].getAttribute("data-variant")).toBe("default");

    const call = links.filter((link) => link.getAttribute("href") === "tel:+919764750567");
    expect(call).toHaveLength(1);
    // "Call +91 97647 50567", with the space: the number shows from 768px,
    // and without a space search engines and screen readers read "Call+91".
    expect(call[0].textContent).toBe(`${messages.Contact.call} +91 97647 50567`);
    expect(call[0].getAttribute("data-variant")).toBe("secondary");
  });

  test("Call uses the number from the database, not a typed-in one", async () => {
    vi.mocked(readGarage).mockResolvedValue({ ...ownerGarage, phone: "+912012345678" });
    renderWithIntl(await Home());
    const hero = screen.getByRole("heading", { level: 1 }).closest("section")!;
    const calls = within(hero)
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href")?.startsWith("tel:"));
    expect(calls.map((link) => link.getAttribute("href"))).toEqual(["tel:+912012345678"]);
  });

  test("lists all eleven services, with no links (no service pages or prices yet)", async () => {
    renderWithIntl(await Home());
    const section = sectionOf(home.services.title);
    for (const service of services) {
      expect(within(section).getByRole("heading", { level: 3, name: service.name.en })).toBeTruthy();
    }
    expect(section.querySelector("a, button")).toBeNull();
  });

  test.each(["test", "development"])("no link or button sits inside, or around, a reveal target (%s)", async (nodeEnv) => {
    vi.stubEnv("NODE_ENV", nodeEnv);
    const { container } = renderWithIntl(await Home());
    const targets = [
      ...container.querySelectorAll(sceneSelector("reveal")),
      ...container.querySelectorAll(`${sceneSelector("revealGroup")} > *`),
    ];
    expect(targets.length).toBeGreaterThan(5);
    for (const target of targets) {
      expect(target.querySelector("a, button"), target.outerHTML.slice(0, 80)).toBeNull();
      expect(target.closest("a, button")).toBeNull();
    }
  });

  test("every link on the page goes somewhere that exists", async () => {
    const { container } = renderWithIntl(await Home());
    const hrefs = [...container.querySelectorAll("a[href]")].map((link) => link.getAttribute("href")!);
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      if (href.startsWith("/")) expect(isLivePage(href), href).toBe(true);
      else expect(href).toMatch(/^(?:https:\/\/wa\.me\/|tel:)/);
    }
  });

  test("must be built ahead of time (ensureStatic)", () => {
    expect(ensureStatic).toBe("navigation");
  });

  test("the placeholder copy is gone", () => {
    expect(JSON.stringify(home)).not.toMatch(/on its way/i);
    expect(messages.Metadata.description).not.toMatch(/on its way/i);
    expect(home).not.toHaveProperty("tagline");
  });

  test("the page is cleaned up after each test (vitest.setup.ts runs)", async () => {
    renderWithIntl(await Home());
    // onTestFinished runs after the afterEach hooks, so by then the cleanup
    // registered in vitest.setup.ts must have emptied the page.
    onTestFinished(() => {
      expect(document.body.innerHTML).toBe("");
    });
  });
});
