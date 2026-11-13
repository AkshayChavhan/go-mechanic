---
title: "Signed direct uploads: keep a pending row (and its set) until its upload link can no longer be used, or a late upload leaves a file no cleanup finds"
date: 2026-11-13
category: conventions
module: "src/server/dal/photos.ts"
problem_type: convention
component: database
severity: high
applies_when:
  - Code hands the browser a signed upload link (the fake photo storage, Supabase Storage) and tracks the file with a database row
  - Deciding what to do with a pending row whose file is missing or bad when the upload is "finished"
  - Writing cleanup that deletes rows (retention, account deletion) for files uploaded through signed links
  - Tasks 31 and 32 (mechanic photos, estimate requests) and 43 (account deletion) build on task 30's photos
symptoms:
  - "Finishing an upload before its PUT deleted the pending row; a late PUT through the still-valid link stored a file with no row"
  - "That file is never deleted: deleteOldPhotos and deletePhotosOfUser find files only through rows, so the privacy notice's retention is broken"
  - "The deleted row freed its place, so repeated start/finish on one set went past the 6-photo limit"
  - "A photo added to an open set just before its 30-day cleanup got a link that outlived the set"
related_components: [privacy-notice, storage]
tags: [signed-url, direct-upload, supabase-storage, orphan-files, retention, cleanup, privacy-notice, photos]
---

# Signed direct uploads: keep pending rows until their links expire

## Context

Task 30 uploads photos straight from the browser to storage: `startPhotoUpload` saves a `pending` row and hands out a signed upload link, the browser PUTs the JPEG, and `finishPhotoUpload` checks the file and marks the row `stored`. Every cleanup is driven by rows: `deleteOldPhotos` and `deletePhotosOfUser` look up keys in `photos`, then remove those files.

The first version deleted a photo's row in `finishPhotoUpload` when its file was missing or bad, "to free its place at once". Three reviewers in task 30's `ce-code-review` (correctness, security, adversarial) found the same hole: the signed link keeps working after the row is gone (10 minutes on the fake, about 2 hours on Supabase, which has a fixed lifetime for signed upload links). A late or deliberate PUT then stores a file that no row points to. Nothing ever deletes it, so the privacy notice's "deleted after 24 hours" and "deleting your login deletes your photos" become false, and the freed place lets a customer go past the per-set limit. The `code-reviewer` then found the same shape at the set level: a photo added to an open set just before its 30-day cleanup got a link that outlived the set (the cascade removed its pending row).

## Guidance

A row is the only way cleanup can find a file. So a row must outlive every link that can still write to its key.

1. **Never delete a pending row while its link may still work.** A missing file leaves the row `pending`; a bad file is removed, and the row stays `pending` (the link can write that key again). The row keeps its place in the limit. `src/server/dal/photos.ts`:

   ```ts
   const file = await storage.inspect(photo.storageKey);
   if (file === null) continue;            // may still be on its way: stays pending
   if (!good) {
     await storage.remove([photo.storageKey]);
     continue;                              // the row stays pending, holding its place
   }
   ```

2. **Retry through the same link, not a new place.** `PhotoUploader` keeps each photo's `{ photoId, target }` and sends a failed photo again through it; only new photos call `start`.

3. **Sweep pending rows only after the longest link lifetime.** `deleteOldPhotos` removes `pending` rows older than `PHOTO_RULES.keepPendingHours` (24), files first. That is longer than both links (10 minutes, 2 hours), so any late file is already there when the sweep removes its key.

4. **Don't hand out links for a set that will be cleaned up before the link expires.** `startPhotoUpload` refuses (`not-found`) an open set in its last `keepPendingHours` before its `keepOpenDays` cleanup:

   ```ts
   gt(photoSets.createdAt, new Date(now.getTime() - PHOTO_RULES.keepOpenDays * DAY_MS + PHOTO_RULES.keepPendingHours * HOUR_MS))
   ```

The tests that guard this in `src/server/dal/photos.test.ts`: "a photo that hasn't arrived keeps its place...", "a late upload to a photo finished early is still deleted with its row after 24 hours", and "a set in its last day before cleanup takes no more photos; a day earlier it does".

## When to apply

- Any new kind of signed upload (task 31's mechanic photos, any future document upload): the row's lifetime must cover the link's lifetime, and every cleanup must run on rows that still exist.
- Task 43's account deletion: run `deletePhotosOfUser` (files, then rows) before deleting the user, and stop that customer's new uploads first (end their sessions or take the `photos:<user id>` advisory lock), or a link handed out in between leaves an orphan.
- If a provider's link lifetime changes (task 20 checks Supabase's real one), keep `keepPendingHours` longer than it.
- This is the storage side of `document/solutions/conventions/privacy-notice-retention-from-delete-code-not-expiry.md`: the notice's "how long" is true only if the delete code can reach every file.
