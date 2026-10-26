import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

// The surface classes from globals.css. Each one redefines the colour
// variables, so every component inside the section repaints itself.
const toneClass = {
  white: "", // the default page colours (:root)
  grey: "surface-grey", // the light grey band
  dark: "dark", // the black showcase band (also switches on dark: classes)
} as const;

type SectionProps = ComponentProps<"section"> & {
  /** The surface: the white page (default), the grey band or the black showcase. */
  tone?: keyof typeof toneClass;
  /** How wide the content can get: 980px for text and most sections, 1280px for grids. */
  width?: "content" | "wide";
};

/**
 * One page section: its surface tone, the space above and below it
 * (--section-space) and a centred content box with side padding (--gutter).
 * Pages alternate tones to pace the page, instead of picking colours themselves.
 * Other props (id, aria-labelledby...) go to the <section>.
 */
export function Section({ tone = "white", width = "content", className, children, ...props }: SectionProps) {
  return (
    <section
      className={cn(toneClass[tone], "bg-background py-(--section-space) text-foreground", className)}
      {...props}
    >
      {/* box-content: the max width is for the content, and the gutter padding sits outside it. */}
      <div className={cn("mx-auto box-content px-(--gutter)", width === "wide" ? "max-w-wide" : "max-w-content")}>
        {children}
      </div>
    </section>
  );
}
