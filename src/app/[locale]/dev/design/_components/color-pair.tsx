"use client";

import { useEffect, useRef, useState } from "react";

import { contrastRatio } from "@/lib/color-contrast";
import { cn } from "@/lib/utils";

// A colour swatch that measures its own contrast in the browser, adapted from
// the shadcn skill's showcase helper (.claude/skills/shadcn/assets/showcase/).
// It reads the colours the browser really paints, so it also proves the
// .surface-grey and .dark scopes work. The data-contrast-* attributes let
// e2e/dev/design-preview.spec.ts check every swatch on the page.

/** Any CSS colour -> [r, g, b], by painting one pixel over the backdrop. */
function toRgb(color: string, backdrop: string): number[] {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return [0, 0, 0];
  context.fillStyle = backdrop;
  context.fillRect(0, 0, 1, 1);
  context.fillStyle = color;
  context.fillRect(0, 0, 1, 1);
  const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
  return [red, green, blue];
}

const toHex = (rgb: number[]) => `#${rgb.map((value) => value.toString(16).padStart(2, "0")).join("")}`;

type ColorPairProps = {
  /** What the pair is for, in plain words: "Secondary text on a tile". */
  label: string;
  /** The surface token, without "--": "card". */
  surface: string;
  /** The text or line token on it: "muted-foreground". */
  foreground: string;
  /** Text needs 4.5:1. A line (field border, focus outline) needs 3:1. */
  kind?: "text" | "line";
};

export function ColorPair({ label, surface, foreground, kind = "text" }: ColorPairProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLSpanElement>(null);
  const [ratio, setRatio] = useState<number | null>(null);
  const minimum = kind === "text" ? 4.5 : 3;

  useEffect(() => {
    // Measure after the browser has painted, so the colours are final.
    const frame = requestAnimationFrame(() => {
      if (!surfaceRef.current || !markRef.current) return;
      const surfaceStyle = getComputedStyle(surfaceRef.current);
      const markStyle = getComputedStyle(markRef.current);
      const background = toHex(toRgb(surfaceStyle.backgroundColor, "#ffffff"));
      const mark = toHex(toRgb(kind === "text" ? markStyle.color : markStyle.borderTopColor, background));
      setRatio(contrastRatio(mark, background));
    });
    return () => cancelAnimationFrame(frame);
  }, [kind]);

  const passes = ratio !== null && ratio >= minimum;

  return (
    <figure
      data-contrast-ratio={ratio?.toFixed(2)}
      data-contrast-min={minimum}
      className="flex flex-col overflow-hidden rounded-xl border border-border"
    >
      <div
        ref={surfaceRef}
        style={{ backgroundColor: `var(--${surface})`, color: `var(--${foreground})` }}
        className="flex min-h-24 flex-wrap content-end items-end justify-between gap-2 p-3"
      >
        {kind === "text" ? (
          <span ref={markRef} className="type-title">
            Aa
          </span>
        ) : (
          <span
            ref={markRef}
            style={{ borderColor: `var(--${foreground})` }}
            className="block h-10 w-16 rounded-lg border-2"
          />
        )}
        {/* On a line swatch the line colour only needs 3:1, too faint for text,
            so the label uses the text colour instead. */}
        <span
          className={cn(
            "type-caption rounded-full border border-current/25 px-2 py-0.5 tabular-nums",
            kind === "line" && "text-foreground",
          )}
        >
          {ratio === null ? "…" : `${ratio.toFixed(2)}:1 ${passes ? "pass" : "fail"}`}
        </span>
      </div>
      <figcaption className="flex flex-col gap-0.5 bg-background p-3">
        <span className="type-callout font-medium">{label}</span>
        <span className="type-caption wrap-anywhere text-muted-foreground">
          --{foreground} on --{surface}, needs {minimum}:1
        </span>
      </figcaption>
    </figure>
  );
}
