// Motion tokens: how long things move, and how they speed up and slow down.
// GSAP animations (task 13) read them from here. globals.css has the same
// values as CSS variables (--duration-*, --ease-*), and motion.test.ts keeps
// the two equal, so CSS transitions and GSAP animations feel the same.

/** How long a movement takes, in seconds (GSAP's unit). */
export const duration = {
  fast: 0.15, // press and hover feedback
  base: 0.25, // menus, small transitions
  slow: 0.45, // sheets and overlays
  reveal: 0.8, // scroll reveals
} as const;

/**
 * How a movement speeds up and slows down. Each CSS curve is a close match of
 * the GSAP ease next to it, so no extra GSAP plugin is needed.
 */
export const ease = {
  // Most motion: starts quickly, settles gently.
  standard: { gsap: "power2.out", css: "cubic-bezier(0.33, 1, 0.68, 1)" },
  // Big entrances: a longer, softer settle.
  emphasized: { gsap: "power4.out", css: "cubic-bezier(0.22, 1, 0.36, 1)" },
  // Things leaving: speeds up as it goes (use a shorter duration than entering).
  exit: { gsap: "power2.in", css: "cubic-bezier(0.32, 0, 0.67, 0)" },
} as const;

// The two cases for gsap.matchMedia(): animate only when the visitor hasn't
// asked their device for less motion, and otherwise show the end state.
// Content must be visible before any JavaScript runs.
export const motionAllowed = "(prefers-reduced-motion: no-preference)";
export const motionReduced = "(prefers-reduced-motion: reduce)";
