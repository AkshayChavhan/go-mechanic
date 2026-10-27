import { cn } from "@/lib/utils";

// Every line keeps the same thickness however large the drawing is shown
// (vector-effect isn't inherited, so it's set on each shape).
const sameLineWidth = "[&_*]:[vector-effect:non-scaling-stroke]";

/**
 * A car and a scooter in plain line art: the stand-in for real photos until
 * the owner has some (owner's decision, 2026-10-27: no stock photos, which
 * would pretend to be the garage).
 *
 * Drawn inline, so it costs no network request, and in `currentColor`, so it
 * takes the text colour around it on every tone (give it
 * text-muted-foreground for a quiet line). Decorative: screen readers skip it.
 * VisualSlot shows it whenever a slot has no photo.
 */
export function VehicleIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 40 480 148"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={cn(sameLineWidth, className)}
    >
      {/* The ground */}
      <path d="M8 172 H472" strokeOpacity={0.5} />

      {/* A hatchback, facing left: body, windows, door, handle, lights, wheels */}
      <path d="M22 148 L20 124 Q21 112 36 108 L98 98 Q105 97 110 92 L134 68 Q140 62 150 62 L208 62 Q218 62 225 68 L256 96 Q268 100 270 112 L270 138 Q270 148 260 148 L258 148 A32 32 0 0 0 202 148 L108 148 A32 32 0 0 0 52 148 Z" />
      <path d="M116 94 L138 72 Q142 68 148 68 L172 68 L172 94 Z" />
      <path d="M180 68 L206 68 Q214 68 219 73 L241 94 L180 94 Z" />
      <path d="M176 100 V142" />
      <path d="M190 110 H202" />
      <path d="M24 120 L40 117" />
      <path d="M266 110 V124" />
      <circle cx="80" cy="148" r="24" />
      <circle cx="80" cy="148" r="8" />
      <circle cx="230" cy="148" r="24" />
      <circle cx="230" cy="148" r="8" />

      {/* A scooter, facing left: wheels, mudguard, fork, handlebar, lamp, body, seat */}
      <circle cx="342" cy="154" r="18" />
      <circle cx="342" cy="154" r="5" />
      <circle cx="442" cy="154" r="18" />
      <circle cx="442" cy="154" r="5" />
      <path d="M318 154 A24 24 0 0 1 366 150" />
      <path d="M342 154 L357 98" />
      <path d="M346 90 L374 85" />
      <path d="M352 99 L342 101" />
      <path d="M362 90 Q366 128 386 144 L412 144 Q414 124 432 120 L460 120 Q472 124 470 140 L466 146" />
      <path d="M466 146 A24 24 0 0 0 418 146 L412 146" />
      <path d="M420 116 Q422 106 440 106 L462 108 Q468 110 466 116 Z" />
    </svg>
  );
}
