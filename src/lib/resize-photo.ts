// Shrinking a photo in the browser before it's uploaded (task 30).
//
// A phone photo is often 4000×3000 pixels and 4 MB, with EXIF data inside:
// the camera, the time and often the GPS location where it was taken. We
// draw it onto a canvas at most 1600px on its long side and save the canvas
// as a new JPEG. A canvas holds only pixels, so the new file has no EXIF at
// all: the location never leaves the phone. The original file is never
// uploaded.

import { PHOTO_CONTENT_TYPE, PHOTO_RULES } from "@/domain/photos";

export type Size = { width: number; height: number };

/**
 * The size that fits `width`×`height` inside `longSide` on its long side,
 * keeping its shape. A smaller photo keeps its size: we never enlarge.
 */
export function fitWithin(width: number, height: number, longSide: number): Size {
  const scale = Math.min(1, longSide / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export type ResizedPhoto = Size & { blob: Blob };

/** JPEG qualities to try, best first, until the file fits PHOTO_RULES.maxBytes. */
const QUALITIES = [0.85, 0.7, 0.5];

/**
 * The photo as a new JPEG, at most PHOTO_RULES.longSide on its long side.
 * Turned upright first ("from-image" reads the EXIF orientation), since the
 * new file has no EXIF to say which way is up. Throws when the browser
 * can't read the file as an image.
 */
export async function resizePhoto(file: Blob): Promise<ResizedPhoto> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const size = fitWithin(bitmap.width, bitmap.height, PHOTO_RULES.longSide);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("resizePhoto: no 2D canvas");
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    for (const quality of QUALITIES) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, PHOTO_CONTENT_TYPE, quality));
      if (!blob) throw new Error("resizePhoto: the canvas gave no JPEG");
      if (blob.size <= PHOTO_RULES.maxBytes) return { ...size, blob };
    }
    throw new Error("resizePhoto: still too big");
  } finally {
    bitmap.close();
  }
}
