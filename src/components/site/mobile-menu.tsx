"use client";

import { MenuIcon, XIcon } from "lucide-react";
import { Component, lazy, Suspense, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

import type { NavLinkItem } from "./nav-links";

type MobileMenuProps = {
  /** What screen readers say for the menu button: t("openMenu") from Header. */
  openLabel: string;
  /** The menu's heading: t("menuTitle") from Header. */
  title: string;
  /** The close button's label: t("close") from Common. */
  closeLabel: string;
  /** The live pages, shown as plain links while the panel loads, or if it can't. */
  links: readonly NavLinkItem[];
  /**
   * The menu's content, rendered on the server. Tapping any link in it closes
   * the menu: the header stays on screen between pages, so the menu would
   * otherwise stay open on the next page.
   */
  children: ReactNode;
};

// The panel and the Radix dialog code it brings (about 14 KB compressed,
// measured in task 18) load only when the menu is first needed: on the
// button's pointer-down or focus. Before task 18 they loaded on every page,
// desktop too.
const loadPanel = () => import("./mobile-menu-panel");
const LazyPanel = lazy(() => loadPanel().then((module) => ({ default: module.MobileMenuPanel })));

/** Starts downloading the panel. Safe to call again: the browser fetches it once. */
function preload() {
  loadPanel().catch(() => {
    // Shown later: the menu falls back to its plain panel (below).
  });
}

type PlainPanelProps = Pick<MobileMenuProps, "title" | "closeLabel" | "links"> & { onClose: () => void };

/**
 * What shows when the menu is opened before the real panel has loaded (a slow
 * connection), or for good if it can't be downloaded: the title and the live
 * pages as plain links, so the pages are always reachable, and a close button.
 * Drawn into document.body, like the real panel: inside the header, whose
 * backdrop-filter makes it the box that `fixed` is measured against, it would
 * be only as tall as the header.
 */
function PlainPanel({ title, closeLabel, links, onClose }: PlainPanelProps) {
  return (
    <div
      role="dialog"
      aria-label={title}
      className="fixed inset-y-0 right-0 z-50 flex w-3/4 flex-col gap-4 border-l border-border bg-popover p-4 text-popover-foreground sm:max-w-sm"
    >
      <div className="flex items-center justify-between gap-4">
        <p className="type-body font-medium">{title}</p>
        <Button variant="ghost" size="icon-sm" onClick={onClose}>
          <XIcon />
          <span className="sr-only">{closeLabel}</span>
        </Button>
      </div>
      <ul className="flex flex-col">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} onClick={onClose} className="flex min-h-11 items-center type-title">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Shows `fallback` instead of the real panel if its download fails (React.lazy throws it while rendering). */
class PlainPanelOnError extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/**
 * The phone menu: a button that slides a panel in from the right.
 *
 * A client island only because the panel opens and closes in the browser. It
 * reads no messages: every label, the links and the content arrive from the
 * server as props and children. The header hides it from 768px up, where the
 * links sit in the header itself.
 *
 * The button is a plain button, not a Radix trigger (that would bring the
 * dialog code back into every page), so this file does a trigger's two jobs
 * itself: aria-expanded says whether the menu is open, and focus goes back to
 * the button when the menu closes.
 */
export function MobileMenu({ openLabel, title, closeLabel, links, children }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  // Once the menu has been wanted (pointer-down, focus or a click), the panel
  // stays mounted, so it can load ahead and animate out.
  const [requested, setRequested] = useState(false);
  const button = useRef<HTMLButtonElement>(null);

  const close = () => {
    setOpen(false);
    button.current?.focus();
  };
  // Only called once the menu has been asked for, so in the browser:
  // document.body exists there and never on the server.
  const plain = () =>
    open
      ? createPortal(<PlainPanel title={title} closeLabel={closeLabel} links={links} onClose={close} />, document.body)
      : null;
  // Pointer-down and focus come before the click: start the download and
  // mount the panel, still closed, so React.lazy has its code by the click and
  // the real panel opens at once. Mounting it only on the click would always
  // show the plain panel first (lazy suspends on its first render), and React
  // then holds the swap for about 300 ms.
  const prepare = () => {
    preload();
    setRequested(true);
  };

  return (
    <>
      <Button
        ref={button}
        variant="ghost"
        size="icon"
        aria-label={openLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        onPointerDown={prepare}
        onFocus={prepare}
        onClick={() => {
          setRequested(true);
          setOpen(true);
        }}
      >
        <MenuIcon />
      </Button>
      {requested && (
        <PlainPanelOnError fallback={plain()}>
          <Suspense fallback={plain()}>
            <LazyPanel
              open={open}
              onOpenChange={setOpen}
              title={title}
              closeLabel={closeLabel}
              onClosed={() => button.current?.focus()}
            >
              {children}
            </LazyPanel>
          </Suspense>
        </PlainPanelOnError>
      )}
    </>
  );
}
