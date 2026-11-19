import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { renderWithIntl } from "@/i18n/test-utils";
import { readGarage } from "@/server/dal/garage";
import { ownerGarage } from "@/server/db/seed-data";
import messages from "../../../../messages/en.json";

import BookLayout from "./layout";

// The layout is an async Server Component: the test renders `await
// BookLayout(...)`. readGarage() reads the database, so a stand-in returns
// the owner's details here.
vi.mock("@/server/dal/garage", () => ({ readGarage: vi.fn() }));

beforeEach(() => {
  vi.mocked(readGarage).mockResolvedValue(ownerGarage);
});

async function renderLayout() {
  const ui = await BookLayout({ children: <h1>{messages.HomePage.title}</h1>, params: Promise.resolve({ locale: "en" }) });
  return renderWithIntl(ui);
}

describe("the (book) layout (the shell without the phone bar)", () => {
  test("wraps the page in the shell: header, main and footer", async () => {
    await renderLayout();
    expect(screen.getByRole("banner")).toBeDefined();
    expect(screen.getByRole("main").textContent).toContain(messages.HomePage.title);
    expect(screen.getByRole("contentinfo")).toBeDefined();
  });

  test("renders no phone action bar and no spacer for it", async () => {
    const { container } = await renderLayout();
    expect(screen.queryByRole("navigation", { name: messages.ActionBar.label })).toBeNull();
    expect(container.querySelector("[data-action-bar]")).toBeNull();
    // The footer is the last thing: no empty block after it.
    expect(container.lastElementChild).toBe(screen.getByRole("contentinfo"));
  });
});
