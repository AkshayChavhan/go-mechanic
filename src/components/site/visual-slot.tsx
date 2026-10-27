import Image, { type StaticImageData } from "next/image";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

import { VehicleIllustration } from "./vehicle-illustration";

type VisualSlotProps = Omit<ComponentProps<"div">, "children"> & {
  /**
   * How wide the slot is on each screen, for the browser to pick a photo
   * size: "(min-width: 64rem) 50vw, 100vw". Only used with a photo.
   */
  sizes: string;
  /**
   * The hero's slot: load its photo straight away, with high priority, as the
   * page's largest image. Never `priority`, which Next.js 16 deprecated
   * (document/solutions/conventions/nextjs-16-read-bundled-docs-image-priority.md).
   */
  eager?: boolean;
} & (
    | {
        /**
         * A static import (import workshop from "@/assets/workshop.jpg").
         * It brings the photo's width, height and a blurred preview with it.
         */
        photo: StaticImageData;
        /** What the photo shows, from messages/en.json (it joins messages with the photo). */
        alt: string;
      }
    | { photo: null; alt?: never }
  );

/**
 * A place for a picture, with a fixed shape (16:10), so the page never moves
 * when a photo arrives. With a photo, Next.js's Image fills it. Without one,
 * as everywhere today, the line drawing of a car and a scooter stands in.
 *
 * Other props (className, data attributes...) go to the outer box.
 */
export function VisualSlot({ photo, alt, sizes, eager = false, className, ...props }: VisualSlotProps) {
  // Image's placeholder is a setting ("blur" or "empty"), not text people
  // read: worked out here, because the lint rule for text in JSX can't tell
  // it from an input's placeholder.
  const placeholder = photo?.blurDataURL ? "blur" : "empty";

  return (
    <div className={cn("relative aspect-16/10 overflow-hidden rounded-2xl bg-card", className)} {...props}>
      {photo ? (
        <Image
          src={photo}
          alt={alt}
          fill
          sizes={sizes}
          placeholder={placeholder}
          className="object-cover"
          {...(eager ? { loading: "eager", fetchPriority: "high" } : {})}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center p-[8%] text-muted-foreground">
          <VehicleIllustration className="w-full" />
        </div>
      )}
    </div>
  );
}
