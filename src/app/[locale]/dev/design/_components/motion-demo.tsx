"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { PlayIcon } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { duration, ease, motionAllowed, motionReduced } from "@/lib/motion";

// Registering the hook with GSAP lets it clean up properly (gsap-react skill).
gsap.registerPlugin(useGSAP);

/**
 * A tile that slides along a track when you press Play, using the motion
 * tokens from @/lib/motion. The pattern task 13 follows:
 * - useGSAP with a scope ref, so everything is cleaned up on unmount;
 * - gsap.matchMedia() with the two reduced-motion queries, so visitors who
 *   ask for less motion get the end state straight away;
 * - the tile is visible before any JavaScript runs.
 */
export function MotionDemo() {
  const scope = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const tile = useRef<HTMLDivElement>(null);
  // The "play" for the visitor's current motion setting, set below.
  const play = useRef<() => void>(() => {});
  // Play stays disabled until GSAP is set up (it can't work without JavaScript).
  const [ready, setReady] = useState(false);

  useGSAP(
    () => {
      const media = gsap.matchMedia();
      media.add({ allowed: motionAllowed, reduced: motionReduced }, (context) => {
        const reduced = context.conditions?.reduced ?? false;
        // context.add() keeps animations made later (on a click) inside this
        // context, so they're undone when the setting changes or on unmount.
        play.current = context.add("play", () => {
          if (!track.current || !tile.current) return;
          const end = track.current.clientWidth - tile.current.offsetWidth;
          if (reduced) {
            gsap.set(tile.current, { x: end });
          } else {
            gsap.fromTo(
              tile.current,
              { x: 0 },
              { x: end, duration: duration.reveal, ease: ease.emphasized.gsap },
            );
          }
        }) as () => void;
      });
      setReady(true);
    },
    { scope },
  );

  return (
    <div ref={scope} className="flex flex-col gap-4">
      <div className="rounded-2xl bg-secondary p-2">
        {/* The rail has no padding, so its width is exactly how far the tile can go. */}
        <div ref={track} data-motion-track>
          <div ref={tile} data-motion-tile className="size-12 rounded-xl bg-foreground" />
        </div>
      </div>
      <div>
        <Button disabled={!ready} onClick={() => play.current()}>
          <PlayIcon data-icon="inline-start" />
          Play
        </Button>
      </div>
    </div>
  );
}
