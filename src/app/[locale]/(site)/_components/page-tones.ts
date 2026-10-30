// Section tones for the info pages (contact, about, FAQ, privacy, terms),
// worked out from how many sections a page actually shows.
//
// The same rules as the home page (home-tones.ts): neighbouring sections
// never share a tone, the grey footer included. The about page and the FAQ
// show more sections under `npm run dev` (samples) than in production, so
// their tones can't be fixed in the markup. White and grey alternate from
// the top; if the last section would be grey, it's black instead, so it
// never merges with the footer.

import type { Tone } from "./home-tones";

export function pageTones(count: number): Tone[] {
  const tones = Array.from({ length: count }, (_, index): Tone => (index % 2 === 0 ? "white" : "grey"));
  if (tones.at(-1) === "grey") tones[tones.length - 1] = "dark";
  return tones;
}
