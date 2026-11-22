import { act, fireEvent, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { Activity, type ReactElement } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { defaultLocale, GARAGE_TIME_ZONE } from "@/i18n/config";
import { renderWithIntl } from "@/i18n/test-utils";
import type { PriceFormState } from "@/lib/price-form";
import messages from "../../../messages/en.json";

import { type PriceAction, PriceGroupForm, type PriceGroupFormLabels } from "./price-group-form";

// The card's words come from the page as props: here, the real messages. The
// Server Action is a stand-in answering what each test needs
// (src/server/actions/prices.test.ts tests the real one).

beforeEach(() => {
  vi.clearAllMocks();
});

const t = messages.AdminPrices;
const labels: PriceGroupFormLabels = {
  groupLabel: t.groupLabel,
  groupHint: t.groupHint,
  fuelsSummary: t.fuelsSummary,
  fuelsHint: t.fuelsHint,
  save: "Save Hatchback prices",
  saving: t.saving,
  saved: t.saved,
  connection: t.connection,
  currency: "₹",
};
const fuels = [
  { fuel: "petrol", label: "Petrol" },
  { fuel: "diesel", label: "Diesel" },
] as const;

function card(action: PriceAction, initial = {}) {
  return <PriceGroupForm action={action} heading="Hatchback" fuels={fuels} initial={initial} labels={labels} />;
}

function withIntl(ui: ReactElement) {
  return (
    <NextIntlClientProvider locale={defaultLocale} messages={messages} timeZone={GARAGE_TIME_ZONE}>
      {ui}
    </NextIntlClientProvider>
  );
}

const box = (name: string) => screen.getByLabelText(name) as HTMLInputElement;

async function save() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: labels.save }));
  });
}

function posted(action: ReturnType<typeof vi.fn<PriceAction>>, call = 0) {
  return Object.fromEntries(action.mock.calls[call]![1].entries());
}

describe("PriceGroupForm", () => {
  test("a card named by its group: the group's box with its hint, the fold of fuels, its own Save button", () => {
    renderWithIntl(card(vi.fn<PriceAction>(), { group: "1,500", petrol: "", diesel: "" }));
    const region = screen.getByRole("region", { name: "Hatchback" });
    expect(box(t.groupLabel).value).toBe("1,500");
    expect(box(t.groupLabel).getAttribute("inputmode")).toBe("numeric");
    expect(box(t.groupLabel).getAttribute("aria-describedby")).toBeTruthy();
    expect(within(region).getByText(t.groupHint)).toBeTruthy();
    expect(region.querySelector("details")?.open).toBe(false);
    expect(within(region).getByText(t.fuelsSummary).tagName).toBe("SUMMARY");
    expect(within(region).getByRole("button", { name: labels.save })).toBeTruthy();
  });

  test("posts the group's box and one box per fuel", async () => {
    const action = vi.fn<PriceAction>().mockResolvedValue({ submission: 1, values: {}, errors: {}, saved: [] });
    renderWithIntl(card(action));
    fireEvent.change(box(t.groupLabel), { target: { value: "1500" } });
    fireEvent.change(box("Diesel"), { target: { value: "1800" } });
    await save();
    expect(posted(action)).toEqual({ "price-group": "1500", "price-petrol": "", "price-diesel": "1800" });
  });

  test("saved: the saved line and each fuel's price, and the boxes show the saved amounts", async () => {
    const answer: PriceFormState = {
      submission: 1,
      values: { group: "", petrol: "", diesel: "1,800" },
      errors: {},
      saved: [`Petrol: ${t.noPrice}`, "Diesel: ₹1,800"],
    };
    renderWithIntl(card(vi.fn<PriceAction>().mockResolvedValue(answer)));
    await save();
    const status = screen.getByRole("status");
    expect(within(status).getByText(t.saved)).toBeTruthy();
    expect(within(status).getByText(`Petrol: ${t.noPrice}`)).toBeTruthy();
    expect(within(status).getByText("Diesel: ₹1,800")).toBeTruthy();
    expect(box("Diesel").value).toBe("1,800");
    // A fuel with its own price: the fold stays open.
    expect(document.querySelector("details")?.open).toBe(true);
  });

  test("an error: its message under its box, the cursor there, the other boxes kept", async () => {
    const answer: PriceFormState = {
      submission: 1,
      values: { group: "1500", petrol: "", diesel: "1.500" },
      errors: { diesel: t.errors["not-whole"] },
      saved: null,
    };
    renderWithIntl(card(vi.fn<PriceAction>().mockResolvedValue(answer)));
    await save();
    expect(screen.getByText(t.errors["not-whole"])).toBeTruthy();
    expect(box("Diesel").getAttribute("aria-invalid")).toBe("true");
    expect(box("Diesel").getAttribute("aria-describedby")).toContain("error");
    expect(document.activeElement).toBe(box("Diesel"));
    expect(box(t.groupLabel).value).toBe("1500");
    expect(screen.queryByRole("status")).toBeNull();
  });

  test("a failed call says so and keeps what was typed", async () => {
    renderWithIntl(card(vi.fn<PriceAction>().mockRejectedValue(new TypeError("Failed to fetch"))));
    fireEvent.change(box(t.groupLabel), { target: { value: "1500" } });
    await save();
    expect(screen.getByRole("alert").textContent).toBe(t.connection);
    expect(box(t.groupLabel).value).toBe("1500");
  });

  test("a group with one fuel: no fold, the group's box only", () => {
    renderWithIntl(<PriceGroupForm action={vi.fn<PriceAction>()} heading="Premium motorcycle" fuels={[{ fuel: "petrol", label: "Petrol" }]} initial={{}} labels={labels} />);
    expect(document.querySelector("details")).toBeNull();
    expect(screen.queryByLabelText("Petrol")).toBeNull();
  });

  test("keeps an amount typed before the page's JavaScript loaded", async () => {
    const tree: ReactElement = withIntl(card(vi.fn<PriceAction>()));
    const container = document.createElement("div");
    container.innerHTML = renderToString(tree);
    document.body.append(container);
    (within(container).getByLabelText(t.groupLabel) as HTMLInputElement).value = "1500";

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    let root: Root | undefined;
    await act(async () => {
      root = hydrateRoot(container, tree);
    });
    try {
      expect(consoleError).not.toHaveBeenCalled();
      expect((within(container).getByLabelText(t.groupLabel) as HTMLInputElement).value).toBe("1500");
    } finally {
      consoleError.mockRestore();
      act(() => root?.unmount());
      container.remove();
    }
  });

  test("leaving the page and coming back starts it from the saved amounts, with no old answer", async () => {
    const answer: PriceFormState = { submission: 1, values: { group: "9" }, errors: { group: "x" }, saved: null };
    const action = vi.fn<PriceAction>().mockResolvedValue(answer);
    const ui = (mode: "visible" | "hidden") => <Activity mode={mode}>{card(action, { group: "1,500" })}</Activity>;
    const { rerender } = renderWithIntl(ui("visible"));
    await save();
    expect(box(t.groupLabel).value).toBe("9");
    rerender(withIntl(ui("hidden")));
    rerender(withIntl(ui("visible")));
    expect(box(t.groupLabel).value).toBe("1,500");
    expect(screen.queryByText("x")).toBeNull();
  });
});
