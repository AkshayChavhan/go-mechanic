"use client";

import { PhotoUploader, type PhotoUploaderLabels } from "@/components/site/photo-uploader";

// The uploader on /dev/design with stand-in actions: photos are resized for
// real (that's what e2e/dev/photo-resize.spec.ts checks), but nothing is
// sent anywhere. Each "upload" waits a moment and succeeds.

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function start({ setId, count }: { setId?: string; count: number }) {
  return {
    ok: true as const,
    setId: setId ?? crypto.randomUUID(),
    uploads: Array.from({ length: count }, () => ({
      photoId: crypto.randomUUID(),
      target: { url: "", method: "PUT" as const, headers: {} },
    })),
  };
}

async function finish(photoIds: string[]) {
  return photoIds.map((photoId) => ({ photoId, stored: true }));
}

async function put() {
  await wait(600);
  return true;
}

export function PhotoUploaderSample({ labels }: { labels: PhotoUploaderLabels }) {
  return <PhotoUploader labels={labels} start={start} finish={finish} put={put} />;
}
