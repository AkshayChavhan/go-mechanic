"use client";

import { createContext, useContext, useState, type CSSProperties, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

// Previews the page in Inter, the font most Android and Windows visitors get.
// The owner works on a Mac, which always picks San Francisco first, so without
// this switch they would never see Inter. It's an inline style on the page
// wrapper, so none of it ends up in the site's CSS.

type Font = "system" | "inter";

// --font-sans-stack without the two Apple names: what other devices end up
// with. font-sans, font-heading and plain text all read this variable.
const interOnly = {
  "--font-sans-stack": "var(--font-inter), var(--font-devanagari), sans-serif",
  fontFamily: "var(--font-sans-stack)",
} as CSSProperties;

const FontContext = createContext<{ font: Font; setFont: (font: Font) => void }>({
  font: "system",
  setFont: () => {},
});

/** Wraps the whole preview, so everything inside follows the switch. */
export function FontPreview({ children }: { children: ReactNode }) {
  const [font, setFont] = useState<Font>("system");
  return (
    <FontContext.Provider value={{ font, setFont }}>
      <div data-font-preview={font} style={font === "inter" ? interOnly : undefined}>
        {children}
      </div>
    </FontContext.Provider>
  );
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
