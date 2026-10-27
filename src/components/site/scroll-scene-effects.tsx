"use client";

// The scroll scene's animations (plan KTD2 to KTD6). The only file outside
// the dev pages that imports GSAP (src/lib/gsap-imports.test.ts checks).
//
// ScrollScene loads this file lazily, in the browser, after the page has
// loaded, and only for visitors who allow motion. It renders nothing: it finds
// the elements the server marked (scroll-scene-attributes.ts) inside the
// ScrollScene's wrapper, and animates their transform and opacity only.
//
// The rules that keep the page readable:
// - Only elements entirely below the screen are hidden, at the moment this
//   starts. Whatever is on or above the screen (the hero, or the spot a
//   restored scroll position lands on) never moves on load.
// - Hidden means opacity 0, never visibility or display: screen readers and
//   find-in-page still find the text while it waits.
// - Nothing that holds a link or a button is ever hidden, so keyboard focus
//   never lands on something invisible.
// - Each reveal plays once, then its inline styles are removed.
// - Undoing (leaving the page, or the motion setting changing) puts every
//   element back the way the server drew it: useGSAP and gsap.matchMedia()
//   revert everything they recorded.

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLocale } from "next-intl";

import type { Locale } from "@/i18n/config";
import { formatNumber } from "@/i18n/format";
import {
  countDuration,
  distance,
  duration,
  ease,
  motionAllowed,
  motionReduced,
  phoneQuery,
  storyQuery,
} from "@/lib/motion";

import { sceneAttribute, sceneSelector } from "./scroll-scene-attributes";

// Once, when this file first loads. Registering useGSAP lets it clean up
// properly (gsap-react skill).
gsap.registerPlugin(useGSAP, ScrollTrigger);

/**
 * A reveal starts when the element's top has risen this share of the
 * screen's height above the bottom edge (or above the phone's action bar),
 * so the visitor sees it arrive rather than finding it half done.
 */
const REVEAL_LEAD = 0.1;

/** Anything a keyboard can focus. A reveal never hides one. */
const FOCUSABLE =
  'a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

/**
 * GSAP's contextSafe, with types: it wraps a callback that runs later (when
 * something scrolls into view), so the animations the callback starts are
 * recorded and undone with everything else.
 */
type ContextSafe = <Callback extends (...args: never[]) => unknown>(callback: Callback) => Callback;

export function ScrollSceneEffects({ scope }: { scope: HTMLElement }) {
  const locale = useLocale();

  useGSAP(
    () => {
      // matchMedia runs the setup below whenever one of these queries
      // changes (a phone turned sideways, a window resized past a breakpoint,
      // the motion setting switched). It first undoes the previous setup, so
      // the new one starts from the page as the server drew it.
      const media = gsap.matchMedia();
      media.add(
        { allowed: motionAllowed, reduced: motionReduced, story: storyQuery, phone: phoneQuery },
        (context, contextSafe) => {
          const { allowed = false, story = false, phone = false } = context.conditions ?? {};
          const safe = contextSafe as unknown as ContextSafe | undefined;
          // Reduced motion: the end state is the page as the server drew it.
          // (ScrollScene doesn't even load this file then; this is a backstop.)
          if (!allowed || !safe) return;

          // No ScrollTrigger here pins anything (the story's visual is
          // sticky in CSS, plan KTD4), so the order they're made in doesn't
          // change where they start.
          setUpReveals(scope, { phone, safe });
          if (story) setUpStory(scope);
          return setUpCounts(scope, locale, safe);
        },
      );

      // Web fonts change where lines break, and so where everything sits.
      // Measure every trigger again once they've loaded.
      let undone = false;
      void document.fonts.ready.then(() => {
        if (!undone) ScrollTrigger.refresh();
      });
      return () => {
        undone = true;
      };
    },
    // revertOnUpdate: if a dependency changes, undo everything before
    // setting it up again, instead of adding a second copy.
    { scope, dependencies: [scope, locale], revertOnUpdate: true },
  );

  return null;
}

// --- Reveals ---------------------------------------------------------------

/** Headings, text, tiles and visuals fade and rise in the first time they scroll into view. */
function setUpReveals(scope: HTMLElement, { phone, safe }: { phone: boolean; safe: ContextSafe }) {
  // Phones get a shorter rise, and their tiles come in as each one arrives,
  // without a stagger.
  const rise = phone ? distance.revealPhone : distance.reveal;
  const groups = marked(scope, "revealGroup");

  // Single elements. A group's tiles are handled with their group below.
  const singles = marked(scope, "reveal").filter(
    (element) => !element.parentElement?.matches(sceneSelector("revealGroup")),
  );
  revealOnEnter(singles, { rise, stagger: 0, safe });

  // Tiles that come into view together reveal one after another.
  for (const group of groups) {
    const tiles = [...group.children].filter((child): child is HTMLElement => child instanceof HTMLElement);
    revealOnEnter(tiles, { rise, stagger: phone ? 0 : distance.stagger, safe });
  }
}

function revealOnEnter(
  candidates: HTMLElement[],
  { rise, stagger, safe }: { rise: number; stagger: number; safe: ContextSafe },
) {
  const targets = candidates.filter((element) => canHide(element) && isBelowScreen(element));
  if (targets.length === 0) return;

  // Hidden while they wait. opacity, not autoAlpha (which also sets
  // visibility: hidden and would hide the text from screen readers).
  gsap.set(targets, { opacity: 0, y: rise });

  ScrollTrigger.batch(targets, {
    start: revealStart,
    // Each target reveals once. Jumping straight past one (the End key, a
    // link to further down) still reveals it: ScrollTrigger fires onEnter
    // for a start it skipped over.
    once: true,
    onEnter: safe((entering: Element[]) => {
      gsap.to(entering, {
        opacity: 1,
        y: 0,
        duration: duration.reveal,
        ease: ease.emphasized.gsap,
        stagger,
        overwrite: true,
        // Done: remove the inline styles, so the element is exactly as the
        // server drew it again.
        clearProps: "opacity,transform",
      });
    }),
  });
}

