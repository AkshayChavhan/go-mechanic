"use client";

// PhotoUploader (task 30): pick up to 6 photos, see them shrunk, upload them.
// Tasks 31 (job updates) and 32 (estimate requests) put it on their pages;
// /dev/design shows it with stand-in actions.
//
// What happens, in order:
// 1. Picking: each photo is resized in the browser (resizePhoto: 1600px,
//    a new JPEG with no location data). Only the resized copy is kept.
// 2. Upload: `start` (the startPhotos Server Action, its locale bound by
//    the page) makes room and returns one signed link per photo; each photo
//    is PUT straight to storage; `finish` (finishPhotos) gets every photo id,
//    failed ones too, so a failed photo's place is freed at once.
// 3. A photo that failed can be sent again with the same button.
//
// When `name` is set, a hidden field of that name carries the set's id, so
// the form around the uploader posts it. Every word comes from `labels`.

import { ImagePlusIcon, LoaderCircleIcon, XIcon } from "lucide-react";
import { unstable_rethrow } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { PHOTO_RULES } from "@/domain/photos";
import { type ResizedPhoto, resizePhoto } from "@/lib/resize-photo";
import type { FinishedPhoto, StartPhotoUploadResult } from "@/server/dal/photos";
import type { UploadTarget } from "@/server/providers/photos/types";

type Problem = Extract<StartPhotoUploadResult, { ok: false }>["problem"];

export type PhotoUploaderLabels = {
  choose: string;
  /** "{max}": how many photos fit. */
  hint: string;
  /** "{max}": how many fit; "{kept}": how many of the picked ones were kept. */
  tooMany: string;
  /** "{n}": the photo's number. */
  photoAlt: string;
  /** "{n}": the photo's number. */
  remove: string;
  resizing: string;
  unreadable: string;
  upload: string;
  uploading: string;
  stored: string;
  failed: string;
  /** "{count}": how many photos are stored now. */
  done: string;
  problems: Record<Problem | "offline", string>;
};

export type PhotoUploaderProps = {
  labels: PhotoUploaderLabels;
  start: (request: { setId?: string; count: number }) => Promise<StartPhotoUploadResult>;
  finish: (photoIds: string[]) => Promise<FinishedPhoto[]>;
  /** An open set to add to; without it, the first upload starts a new one. */
  setId?: string;
  /** Photos the set already holds. */
  alreadyInSet?: number;
  /** The hidden field that posts the set id. */
  name?: string;
  /** How one photo gets to storage; a PUT by default. /dev/design passes a stand-in. */
  put?: (target: UploadTarget, blob: Blob) => Promise<boolean>;
};

type Status = "resizing" | "ready" | "unreadable" | "uploading" | "stored" | "failed";
type Item = { key: number; status: Status; photo?: ResizedPhoto; preview?: string };

/** The default upload: one PUT of the JPEG to its signed link. */
async function putPhoto(target: UploadTarget, blob: Blob): Promise<boolean> {
  const response = await fetch(target.url, { method: target.method, headers: target.headers, body: blob });
  return response.ok;
}

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}

/** Statuses that hold a place in the set. */
const HOLDS_A_PLACE: readonly Status[] = ["resizing", "ready", "uploading", "stored", "failed"];
/** Statuses the upload button sends: new photos, and failed ones again. */
const TO_SEND: readonly Status[] = ["ready", "failed"];

