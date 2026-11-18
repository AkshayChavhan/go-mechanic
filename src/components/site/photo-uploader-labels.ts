import { getTranslations } from "next-intl/server";

import type { PhotoUploaderLabels } from "./photo-uploader";

/**
 * The photo uploader's words, from the Photos messages, for a server page to
 * pass to <PhotoUploader labels={...}>. The uploader is a client island and
 * reads no messages itself. Templates are read raw: the uploader fills in
 * their {placeholders}.
 */
export async function photoUploaderLabels(): Promise<PhotoUploaderLabels> {
  const t = await getTranslations("Photos.uploader");
  const raw = (key: Parameters<typeof t.raw>[0]) => t.raw(key) as string;
  return {
    choose: t("choose"),
    hint: raw("hint"),
    tooMany: raw("tooMany"),
    photoAlt: raw("photoAlt"),
    remove: raw("remove"),
    resizing: t("resizing"),
    unreadable: t("unreadable"),
    upload: t("upload"),
    uploading: t("uploading"),
    stored: t("stored"),
    failed: t("failed"),
    done: raw("done"),
    problems: {
      "bad-count": t("problems.bad-count"),
      "too-many-photos": t("problems.too-many-photos"),
      "too-many-sets": t("problems.too-many-sets"),
      "not-found": t("problems.not-found"),
      offline: t("problems.offline"),
    },
  };
}