/**
 * Where a reveal (or a count) starts: when the element's top passes a line a
 * little above the screen's bottom edge, or above the phone's action bar.
 * A function, so ScrollTrigger works it out again whenever the screen
 * changes size. clamp(): an element near the very end of the page still
 * starts by the time the page can't scroll any further.
 */
function revealStart(): string {
  const lead = Math.round(window.innerHeight * REVEAL_LEAD);
  return `clamp(top bottom-=${coveredAtBottom() + lead})`;
}

/**
 * How many pixels at the bottom of the screen the phone's action bar covers:
 * 0 from 768px up. globals.css sets scroll-padding-bottom to the bar's height
 * (plus a small gap) below 768px only, so the browser does the measuring,
 * iPhone home-indicator space included.
 */
function coveredAtBottom(): number {
  return parseFloat(getComputedStyle(document.documentElement).scrollPaddingBottom) || 0;
}

/** Whether an element is entirely below the screen right now, so hiding it can't be seen. */
function isBelowScreen(element: Element): boolean {
  return element.getBoundingClientRect().top >= window.innerHeight;
}

/**
 * Whether hiding an element for a moment is safe: it holds no link or button
 * and sits inside none, and it isn't the story's scaling visual (both would
 * animate its transform).
 */
function canHide(element: HTMLElement): boolean {
  return (
    !element.matches(sceneSelector("storyVisual")) &&
    element.closest(FOCUSABLE) === null &&
    element.querySelector(FOCUSABLE) === null
  );
}

// --- The story (large screens only) -------------------------------------------

/**
 * The vehicle visual sits in a sticky column (CSS), and grows from a little
 * smaller to its natural size while the story scrolls past. Each step's rail
 * fills from the top as the step passes the middle of the screen. Both follow
 * the scroll position directly (scrub), so scrolling back undoes them.
 */
function setUpStory(scope: HTMLElement) {
  for (const story of marked(scope, "story")) {
    const visual = story.querySelector(sceneSelector("storyVisual"));
    if (visual) {
      gsap.fromTo(
        visual,
        { scale: distance.storyScale },
        {
          scale: 1,
          ease: "none", // scrubbed: the scroll position sets the pace
          scrollTrigger: { trigger: story, start: "top bottom", end: "bottom bottom", scrub: true },
        },
      );
    }

    for (const step of marked(story, "storyStep")) {
      const rail = step.querySelector(sceneSelector("storyRail"));
      if (!rail) continue;
      gsap.fromTo(
        rail,
        { scaleY: 0, transformOrigin: "50% 0%" },
        {
          scaleY: 1,
          transformOrigin: "50% 0%",
          ease: "none",
          scrollTrigger: { trigger: step, start: "top center", end: "bottom center", scrub: true },
        },
      );
    }
  }
}

// --- Counting numbers ----------------------------------------------------------

/**
 * Numbers below the screen start at 0 and count up to their final value the
 * first time they scroll into view (plan KTD6). Only the digits change: the
 * words around them, and the copy screen readers read, are left alone.
 * Returns the cleanup that puts every final value back.
 */
function setUpCounts(scope: HTMLElement, locale: Locale, safe: ContextSafe): () => void {
  // The server's text for each number we change (its final value).
  const finalText = new Map<HTMLElement, string>();
  // Numbers still waiting to count, and the trigger each waits on.
  const waiting = new Map<HTMLElement, ScrollTrigger>();

  for (const element of marked(scope, "count")) {
    const target = Number(element.getAttribute(sceneAttribute.count));
    const decimals = Number(element.getAttribute(sceneAttribute.countDecimals) ?? 0);
    const valid = Number.isFinite(target) && Number.isInteger(decimals) && decimals >= 0;
    // On or above the screen: it shows its final value and doesn't move.
    if (!valid || !isBelowScreen(element)) continue;

    finalText.set(element, element.textContent ?? "");
    element.textContent = formatNumber(0, locale, decimals);

    const trigger = ScrollTrigger.create({
      trigger: element,
      start: revealStart,
      once: true,
      onEnter: safe(() => {
        waiting.delete(element);
        const counter = { value: 0 };
        gsap.to(counter, {
          value: target,
          duration: countDuration,
          ease: ease.standard.gsap,
          onUpdate: () => {
            element.textContent = formatNumber(counter.value, locale, decimals);
          },
          // End on the server's exact text.
          onComplete: () => {
            element.textContent = finalText.get(element) ?? "";
          },
        });
      }),
    });
    waiting.set(element, trigger);
  }

  // Printing before a number has counted would print its 0: show the final
  // value instead, and don't count it later.
  const finishWaiting = () => {
    for (const [element, trigger] of waiting) {
      trigger.kill();
      element.textContent = finalText.get(element) ?? "";
    }
    waiting.clear();
  };
  window.addEventListener("beforeprint", finishWaiting);

  return () => {
    window.removeEventListener("beforeprint", finishWaiting);
    for (const [element, text] of finalText) element.textContent = text;
  };
}

// --- Helpers -------------------------------------------------------------------

/** The elements inside `root` that carry one of the scene's attributes. */
function marked(root: ParentNode, name: keyof typeof sceneAttribute): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(sceneSelector(name))];
}
