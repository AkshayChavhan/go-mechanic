import { screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { renderWithIntl } from "@/i18n/test-utils";

import OutboxPage, { generateMetadata } from "./page";

// The list (it reads the database) is tested on its own
// (_components/outbox-messages.test.tsx); here it's a marker.
vi.mock("./_components/outbox-messages", () => ({
  OutboxMessages: () => <p data-testid="outbox-messages" />,
}));

// What notFound() throws: Next.js shows the 404 page when it catches it.
const NOT_FOUND = "NEXT_HTTP_ERROR_FALLBACK;404";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("/dev/outbox", () => {
  test("under npm run dev: the heading, Refresh, and the list", () => {
    vi.stubEnv("NODE_ENV", "development");
    renderWithIntl(<OutboxPage />);
    expect(screen.getAllByRole("heading", { level: 1 }).map((heading) => heading.textContent)).toEqual(["Outbox"]);
    // A plain link that loads the page again (not a client-side navigation).
    const refresh = screen.getByRole("link", { name: "Refresh" });
    expect(refresh.getAttribute("href")).toBe("/dev/outbox");
    expect(screen.getByTestId("outbox-messages")).toBeTruthy();
  });

  test("anywhere else: a 404, from the page and from its metadata", () => {
    expect(process.env.NODE_ENV).toBe("test");
    expect(() => OutboxPage()).toThrow(expect.objectContaining({ digest: NOT_FOUND }));
    expect(() => generateMetadata()).toThrow(expect.objectContaining({ digest: NOT_FOUND }));
  });

  test("metadata under npm run dev: noindex", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(generateMetadata()).toEqual({ title: "Outbox", robots: { index: false, follow: false } });
  });
});
