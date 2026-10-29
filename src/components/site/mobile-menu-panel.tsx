"use client";

import type { MouseEvent, ReactNode } from "react";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type MobileMenuPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  closeLabel: string;
  /** Called after the panel has closed, to put focus back on the menu button. */
  onClosed: () => void;
  children: ReactNode;
};

/**
 * The phone menu's panel: a Radix dialog that slides in from the right. Its
 * own file, so MobileMenu can load it (and the dialog code, about 14 KB
 * compressed) only when the menu is first needed, instead of on every page.
 * Never import it anywhere else.
 */
export function MobileMenuPanel({ open, onOpenChange, title, closeLabel, onClosed, children }: MobileMenuPanelProps) {
  // One listener for the whole panel: the links arrive as server-rendered
  // children, so they can't each be wrapped in a close button here.
  const closeOnLink = (event: MouseEvent<HTMLElement>) => {
    if (event.target instanceof Element && event.target.closest("a[href]")) onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* aria-describedby={undefined}: the panel has a title but no description
          line. This tells Radix that's on purpose, so it doesn't warn.
          onCloseAutoFocus: there's no Radix trigger to go back to (the menu
          button is MobileMenu's own), so MobileMenu focuses it itself. */}
      <SheetContent
        closeLabel={closeLabel}
        aria-describedby={undefined}
        className="overflow-y-auto"
        onClick={closeOnLink}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onClosed();
        }}
      >
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  );
}
