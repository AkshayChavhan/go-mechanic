import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import messages from "../../../messages/en.json";

// MobileMenu loads its panel lazily (task 18). Each test imports a fresh copy
// (vi.resetModules), so "has the panel loaded yet?" starts from no every
// time, and some tests replace the panel's file with vi.doMock.
const panel = vi.hoisted(() => ({ loaded: vi.fn() }));

const links = [{ href: "/services", label: "Services" }];

async function renderMenu() {
  // Imported after vi.resetModules too, so the provider and the menu's links
  // share one copy of next-intl.
  const { renderWithIntl } = await import("@/i18n/test-utils");
  const { MobileMenu } = await import("./mobile-menu");
  renderWithIntl(
    <MobileMenu
      openLabel={messages.Header.openMenu}
      title={messages.Header.menuTitle}
      closeLabel={messages.Common.close}
      links={links}
    >
      <a href="#services">Services</a>
      <p>Open today</p>
    </MobileMenu>,
  );
  return screen.getByRole("button", { name: messages.Header.openMenu });
}

/** Opens the menu and waits for the real panel (the server-rendered content shows only in it). */
async function openMenu() {
  const trigger = screen.getByRole("button", { name: messages.Header.openMenu });
  fireEvent.click(trigger);
  await screen.findByText("Open today");
  return { trigger, dialog: screen.getByRole("dialog", { name: messages.Header.menuTitle }) };
}

beforeEach(() => {
  vi.resetModules();
  panel.loaded.mockClear();
});
afterEach(() => {
  vi.doUnmock("./mobile-menu-panel");
});

describe("MobileMenu", () => {
  test("starts closed: a menu button named from messages, saying it's collapsed", async () => {
    const trigger = await renderMenu();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(trigger.getAttribute("aria-haspopup")).toBe("dialog");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("doesn't load the panel before it's needed, and starts on pointer-down", async () => {
    vi.doMock("./mobile-menu-panel", async () => {
      panel.loaded();
      return vi.importActual("./mobile-menu-panel");
    });
    const trigger = await renderMenu();
    expect(panel.loaded).not.toHaveBeenCalled();
    fireEvent.pointerDown(trigger);
    await waitFor(() => expect(panel.loaded).toHaveBeenCalled());
  });

  test("focus starts the download too (the keyboard path)", async () => {
    vi.doMock("./mobile-menu-panel", async () => {
      panel.loaded();
      return vi.importActual("./mobile-menu-panel");
    });
    const trigger = await renderMenu();
    fireEvent.focus(trigger);
    await waitFor(() => expect(panel.loaded).toHaveBeenCalled());
  });

  test("once the panel has loaded after pointer-down, the click opens the real panel at once, never the plain one", async () => {
    const trigger = await renderMenu();
    fireEvent.pointerDown(trigger);
    // The panel mounts closed and loads: nothing shows yet.
    await act(async () => {
      await import("./mobile-menu-panel");
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(trigger);
    // Straight after the click, without waiting: the real panel's own content.
    expect(screen.getByRole("dialog", { name: messages.Header.menuTitle }).textContent).toContain("Open today");
  });

  test("the button opens a dialog titled from messages, holding the content it was given", async () => {
    await renderMenu();
    const { trigger, dialog } = await openMenu();
    expect(dialog.textContent).toContain("Services");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("button", { name: messages.Common.close })).toBeTruthy();
  });

  test("Escape closes it, and focus goes back to the menu button", async () => {
    await renderMenu();
    const { trigger, dialog } = await openMenu();
    act(() => {
      fireEvent.keyDown(dialog, { key: "Escape" });
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  test("the close button closes it", async () => {
    await renderMenu();
    await openMenu();
    fireEvent.click(screen.getByRole("button", { name: messages.Common.close }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  test("following any link in it closes it, with no wrapper around the link", async () => {
    await renderMenu();
    await openMenu();
    fireEvent.click(screen.getByRole("link", { name: "Services" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  test("a tap elsewhere in the panel leaves it open", async () => {
    await renderMenu();
    await openMenu();
    fireEvent.click(screen.getByText("Open today"));
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  test("if the panel can't be downloaded: the title and the pages, as plain links, and a close button", async () => {
    vi.doMock("./mobile-menu-panel", () => {
      throw new Error("the chunk failed to load");
    });
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const trigger = await renderMenu();
    fireEvent.click(trigger);
    const dialog = await screen.findByRole("dialog", { name: messages.Header.menuTitle });
    expect(screen.getByRole("link", { name: "Services" }).getAttribute("href")).toBe("/services");
    // Wait until the failure has settled, then check the plain panel is still there.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByRole("dialog", { name: messages.Header.menuTitle })).toBe(dialog);
    expect(dialog.textContent).not.toContain("Open today");
    // Drawn into document.body, not inside the header: there `fixed` would be
    // measured against the header's box (its backdrop-filter), not the screen.
    expect(dialog.parentElement).toBe(document.body);
    fireEvent.click(screen.getByRole("button", { name: messages.Common.close }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    quiet.mockRestore();
  });

  test("if the panel can't be downloaded: following a plain link closes the menu", async () => {
    vi.doMock("./mobile-menu-panel", () => {
      throw new Error("the chunk failed to load");
    });
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const trigger = await renderMenu();
    fireEvent.click(trigger);
    await screen.findByRole("dialog", { name: messages.Header.menuTitle });
    // jsdom can't load another page: this listener on document stops its page
    // load after React has handled the click.
    const stayOnPage = (event: Event) => event.preventDefault();
    document.addEventListener("click", stayOnPage);
    try {
      fireEvent.click(screen.getByRole("link", { name: "Services" }));
    } finally {
      document.removeEventListener("click", stayOnPage);
    }
    expect(screen.queryByRole("dialog")).toBeNull();
    quiet.mockRestore();
  });
});
