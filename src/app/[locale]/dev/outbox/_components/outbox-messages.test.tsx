import { screen, within } from "@testing-library/react";
import { connection } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { renderWithIntl } from "@/i18n/test-utils";
import { listDevMessages, type DevMessage } from "@/server/dal/dev-messages";

import { OutboxMessages } from "./outbox-messages";

// OutboxMessages is an async Server Component: each test calls it and renders
// what it returns. The database (listDevMessages) and connection() (which
// only works inside a Next.js request) are stand-ins.
vi.mock("@/server/dal/dev-messages", () => ({ listDevMessages: vi.fn() }));
vi.mock("next/server", () => ({ connection: vi.fn(async () => {}) }));

// Instants are in UTC; India is 5 h 30 min ahead.
const newer: DevMessage = {
  id: "b",
  channel: "sms",
  recipient: "+919876543210",
  body: "483920 is your login code. It works for 5 minutes. Don't share it with anyone.",
  createdAt: new Date("2026-10-28T06:31:00Z"),
};
const older: DevMessage = {
  id: "a",
  channel: "sms",
  recipient: "+917000000001",
  body: "120034 is your login code. It works for 5 minutes. Don't share it with anyone.",
  createdAt: new Date("2026-10-28T06:30:00Z"),
};

beforeEach(() => {
  vi.mocked(listDevMessages).mockReset();
  vi.mocked(connection).mockClear();
});

describe("OutboxMessages (/dev/outbox)", () => {
  test("one card per message, in the order the database gives (newest first)", async () => {
    vi.mocked(listDevMessages).mockResolvedValue([newer, older]);
    const { container } = renderWithIntl(await OutboxMessages({ locale: "en" }));
    const cards = [...container.querySelectorAll("li [data-message]")].map((card) => card.getAttribute("data-message"));
    expect(cards).toEqual(["b", "a"]);
  });

  test("each card: the code big and easy to select, the number as people read it, the India time and the text", async () => {
    vi.mocked(listDevMessages).mockResolvedValue([newer]);
    renderWithIntl(await OutboxMessages({ locale: "en" }));
    const card = screen.getByRole("listitem");
    const code = within(card).getByText("483920");
    expect(code.className).toContain("select-all");
    expect(within(card).getByText("SMS")).toBeTruthy();
    expect(card.textContent).toContain("To +91 98765 43210");
    // 06:31 UTC is 12:01 pm in India.
    const time = card.querySelector("time")!;
    expect(time.textContent).toBe("28 Oct 2026 at 12:01 pm");
    expect(time.getAttribute("dateTime")).toBe("2026-10-28T06:31:00.000Z");
    expect(within(card).getByText(newer.body)).toBeTruthy();
  });

  test("reads the database on every request (connection() first), not once at build time", async () => {
    vi.mocked(listDevMessages).mockResolvedValue([]);
    await OutboxMessages({ locale: "en" });
    expect(connection).toHaveBeenCalledTimes(1);
    expect(vi.mocked(connection).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(listDevMessages).mock.invocationCallOrder[0],
    );
  });

  test("no messages: says how to get one, with a link to the login page", async () => {
    vi.mocked(listDevMessages).mockResolvedValue([]);
    renderWithIntl(await OutboxMessages({ locale: "en" }));
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.getByRole("link", { name: "login page" }).getAttribute("href")).toBe("/login");
  });

  test("a message without a code shows who it went to as its title", async () => {
    vi.mocked(listDevMessages).mockResolvedValue([{ ...newer, body: "Your car is ready." }]);
    renderWithIntl(await OutboxMessages({ locale: "en" }));
    expect(screen.getByText("+91 98765 43210")).toBeTruthy();
  });
});
