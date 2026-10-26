"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

// Previews the page in Inter, the font most Android and Windows visitors get.
// The owner works on a Mac, which always picks San Francisco first, so without
// this switch they would never see Inter. It's an inline style on <html> while
// the page is open, so none of it ends up in the site's CSS.

type Font = "system" | "inter";

// --font-sans-stack without the two Apple names: what other devices end up
// with. font-sans, font-heading and plain text all read this variable.
const interOnly = "var(--font-inter), var(--font-devanagari), sans-serif";

const FontContext = createContext<{ font: Font; setFont: (font: Font) => void }>({
  font: "system",
  setFont: () => {},
});

/** Holds the switch's state for the whole preview. */
export function FontPreview({ children }: { children: ReactNode }) {
  const [font, setFont] = useState<Font>("system");

  // Set on <html>, not on a wrapper around the page: the sheet and other
  // overlays render at the end of <body> (a portal), outside any wrapper.
  // The cleanup puts San Francisco back when the switch or the page goes away.
  useEffect(() => {
    if (font !== "inter") return;
    const html = document.documentElement;
    html.style.setProperty("--font-sans-stack", interOnly);
    return () => {
      html.style.removeProperty("--font-sans-stack");
    };
  }, [font]);

  return <FontContext.Provider value={{ font, setFont }}>{children}</FontContext.Provider>;
}

/** The two-way switch: San Francisco (Apple devices) or Inter (everything else). */
export function FontToggle() {
  const { font, setFont } = useContext(FontContext);
  const options: [Font, string][] = [
    ["system", "San Francisco"],
    ["inter", "Inter"],
  ];
  return (
    <div role="group" aria-label="Preview font" className="flex gap-1">
      {options.map(([value, label]) => (
        <Button
          key={value}
          size="sm"
          variant={font === value ? "secondary" : "ghost"}
          aria-pressed={font === value}
          onClick={() => setFont(value)}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}
