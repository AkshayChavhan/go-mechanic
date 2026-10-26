import { act, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, test, vi } from "vitest";

import type { OpenStatus as Status, WeeklyHours } from "@/domain/opening-hours";
import { defaultLocale, GARAGE_TIME_ZONE } from "@/i18n/config";
import { renderWithIntl } from "@/i18n/test-utils";
import messages from "../../../messages/en.json";

import { OpenStatus, OpenStatusView } from "./open-status";

// Instants are in UTC; India is 5 h 30 min ahead. 26 Oct 2026 is a Monday.
// The expected text comes from messages/en.json (OpenStatus).

const hours: WeeklyHours = {
  monday: "closed",
  tuesday: { opens: "10:00", closes: "19:00" },
  wednesday: { opens: "10:00", closes: "19:00" },
  thursday: { opens: "10:00", closes: "19:00" },
  friday: { opens: "10:00", closes: "19:00" },
  saturday: { opens: "10:00", closes: "19:00" },
  sunday: { opens: "10:00", closes: "19:00" },
};

const text = messages.OpenStatus;

/** The badge showing `label`, and its shadcn variant. */
function badge(label: string) {
  const element = screen.getByText(label);
  return { element, variant: element.getAttribute("data-variant") };
}

describe("OpenStatusView (one status, as the visitor sees it)", () => {
  test("open: a green badge and the closing time", () => {
    const status: Status = { isOpen: true, closesAt: new Date("2026-10-27T13:30:00Z") };
    renderWithIntl(<OpenStatusView status={status} />);
    expect(badge(text.open).variant).toBe("success");
    expect(screen.getByText("until 7:00 pm")).toBeTruthy();
  });

  test("closed before opening: a grey badge, and it opens today", () => {
    const status: Status = {
      isOpen: false,
      nextOpening: { at: new Date("2026-10-27T04:30:00Z"), when: "today", weekday: "tuesday" },
    };
    renderWithIntl(<OpenStatusView status={status} />);
    // secondary (grey), not red: closed is a normal state, not a problem.
    expect(badge(text.closed).variant).toBe("secondary");
    expect(screen.getByText("Opens today at 10:00 am")).toBeTruthy();
  });

  test("closed on Monday: it opens tomorrow", () => {
    const status: Status = {
      isOpen: false,
      nextOpening: { at: new Date("2026-10-27T04:30:00Z"), when: "tomorrow", weekday: "tuesday" },
    };
    renderWithIntl(<OpenStatusView status={status} />);
    expect(screen.getByText("Opens tomorrow at 10:00 am")).toBeTruthy();
  });

  test("closed on Sunday night: it opens on Tuesday, named by its short weekday", () => {
    const status: Status = {
      isOpen: false,
      nextOpening: { at: new Date("2026-11-03T04:30:00Z"), when: "later", weekday: "tuesday" },
    };
    renderWithIntl(<OpenStatusView status={status} />);
    expect(screen.getByText("Opens Tue at 10:00 am")).toBeTruthy();
  });

  test("no opening at all: the badge alone, with no second line", () => {
    const { container } = renderWithIntl(<OpenStatusView status={{ isOpen: false, nextOpening: null }} />);
    expect(badge(text.closed).variant).toBe("secondary");
    expect(container.textContent).toBe(text.closed);
  });

  test("never breaks a line inside a time (no lone \"am\" in a narrow menu)", () => {
    const opensTomorrow: Status = {
      isOpen: false,
      nextOpening: { at: new Date("2026-10-27T04:30:00Z"), when: "tomorrow", weekday: "tuesday" },
    };
    const { container, unmount } = renderWithIntl(<OpenStatusView status={opensTomorrow} />);
    // U+00A0 is a no-break space: the browser may wrap before "10:00", never before "am".
    expect(container.textContent).toContain("10:00\u00A0am");
    unmount();
    renderWithIntl(<OpenStatusView status={{ isOpen: true, closesAt: new Date("2026-10-27T13:30:00Z") }} />);
    expect(screen.getByText(/until/).textContent).toBe("until 7:00\u00A0pm");
  });

  test("marks the state for tests and styles", () => {
    const { container } = renderWithIntl(
      <OpenStatusView status={{ isOpen: true, closesAt: new Date("2026-10-27T13:30:00Z") }} />,
    );
    expect(container.querySelector("[data-open-status]")?.getAttribute("data-open-status")).toBe("open");
  });
});

describe("OpenStatus (live, from the visitor's clock)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("turns from open to closed at 19:00 India time, without a reload", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-27T13:29:30Z")); // Tuesday 18:59:30 IST
    renderWithIntl(<OpenStatus hours={hours} />);
    expect(screen.getByText(text.open)).toBeTruthy();

    // One millisecond before 19:00 nothing has changed yet.
    act(() => vi.advanceTimersByTime(29_999));
    expect(screen.getByText(text.open)).toBeTruthy();

    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByText(text.closed)).toBeTruthy();
    expect(screen.getByText("Opens tomorrow at 10:00 am")).toBeTruthy();
  });

  test("checks again when the visitor comes back to the tab", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-27T12:30:00Z")); // Tuesday 18:00 IST
    renderWithIntl(<OpenStatus hours={hours} />);
    expect(screen.getByText(text.open)).toBeTruthy();

    // A hidden tab's timers may not run: the clock jumps on without them.
    vi.setSystemTime(new Date("2026-10-27T13:35:00Z")); // Tuesday 19:05 IST
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(screen.getByText(text.closed)).toBeTruthy();
  });

  test("checks again when the page comes back from the back/forward cache", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-26T06:30:00Z")); // Monday 12:00 IST
    renderWithIntl(<OpenStatus hours={hours} />);
    expect(screen.getByText(text.closed)).toBeTruthy();

    vi.setSystemTime(new Date("2026-10-27T05:30:00Z")); // Tuesday 11:00 IST
    act(() => {
      window.dispatchEvent(new Event("pageshow"));
    });
    expect(screen.getByText(text.open)).toBeTruthy();
  });

  test("stops its timer when it's removed from the page", () => {
    vi.useFakeTimers();
    const { unmount } = renderWithIntl(<OpenStatus hours={hours} />);
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("OpenStatus on the server (the prebuilt HTML)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const page = (
    <NextIntlClientProvider locale={defaultLocale} messages={messages} timeZone={GARAGE_TIME_ZONE}>
      <OpenStatus hours={hours} />
    </NextIntlClientProvider>
  );

  test("holds an empty slot, never a status: the HTML can't depend on when it was built", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-27T05:30:00Z")); // Tuesday 11:00 IST: open
    const html = renderToString(page);
    expect(html).toContain('data-open-status="pending"');
    expect(html).not.toContain(text.open);
    expect(html).not.toContain(text.closed);
  });

  test("the browser takes over the prebuilt HTML without a hydration mismatch", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-27T05:30:00Z")); // Tuesday 11:00 IST: open
    const container = document.createElement("div");
    container.innerHTML = renderToString(page);
    document.body.append(container);

    const errors: unknown[] = [];
    const root = await act(async () =>
      hydrateRoot(container, page, { onRecoverableError: (error) => errors.push(error) }),
    );
    expect(errors).toEqual([]);
    expect(container.querySelector("[data-open-status]")?.getAttribute("data-open-status")).toBe("open");

    act(() => root.unmount());
    container.remove();
  });
});
