import { render, screen } from "@testing-library/react";
import type { VariantProps } from "class-variance-authority";
import { describe, expect, test } from "vitest";

import { Badge, badgeVariants } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";

// Locks in our restyle of the shadcn components (see the "Our changes to
// shadcn's ..." comment at the top of each file). Re-adding a component with
// `npx shadcn add --overwrite` would quietly bring back shadcn's defaults;
// these tests fail if that happens.

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
    // No size-specific radius may undo the pill, not even behind a prefix
    // such as in-data-[slot=button-group]:rounded-lg.
    expect(classes.filter((name) => /(^|:)rounded-/.test(name))).toEqual(["rounded-full"]);
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

  test("an invalid button keeps the full red border inside .dark sections", () => {
    // shadcn's 50% red border is about 2.2:1 on black; a border that marks a
    // problem needs 3:1.
    expect(split(buttonVariants())).not.toContain("dark:aria-invalid:border-destructive/50");
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

  test("an invalid field keeps the full red border inside .dark sections", () => {
    render(<Input aria-label="Phone number" />);
    // shadcn's 50% red border is about 2.2:1 on black; it needs 3:1.
    expect(classesOf(screen.getByRole("textbox"))).not.toContain("dark:aria-invalid:border-destructive/50");
  });

  test("has no grey fill inside .dark sections, so placeholder text stays readable", () => {
    render(<Input aria-label="Phone number" />);
    const classes = classesOf(screen.getByRole("textbox"));
    expect(classes).not.toContain("dark:bg-input/30");
    expect(classes).not.toContain("dark:disabled:bg-input/80");
  });
});

describe("NativeSelect", () => {
  const renderSelect = () =>
    render(
      <NativeSelect aria-label="Brand">
        <NativeSelectOption value="car-honda">Honda</NativeSelectOption>
      </NativeSelect>,
    );

  test("is 44px tall, full width, with text of at least 16px so iOS doesn't zoom in", () => {
    renderSelect();
    const select = screen.getByRole("combobox", { name: "Brand" });
    const classes = classesOf(select);
    expect(heightPx(classes)).toBeGreaterThanOrEqual(TOUCH);
    expect(classes).toContain("type-body"); // 17px
    expect(classes.filter((name) => /^(?:(?:sm|md|lg|xl|2xl):)?text-(?:xs|sm)$/.test(name))).toEqual([]);
    expect(classes).toEqual(expect.arrayContaining(["rounded-lg", "border-input"]));
    // shadcn's wrapper was w-fit; ours fills the row like every other field.
    expect(classesOf(select.parentElement!)).toContain("w-full");
  });

  test("has no small size (shadcn's was 28px tall)", () => {
    renderSelect();
    const classes = classesOf(screen.getByRole("combobox"));
    expect(classes.filter((name) => name.startsWith("data-[size=sm]"))).toEqual([]);
  });

  test("has no grey fill inside .dark sections, and keeps the full red border when invalid", () => {
    renderSelect();
    const classes = classesOf(screen.getByRole("combobox"));
    expect(classes).not.toContain("dark:bg-input/30");
    expect(classes).not.toContain("dark:hover:bg-input/50");
    expect(classes).not.toContain("dark:aria-invalid:border-destructive/50");
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

  test('variant="destructive" is a solid fill, not red text on a light red tint', () => {
    const classes = split(badgeVariants({ variant: "destructive" }));
    expect(classes).toEqual(
      expect.arrayContaining(["bg-destructive", "text-destructive-foreground", "[a]:hover:bg-destructive/90"]),
    );
    expect(classes).not.toContain("bg-destructive/10");
  });

  test("a default badge used as a link darkens on hover with --primary-hover", () => {
    const classes = split(badgeVariants());
    expect(classes).toContain("[a]:hover:bg-primary-hover");
    expect(classes).not.toContain("[a]:hover:bg-primary/80");
  });
});

describe("Card", () => {
  test("is a flat rounded tile: no shadow and no ring", () => {
    render(<Card data-testid="card" />);
    const classes = classesOf(screen.getByTestId("card"));
    expect(classes.filter((name) => /^(?:shadow|ring)-/.test(name))).toEqual([]);
    expect(classes).toEqual(expect.arrayContaining(["rounded-xl", "bg-card"]));
  });

  test("its text sizes come from type-* classes, with nothing that would override them", () => {
    render(
      <Card data-testid="card">
        <CardTitle>Brake service</CardTitle>
        <CardDescription>Pads, discs and brake fluid</CardDescription>
      </Card>,
    );
    const card = screen.getByTestId("card");
    const title = screen.getByText("Brake service");
    const description = screen.getByText("Pads, discs and brake fluid");
    expect(classesOf(card)).toContain("type-callout");
    expect(classesOf(title)).toContain("type-title");
    expect(classesOf(description)).toContain("type-callout");
    // Tailwind puts these after type-* in the CSS, so on the same element they
    // would win over it (and over a type-* class a page passes in).
    const overrides = /^(?:text-(?:xs|sm|base|lg|[2-9]?xl)|leading-.+|tracking-.+)$/;
    for (const element of [card, title, description]) {
      expect(classesOf(element).filter((name) => overrides.test(name))).toEqual([]);
    }
  });
});

describe("Card, small", () => {
  test('a size="sm" card has a 17px semibold title from the type scale', () => {
    render(
      <Card size="sm">
        <CardTitle>Wheel alignment</CardTitle>
      </Card>,
    );
    const classes = classesOf(screen.getByText("Wheel alignment"));
    expect(classes).toEqual(
      expect.arrayContaining(["group-data-[size=sm]/card:type-body", "group-data-[size=sm]/card:font-semibold"]),
    );
    expect(classes.filter((name) => name.startsWith("group-data-[size=sm]/card:text-"))).toEqual([]);
  });
});

describe("Field", () => {
  test("a link in a description turns --link blue on hover, not --primary", () => {
    render(
      <FieldDescription>
        We send booking updates by SMS. <a href="#settings">Change it</a>
      </FieldDescription>,
    );
    const classes = classesOf(screen.getByText(/We send booking updates/));
    expect(classes).toContain("[&>a:hover]:text-link");
    expect(classes).not.toContain("[&>a:hover]:text-primary");
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
    const close = screen.getByRole("button", { name: "Close menu" });
    expect(screen.queryByText("Close")).toBeNull();
    // icon-sm: 36px with a mouse, 44px on touch screens (see the Button tests).
    expect(close.getAttribute("data-size")).toBe("icon-sm");
  });
});
