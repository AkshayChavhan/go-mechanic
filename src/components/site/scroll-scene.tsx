"use client";

// ScrollScene: the one client island that brings scroll motion to a page
// (plan KTD1 and KTD2).
//
// A page wraps its sections in it:
//
//   <ScrollScene>
//     <HomeHero ... />
//     <HomeStory ... />
//   </ScrollScene>
//
// The sections stay Server Components: passed in as children, they render on
// the server, and this file never sees their code. They mark what should move
// with the attributes in scroll-scene-attributes.ts.
//
// The animations themselves live in scroll-scene-effects.tsx, the only file
// that imports GSAP. ScrollScene loads it lazily, so:
// - the page's HTML and first JavaScript never include GSAP (about 117 KB);
// - nothing runs on the server, where GSAP's Date.now() would stop the page
//   being built ahead of time;
// - it loads after the page has finished loading, so it never competes with
//   the page's own text, fonts and images on a slow connection;
// - visitors who ask their device for less motion never download it.

import dynamic from "next/dynamic";
import { Component, useState, useSyncExternalStore, type ReactNode } from "react";

import { motionAllowed } from "@/lib/motion";

import { sceneMark } from "./scroll-scene-attributes";

// next/dynamic with ssr: false is allowed here because this is a client
// component (Server Components may not use it: see
// node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md). The chunk is
// requested only when <ScrollSceneEffects> first renders, which happens only
// while useMotionReady() below says yes.
//
// The effects are an extra: the page reads fully without them. So if their
// file can't be downloaded (a weak signal, a content blocker, an old file
// name after a redeploy), .catch() swaps in NoMotion, which renders nothing.
const ScrollSceneEffects = dynamic(
  () =>
    import("./scroll-scene-effects")
      .then((module) => module.ScrollSceneEffects)
      .catch(() => NoMotion),
  { ssr: false },
);

/** What runs instead of the effects when their file couldn't be loaded: nothing. */
function NoMotion() {
  return null;
}

/**
 * Catches an error the effects throw while they run (an error boundary, a
 * React component that catches errors from the components inside it). Without
 * it, the error would travel up to Next.js, which would replace the whole page
 * with its error screen. With it, the effects quietly disappear, and the page
 * stays as the server drew it. A class: React has no hook for this.
 */
class WithoutMotionOnError extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function ScrollScene({ children }: { children: ReactNode }) {
  // The wrapper element, kept in state rather than a ref: the effects start
  // only once it exists, so they never look for a scope that isn't there yet.
  const [scope, setScope] = useState<HTMLDivElement | null>(null);
  const ready = useMotionReady();

  return (
    <div ref={setScope} {...sceneMark("root")}>
      {children}
      {ready && scope && (
        <WithoutMotionOnError>
          <ScrollSceneEffects scope={scope} />
        </WithoutMotionOnError>
      )}
    </div>
  );
}

// --- Is motion allowed, and has the page loaded? ---------------------------
//
// useSyncExternalStore reads a value that lives outside React (here, the
// browser's motion setting and its loading state), like OpenStatus reads the
// clock. Its third function is the answer on the server and while React takes
// over the server's HTML (hydration): false, so the server's HTML and the
// browser's first render always match, and the effects can only start after.

/** True once the page has loaded, if the visitor allows motion. */
function motionReadyNow(): boolean {
  return (
    document.readyState === "complete" &&
    // Very old browsers (and jsdom in unit tests) can't tell us: no motion.
    typeof window.matchMedia === "function" &&
    window.matchMedia(motionAllowed).matches
  );
}

/** On the server, and during hydration: never. */
function notOnServer(): boolean {
  return false;
}

/** Tells React to check again when the motion setting changes or the page finishes loading. */
function subscribe(onChange: () => void): () => void {
  const query = typeof window.matchMedia === "function" ? window.matchMedia(motionAllowed) : null;
  query?.addEventListener("change", onChange);
  window.addEventListener("load", onChange);
  // If the page finished loading between React's first check and this
  // subscription, the load event is gone: check once more, to be sure.
  queueMicrotask(onChange);
  return () => {
    query?.removeEventListener("change", onChange);
    window.removeEventListener("load", onChange);
  };
}

function useMotionReady(): boolean {
  return useSyncExternalStore(subscribe, motionReadyNow, notOnServer);
}
