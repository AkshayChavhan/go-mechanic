import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import messages from "../../../messages/en.json";

import { MobileMenu } from "./mobile-menu";

// MobileMenu gets every label as a prop (it's a client island and reads no
// messages itself), so the test passes the real ones from messages/en.json.
function Menu() {
  return (
    <MobileMenu
      openLabel={messages.Header.openMenu}
      title={messages.Header.menuTitle}
      closeLabel={messages.Common.close}
    >
      <a href="#services">Services</a>
      <p>Open today</p>
    </MobileMenu>
  );
}

function openMenu() {
  const trigger = screen.getByRole("button", { name: messages.Header.openMenu });
  fireEvent.click(trigger);
  return { trigger, dialog: screen.getByRole("dialog", { name: messages.Header.menuTitle }) };
}

describe("MobileMenu", () => {
  test("starts closed, with a menu button named from messages", () => {
    render(<Menu />);
    expect(screen.getByRole("button", { name: messages.Header.openMenu })).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("the button opens a dialog titled from messages, holding the content it was given", () => {
    render(<Menu />);
    const { dialog } = openMenu();
    expect(dialog.textContent).toContain("Services");
    expect(screen.getByRole("button", { name: messages.Common.close })).toBeTruthy();
  });

  test("Escape closes it, and focus goes back to the menu button", async () => {
    render(<Menu />);
    const { trigger, dialog } = openMenu();
    act(() => {
      fireEvent.keyDown(dialog, { key: "Escape" });
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  test("the close button closes it", () => {
    render(<Menu />);
    openMenu();
    fireEvent.click(screen.getByRole("button", { name: messages.Common.close }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("following any link in it closes it, with no wrapper around the link", () => {
    render(<Menu />);
    openMenu();
    fireEvent.click(screen.getByRole("link", { name: "Services" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("a tap elsewhere in the panel leaves it open", () => {
    render(<Menu />);
    openMenu();
    fireEvent.click(screen.getByText("Open today"));
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});
