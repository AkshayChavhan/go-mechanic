// Colour contrast, as WCAG 2.2 defines it. Used by the design-token test and
// by the colour swatches on the /dev/design preview.
// https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio

// "#1d1d1f" or "#fff" -> [29, 29, 31]. Anything else throws, so a colour in
// another format (oklch, a name) fails loudly instead of being skipped.
function hexToRgb(hex: string): [number, number, number] {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex);
  if (!match) throw new Error(`Expected a hex colour like #1d1d1f or #fff, got "${hex}"`);
  const digits = match[1].length === 3 ? [...match[1]].map((digit) => digit + digit).join("") : match[1];
  return [0, 2, 4].map((start) => parseInt(digits.slice(start, start + 2), 16)) as [number, number, number];
}

// How bright a colour looks to the eye, from 0 (black) to 1 (white). Green
// counts most and blue least, because that's how sensitive our eyes are.
function relativeLuminance(hex: string): number {
  const [red, green, blue] = hexToRgb(hex).map((value) => {
    // Undo the sRGB "gamma" curve, so the numbers are proportional to light.
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

// From 1 (no contrast) to 21 (black on white). The order of the two colours
// doesn't matter. AA needs 4.5 for text and 3 for borders and focus outlines.
export function contrastRatio(foreground: string, background: string): number {
  const [lighter, darker] = [relativeLuminance(foreground), relativeLuminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}
