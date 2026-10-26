import { render, screen } from "@testing-library/react";
import type { VariantProps } from "class-variance-authority";
import { describe, expect, test } from "vitest";

import { Badge, badgeVariants } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";

// Locks in the GoMechanic restyle of the shadcn components (see the
// "GoMechanic changes" comment at the top of each file). Re-adding a component
// with `npx shadcn add --overwrite` would quietly bring back shadcn's
// defaults; these tests fail if that happens.

const classesOf = (element: Element) => [...element.classList];
const split = (classes: string) => classes.split(/\s+/).filter(Boolean);

/**
 * The height in px that an h-* or size-* class gives, for classes with exactly
 * this prefix ("" for always, "pointer-coarse:" for touch screens only).
 * One Tailwind spacing step is 4px, so h-11 is 44px.
 */
function heightPx(classes: string[], prefix = ""): number {
  const pattern = new RegExp(`^${prefix}(?:h|size)-(\\d+(?:\\.\\d+)?)$`);
  const heights = classes.flatMap((name) => {
    const match = pattern.exec(name);
    return match ? [Number(match[1]) * 4] : [];
  });
  return Math.max(0, ...heights);
}

// 44px is the smallest comfortable target for a thumb.
const TOUCH = 44;

// Every button size, and when it reaches 44px. Small sizes stay compact with a
// mouse and grow on touch screens. Listing the sizes as a typed Record means a
// new size added to button.tsx fails `npm run typecheck` until it's listed here.
type ButtonSize = NonNullable<VariantProps<typeof buttonVariants>["size"]>;
const touchTarget: Record<ButtonSize, "always" | "on touch screens"> = {
  default: "always",
  lg: "always",
  icon: "always",
  "icon-lg": "always",
  xs: "on touch screens",
  sm: "on touch screens",
  "icon-xs": "on touch screens",
  "icon-sm": "on touch screens",
};

describe("Button", () => {
  test("is a pill, 44px tall by default", () => {
    render(<Button>Book a service</Button>);
    const classes = classesOf(screen.getByRole("button"));
    expect(classes).toContain("rounded-full");
    expect(heightPx(classes)).toBeGreaterThanOrEqual(TOUCH);
  });

  test.each(Object.entries(touchTarget))("size %s reaches 44px %s, and stays a pill", (size, when) => {
    const classes = split(buttonVariants({ size: size as ButtonSize }));
    if (when === "always") {
      expect(heightPx(classes)).toBeGreaterThanOrEqual(TOUCH);
    } else {
      expect(heightPx(classes, "pointer-coarse:")).toBeGreaterThanOrEqual(TOUCH);
    }
    // No size-specific radius may undo the pill.
    expect(classes.filter((name) => name.startsWith("rounded-"))).toEqual(["rounded-full"]);
  });

  test("the main button darkens on hover with --primary-hover", () => {
    const classes = split(buttonVariants());
    expect(classes).toContain("bg-primary");
    expect(classes).toContain("hover:bg-primary-hover");
  });

  test('variant="link" uses the link blue, not --primary', () => {
    const classes = split(buttonVariants({ variant: "link" }));
    expect(classes).toContain("text-link");
    expect(classes).not.toContain("text-primary");
  });

  test('variant="destructive" is a solid fill with its own text colour', () => {
    const classes = split(buttonVariants({ variant: "destructive" }));
    expect(classes).toContain("bg-destructive");
    expect(classes).toContain("text-destructive-foreground");
  });
});

describe("Input", () => {
  test("is 44px tall, with text of at least 16px so iOS doesn't zoom in", () => {
    render(<Input aria-label="Phone number" />);
    const classes = classesOf(screen.getByRole("textbox"));
    expect(heightPx(classes)).toBeGreaterThanOrEqual(TOUCH);
    expect(classes).toContain("type-body"); // 17px
    // Nothing shrinks the text below 16px, on any screen size.
    expect(classes.filter((name) => /^(?:(?:sm|md|lg|xl|2xl):)?text-(?:xs|sm)$/.test(name))).toEqual([]);
    expect(classes).toEqual(expect.arrayContaining(["rounded-lg", "border-input"]));
  });
});

describe("Badge", () => {
  test("is a pill", () => {
    render(<Badge>New</Badge>);
    expect(classesOf(screen.getByText("New"))).toContain("rounded-4xl");
  });

  test('variant="success" uses the status green', () => {
    render(<Badge variant="success">Open now</Badge>);
    expect(classesOf(screen.getByText("Open now"))).toEqual(
      expect.arrayContaining(["bg-success", "text-success-foreground"]),
    );
  });

  test('variant="link" uses the link blue, not --primary', () => {
    const classes = split(badgeVariants({ variant: "link" }));
    expect(classes).toContain("text-link");
    expect(classes).not.toContain("text-primary");
  });
});

describe("Card", () => {
  test("is a flat rounded tile: no shadow and no ring", () => {
    render(<Card data-testid="card" />);
    const classes = classesOf(screen.getByTestId("card"));
    expect(classes.filter((name) => /^(?:shadow|ring)-/.test(name))).toEqual([]);
    expect(classes).toEqual(expect.arrayContaining(["rounded-xl", "bg-card"]));
  });
});

describe("Sheet", () => {
  test("names its close button with closeLabel, not typed English", () => {
    render(
      <Sheet open>
        <SheetContent closeLabel="Close menu">
          <SheetTitle>Menu</SheetTitle>
          <SheetDescription>Pages and contact details</SheetDescription>
        </SheetContent>
      </Sheet>,
    );
    expect(screen.getByRole("button", { name: "Close menu" })).toBeTruthy();
    expect(screen.queryByText("Close")).toBeNull();
  });
});
