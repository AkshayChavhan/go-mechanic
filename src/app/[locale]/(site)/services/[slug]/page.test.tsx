import { screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { renderWithIntl } from "@/i18n/test-utils";
import { readGarage } from "@/server/dal/garage";
import { readServicePrices, readServices } from "@/server/dal/services";
import { readVehicleCatalogue } from "@/server/dal/vehicles";
import { ownerGarage } from "@/server/db/seed-data";
import { draftServices } from "@/server/db/service-seed-data";
import { draftCatalogue } from "@/server/db/vehicle-seed-data";
import messages from "../../../../../../messages/en.json";

import ServicePage, { ensureStatic, generateMetadata, generateStaticParams, instant } from "./page";

// An async Server Component: each test renders `await ServicePage(...)` with
// the cached reads replaced by the seed data, next-intl/server by next-intl's
// own translator, and notFound() by a function that throws a known error.
vi.mock("@/server/dal/garage", () => ({ readGarage: vi.fn() }));
vi.mock("@/server/dal/services", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/dal/services")>()),
  readServices: vi.fn(),
  readServicePrices: vi.fn(),
}));
vi.mock("@/server/dal/vehicles", () => ({ readVehicleCatalogue: vi.fn() }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  notFound: vi.fn(() => {
    throw new Error("notFound()");
  }),
}));
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const { default: allMessages } = await import("../../../../../../messages/en.json");
  return {
    getLocale: async () => "en",
    getTranslations: async (namespace: "Services") => createTranslator({ locale: "en", messages: allMessages, namespace }),
  };
});

const t = messages.Services;
const props = (slug: string) => ({ params: Promise.resolve({ locale: "en", slug }) }) as never;
const render = async (slug: string) => renderWithIntl(await ServicePage(props(slug)));

beforeEach(() => {
  vi.mocked(readGarage).mockResolvedValue(ownerGarage);
  vi.mocked(readServices).mockResolvedValue([...draftServices]);
  vi.mocked(readServicePrices).mockResolvedValue([]);
  vi.mocked(readVehicleCatalogue).mockResolvedValue(draftCatalogue);
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("/services/[slug]", () => {
  test("is built ahead of time for each of the eleven services, and no package, without reading the database", async () => {
    expect(ensureStatic).toBe("navigation");
    // Reading params outside <Suspense> (for the real 404) blocks the instant shell: allowed on purpose.
    expect(instant).toBe(false);
    const params = generateStaticParams();
    // `next dev` runs generateStaticParams in a helper process, where a
    // database read never finishes (serviceIdsToBuild() in the DAL).
    expect(readServices).not.toHaveBeenCalled();
    expect(params).toEqual(
      draftServices.filter((service) => service.kind === "service").map((service) => ({ slug: service.id })),
    );
    expect(params).toHaveLength(11);
  });

  test("names the service and the area in its title", async () => {
    const metadata = await generateMetadata(props("brakes"));
    expect(metadata.title).toMatch(/^Brakes in Kiwale, Pune \| /);
    expect(metadata.description).toContain("Brake pads");
  });

  test.each(["not-a-service", "car-basic"])("%s: generateMetadata and the page both call notFound()", async (slug) => {
    await expect(generateMetadata(props(slug))).rejects.toThrow("notFound()");
    await expect(ServicePage(props(slug))).rejects.toThrow("notFound()");
  });

  test("shows the summary, what's included and the signs", async () => {
    await render("brakes");
    expect(screen.getByRole("heading", { level: 1, name: "Brakes" })).toBeTruthy();
    const brakes = draftServices.find((service) => service.id === "brakes")!;
    expect(screen.getByText(brakes.summary.en)).toBeTruthy();
    const included = screen.getByRole("heading", { name: t.service.included }).parentElement!;
    expect(within(included).getAllByRole("listitem").map((item) => item.textContent)).toEqual(
      brakes.included.map((item) => item.en),
    );
    const signs = screen.getByRole("heading", { name: t.service.signs }).parentElement!;
    expect(within(signs).getAllByRole("listitem")).toHaveLength(brakes.signs.length);
  });

  test("ends with one action group: Book as the only blue button, and Call", async () => {
    await render("brakes");
    const actions = screen.getByRole("heading", { name: t.service.actionsTitle }).closest("section")!;
    const links = within(actions).getAllByRole("link");
    expect(links.map((link) => [link.textContent, link.getAttribute("data-variant")])).toEqual([
      [expect.stringContaining(messages.Header.book), "default"],
      [expect.stringContaining(messages.Contact.call), "secondary"],
    ]);
    // The price block holds no link or button.
    const price = screen.getByRole("heading", { name: t.price.title }).closest("section")!;
    expect(within(price).queryAllByRole("button")).toEqual([]);
  });

  test("outside npm run dev: no price, but how to get one", async () => {
    const { container } = await render("brakes");
    expect(screen.getByText(t.price.callForPrice)).toBeTruthy();
    expect(container.textContent).not.toContain("₹");
    expect(container.querySelector("[data-sample]")).toBeNull();
  });

  test("a service priced after an inspection says so, under npm run dev too", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { container } = await render("engine");
    expect(screen.getByText(t.price.onInspection)).toBeTruthy();
    expect(container.textContent).not.toContain("₹");
  });

  test("under npm run dev: a sample price table per vehicle kind, marked", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { container } = await render("brakes");
    const block = container.querySelector('[data-sample="service-prices"]')!;
    expect(within(block as HTMLElement).getByText(messages.HomePage.sample)).toBeTruthy();
    const tables = within(block as HTMLElement).getAllByRole("table");
    expect(tables.map((table) => table.querySelector("caption")?.textContent)).toEqual(["Cars", "Two-wheelers"]);
    const hatchback = within(tables[0]!).getByRole("row", { name: /Hatchback/ });
    expect(hatchback.textContent).toContain("₹1,299");
  });

  test("periodic service: a line per fuel where the prices differ, and a link to the packages", async () => {
    vi.stubEnv("NODE_ENV", "development");
    await render("periodic-service");
    const [cars] = screen.getAllByRole("table");
    const hatchback = within(cars!).getByRole("row", { name: /Hatchback/ });
    expect(hatchback.textContent).toContain("Petrol: ₹2,999");
    expect(hatchback.textContent).toContain("Diesel: ₹3,499");
    expect(hatchback.textContent).not.toContain("Electric");
    expect(screen.getByRole("link", { name: t.service.packages }).getAttribute("href")).toBe("/packages");
  });
});
