"use client";

import { useState } from "react";

import { PhotoUploader, type PhotoUploaderLabels } from "@/components/site/photo-uploader";
import { Button } from "@/components/ui/button";

// The uploader on /dev/design with stand-in actions: photos are resized for
// real (that's what e2e/dev/photo-resize.spec.ts checks), but nothing is
// sent anywhere. Each "upload" waits a moment and succeeds.
//
// The second sample is the uploader inside a form, as on /estimate (task
// 32): a grey Upload button, a Send button that waits while photos are on
// their way, and every second photo failing, so its remove button shows.

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

let checked = 0;
/** Every second photo checked "didn't arrive", to show a failed photo and its remove button. */
async function flakyFinish(photoIds: string[]) {
  return photoIds.map((photoId) => {
    checked += 1;
    return { photoId, stored: checked % 2 === 1 };
  });
}

export function PhotoUploaderSample({ labels }: { labels: PhotoUploaderLabels }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-col gap-10">
      <PhotoUploader labels={labels} start={start} finish={finish} put={put} />
      <form className="flex flex-col gap-4" onSubmit={(event) => event.preventDefault()}>
        <p className="type-callout text-muted-foreground">Inside a form (task 32): every second photo fails here.</p>
        <PhotoUploader
          labels={labels}
          start={start}
          finish={flakyFinish}
          put={put}
          uploadVariant="secondary"
          onBusyChange={setBusy}
        />
        <Button type="submit" className="w-full sm:w-fit" disabled={busy}>
          Send request
        </Button>
      </form>
    </div>
  );
}
