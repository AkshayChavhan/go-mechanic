"use client";

import { MenuIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

type MobileMenuProps = {
  /** What screen readers say for the menu button: t("openMenu") from Header. */
  openLabel: string;
  /** The menu's heading: t("menuTitle") from Header. */
  title: string;
  /** The close button's label: t("close") from Common. */
  closeLabel: string;
  /**
   * The menu's content, rendered on the server. Wrap each page link in
   * <SheetClose asChild> so following it closes the menu: the header stays on
   * screen between pages, so the menu would otherwise stay open.
   */
  children: ReactNode;
};

/**
 * The phone menu: a button that slides a panel in from the right.
 *
 * A client component ("island") only because the panel opens and closes in
 * the browser. It reads no messages and imports nothing that does: every
 * label and all the content arrive from the server as props and children, so
 * the browser downloads none of that text twice. The header hides it from
 * 768px up, where the links sit in the header itself.
 */
export function MobileMenu({ openLabel, title, closeLabel, children }: MobileMenuProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={openLabel}>
          <MenuIcon />
        </Button>
      </SheetTrigger>
      {/* aria-describedby={undefined}: the panel has a title but no description
          line. This tells Radix that's on purpose, so it doesn't warn. */}
      <SheetContent closeLabel={closeLabel} aria-describedby={undefined} className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  );
}
