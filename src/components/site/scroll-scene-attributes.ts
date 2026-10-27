// The data attributes that tell ScrollScene's effects what to animate
// (plan KTD3).
//
// Server Components mark their markup with these, and the effects
// (scroll-scene-effects.tsx) look for them inside the ScrollScene only. So
// the sections hold no animation code, and another page can get scroll motion
// by wrapping its sections in <ScrollScene> and marking them, with no new
// client code. A plain module (no "use client"): server and client code both
// import it.
//
// Every marked element is fully visible in the server's HTML. The effects
// only move it, and only when the visitor allows motion.

export const sceneAttribute = {
  /** The ScrollScene's own wrapper. */
  root: "data-scroll-scene",
  /**
   * A heading, paragraph, tile or visual that fades and rises into place the
   * first time it scrolls into view. Never put it on, inside or around a link
   * or a button: keyboard focus could land on something invisible. (The
   * effects skip such an element.)
   */
  reveal: "data-scene-reveal",
  /**
   * A list or grid whose direct children reveal like `reveal`, one after
   * another (the services tiles). Same rule: no links or buttons inside.
   */
  revealGroup: "data-scene-reveal-group",
  /**
   * The digits of a counting number, and nothing else ("5,000", not
   * "5,000+"). Its value is the final number ("5000"); the server renders the
   * final digits inside it. It belongs in the aria-hidden copy of the number,
   * next to the copy screen readers read (plan KTD6; StatTile builds both).
   */
  count: "data-scene-count",
  /** Digits after the decimal point for `count`: "1" for a rating. Leave it out for whole numbers. */
  countDecimals: "data-scene-count-decimals",
  /** The story section: the vehicle visual and the steps beside it. */
  story: "data-scene-story",
  /**
   * The wrapper inside the sticky visual column that scales as the story
   * scrolls past, on large screens only. Don't also mark it `reveal`: both
   * animate its transform.
   */
  storyVisual: "data-scene-story-visual",
  /** One step of the story. */
  storyStep: "data-scene-story-step",
  /**
   * Inside a step: a vertical line that fills from the top as the step
   * scrolls past the middle of the screen (a scaleY transform), on large
   * screens only. Decorative: hide it from screen readers.
   */
  storyRail: "data-scene-story-rail",
} as const;

type SceneAttributes = typeof sceneAttribute;

/** A CSS selector for one attribute: sceneSelector("reveal") is "[data-scene-reveal]". */
export function sceneSelector(name: keyof SceneAttributes): string {
  return `[${sceneAttribute[name]}]`;
}

/** The attributes that take no value (all but the count's two). */
type Marker = Exclude<keyof SceneAttributes, "count" | "countDecimals">;

/**
 * Props that mark an element, to spread into JSX:
 * `<h2 {...sceneMark("reveal")}>` renders `<h2 data-scene-reveal="">`.
 */
export function sceneMark<Name extends Marker>(name: Name): Record<SceneAttributes[Name], ""> {
  return { [sceneAttribute[name]]: "" } as Record<SceneAttributes[Name], "">;
}

/**
 * Props for the digits of a counting number:
 * `<span {...sceneCount(5000)}>5,000</span>`, `<span {...sceneCount(4.8, 1)}>4.8</span>`.
 */
export function sceneCount(value: number, decimals = 0) {
  return {
    [sceneAttribute.count]: String(value),
    ...(decimals > 0 ? { [sceneAttribute.countDecimals]: String(decimals) } : {}),
  };
}