export function PhotoUploader({
  labels,
  start,
  finish,
  setId: initialSetId,
  alreadyInSet = 0,
  name,
  put = putPhoto,
}: PhotoUploaderProps) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const nextKey = useRef(0);
  const previews = useRef(new Set<string>());
  const [items, setItems] = useState<Item[]>([]);
  const [setId, setSetId] = useState(initialSetId);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  // The previews are object URLs: free them when the uploader goes away.
  useEffect(() => {
    const urls = previews.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const max = PHOTO_RULES.maxPerSet - alreadyInSet;
  const room = max - items.filter((item) => HOLDS_A_PLACE.includes(item.status)).length;
  const toSend = items.filter((item) => TO_SEND.includes(item.status) && item.photo);
  const stillResizing = items.some((item) => item.status === "resizing");

  function update(key: number, change: Partial<Item>) {
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...change } : item)));
  }

  function pick(files: File[]) {
    const kept = files.slice(0, Math.max(0, room));
    setMessage(files.length > kept.length ? fill(labels.tooMany, { max, kept: kept.length }) : "");
    for (const file of kept) {
      const key = nextKey.current++;
      setItems((current) => [...current, { key, status: "resizing" }]);
      resizePhoto(file).then(
        (photo) => {
          const preview = URL.createObjectURL(photo.blob);
          previews.current.add(preview);
          update(key, { status: "ready", photo, preview });
        },
        () => update(key, { status: "unreadable" }),
      );
    }
  }

  function remove(item: Item) {
    if (item.preview) {
      URL.revokeObjectURL(item.preview);
      previews.current.delete(item.preview);
    }
    setItems((current) => current.filter((other) => other.key !== item.key));
  }

  async function upload() {
    const sending = toSend;
    if (sending.length === 0) return;
    setBusy(true);
    setMessage("");
    try {
      let started: StartPhotoUploadResult;
      try {
        started = await start(setId ? { setId, count: sending.length } : { count: sending.length });
      } catch (error) {
        unstable_rethrow(error);
        setMessage(labels.problems.offline);
        return;
      }
      if (!started.ok) {
        setMessage(labels.problems[started.problem]);
        return;
      }
      const { uploads } = started;
      setSetId(started.setId);
      for (const item of sending) update(item.key, { status: "uploading" });

      await Promise.all(sending.map((item, index) => put(uploads[index]!.target, item.photo!.blob).catch(() => false)));
      let finished: FinishedPhoto[] = [];
      try {
        finished = await finish(uploads.map((upload) => upload.photoId));
      } catch (error) {
        unstable_rethrow(error);
      }
      const stored = new Set(finished.filter((photo) => photo.stored).map((photo) => photo.photoId));
      sending.forEach((item, index) => update(item.key, { status: stored.has(uploads[index]!.photoId) ? "stored" : "failed" }));
      const storedNow = items.filter((item) => item.status === "stored").length + stored.size;
      setMessage(fill(labels.done, { count: storedNow }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {name && setId && <input type="hidden" name={name} value={setId} />}
      <input
        ref={input}
        id={`${id}-files`}
        type="file"
        accept="image/*"
        multiple
        // Out of sight and out of the tab order: the Add photos button opens it.
        hidden
        onChange={(event) => {
          pick(Array.from(event.currentTarget.files ?? []));
          // Lets the same photo be picked again after it was removed.
          event.currentTarget.value = "";
        }}
      />
      <div className="flex flex-col gap-1">
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-fit"
          disabled={busy || room <= 0}
          aria-describedby={`${id}-hint`}
          onClick={() => input.current?.click()}
        >
          <ImagePlusIcon data-icon="inline-start" />
          {labels.choose}
        </Button>
        <p id={`${id}-hint`} className="type-callout text-muted-foreground">
          {fill(labels.hint, { max })}
        </p>
      </div>

      {items.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((item, index) => (
            <li key={item.key} className="flex flex-col gap-1">
              <div className="relative aspect-4/3 overflow-hidden rounded-xl bg-muted">
                {item.preview && (
                  // A local object URL: next/image can't optimise it, and needn't.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.preview}
                    alt={fill(labels.photoAlt, { n: index + 1 })}
                    width={item.photo?.width}
                    height={item.photo?.height}
                    className="size-full object-cover"
                  />
                )}
                {(item.status === "ready" || item.status === "failed" || item.status === "unreadable") && !busy && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="absolute top-1 right-1"
                    aria-label={fill(labels.remove, { n: index + 1 })}
                    onClick={() => remove(item)}
                  >
                    <XIcon />
                  </Button>
                )}
              </div>
              <p
                className={item.status === "failed" || item.status === "unreadable" ? "type-caption text-destructive" : "type-caption text-muted-foreground"}
              >
                {statusText(item.status, labels)}
              </p>
            </li>
          ))}
        </ul>
      )}

      <p role="status" className="type-callout">
        {message}
      </p>

      {toSend.length > 0 && (
        <Button type="button" className="w-full sm:w-fit" disabled={busy || stillResizing} onClick={upload}>
          {busy && <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />}
          {busy ? labels.uploading : labels.upload}
        </Button>
      )}
    </div>
  );
}

function statusText(status: Status, labels: PhotoUploaderLabels): string {
  switch (status) {
    case "resizing":
      return labels.resizing;
    case "unreadable":
      return labels.unreadable;
    case "uploading":
      return labels.uploading;
    case "stored":
      return labels.stored;
    case "failed":
      return labels.failed;
    case "ready":
      return "";
  }
}
