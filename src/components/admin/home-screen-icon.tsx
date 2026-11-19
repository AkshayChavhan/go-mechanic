import "server-only";

import { ImageResponse } from "next/og";

// Draws the staff area's home-screen icons as PNGs (task 26): the same letter
// on the same tile as src/app/icon.svg. Phones want PNGs at fixed sizes for
// the home screen; an SVG favicon isn't enough.
//
// ImageResponse (next/og) turns this small SVG into a PNG. The Route Handlers
// that call it read no request data, so the build draws each icon once.

/** The letter, outlined from Inter Bold: copied from src/app/icon.svg (a test keeps them equal). */
export const LETTER_PATH =
  "M32.64 49Q28 49 24.5 46.94Q21 44.89 19.03 41.08Q17.07 37.27 17.07 32.04Q17.07 26.67 19.11 22.86Q21.16 19.04 24.64 17.02Q28.13 15 32.49 15Q35.29 15 37.7 15.81Q40.11 16.62 41.99 18.11Q43.87 19.6 45.06 21.63Q46.24 23.67 46.6 26.13L39.71 26.13Q39.36 24.93 38.72 23.99Q38.09 23.04 37.19 22.38Q36.29 21.71 35.13 21.37Q33.98 21.02 32.6 21.02Q30.04 21.02 28.09 22.3Q26.13 23.58 25.04 26.02Q23.96 28.47 23.96 31.98Q23.96 35.49 25.03 37.94Q26.11 40.4 28.07 41.69Q30.02 42.98 32.69 42.98Q35.09 42.98 36.8 42.11Q38.51 41.24 39.43 39.63Q40.36 38.02 40.36 35.87L41.78 36.07L33.16 36.07L33.16 30.91L46.93 30.91L46.93 35.04Q46.93 39.4 45.09 42.52Q43.24 45.64 40.02 47.32Q36.8 49 32.64 49Z";

/**
 * The icon as a PNG, `size` pixels square.
 * - `rounded` (the manifest's icons): icon.svg's rounded tile, transparent
 *   corners, as Android shows an icon marked "any".
 * - not rounded (the apple-touch-icon): a full square. iOS rounds the corners
 *   itself and would fill transparent ones with black.
 */
export function homeScreenIcon(size: number, { rounded }: { rounded: boolean }): ImageResponse {
  return new ImageResponse(
    (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width={size} height={size}>
        {/* The tile and letter colours are icon.svg's. */}
        <rect width="64" height="64" rx={rounded ? 14 : 0} fill="#1d1d1f" />
        <path fill="#ffffff" d={LETTER_PATH} />
      </svg>
    ),
    { width: size, height: size },
  );
}
