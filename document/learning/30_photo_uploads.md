# 30_photo_uploads: private photos, shrunk on the phone, sent straight to storage

> **Branch:** `30_photo_uploads` · **Date:** 2026-11-13 · **Status:** In progress

## In one minute

A logged-in customer can now attach up to 6 photos to a request. The phone shrinks each photo to at most 1600px and saves a new JPEG with no hidden location data. Then the photo goes straight to storage through a short-lived signed link, never through our server code. Only the customer, the garage's managers and the owner can see the photos. No public page uses this yet: tasks 31 (job timeline) and 32 (estimate requests) will put the uploader on their pages.

Full details: [the plan](../plans/2026-11-13-1200-feat-photo-uploads-plan.md) (R1–R7, KTD1–KTD9, units U1–U10) and the "Photos" block in `CLAUDE.md`.

**Built in parallel.** Three Claude sessions worked at once, each in its own folder (git worktree). This was Session 2, in `go-mechanic-s2`. Task 23 (Session 1) merged first, on 2026-11-17, with its own migration `0006_bookings`. So this branch merged `main` afterwards, dropped its first migration and generated it again as `0007_photo_uploads` (same SQL, never renamed), and moved the privacy notice's version to `2026-11-18` (both branches had used `2026-11-13`).

## Why: the problem we solved

A garage often needs to *see* the problem: a dent, a leak, a warning light. Without this task:

- there was nowhere to keep photos, and no rule for who may see them;
- a phone photo (often 4000×3000 pixels and 4 MB) would be slow to send on mobile data, and Server Actions only accept up to 1 MB;
- phone photos carry **EXIF** data, often including the GPS location of the customer's home. Uploading the original file would hand that to us without the customer noticing;
- photos would pile up for ever. The privacy notice has to say how long we keep them, and the code has to really do it.

The owner decided on 2026-11-13:

- **Both storage providers now.** The fake one is fully tested. The Supabase one is tested only against a mocked `fetch` until task 20 tries it against a real bucket.
- **6 photos per set, 1600px** on the long side.
- **Keep photos for 1 year after the job or estimate closes.** Delete them at once when the account is deleted. A set that never gets closed is deleted 30 days after it started.
- **Who sees them:** the customer, the assigned mechanic, managers and the owner. The mechanic part waits for task 31, which adds jobs.

## What: what changed

| File or folder | Change | Why it exists |
| --- | --- | --- |
| `src/domain/photos.ts` (+ test) | Added | `PHOTO_RULES` (6, 1600px, 2 MB, link lifetimes, how long photos are kept), `photoKey`, `isPhotoKey`, `looksLikeJpeg` |
| `src/domain/permissions.ts` (+ test) | Changed | New permissions: `photos.view` (manager, owner) and `customers.delete` (owner, for task 43) |
| `src/server/env.ts` (+ test), `.env.example` | Changed | `PHOTO_STORAGE`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PHOTO_BUCKET`. The fake is refused on staging and production |
| `src/server/providers/photos/types.ts` | Added | The interface every storage provider follows: `uploadTarget`, `viewUrl`, `inspect`, `remove` |
| `src/server/providers/photos/fake.ts` (+ test) | Added | Local-disk storage in `.photos/`, with its own signed links |
| `src/server/providers/photos/token.ts` | Added | Signs and checks the fake's links with HMAC-SHA256 |
| `src/server/providers/photos/supabase.ts` (+ test) | Added | Supabase Storage through its REST API with plain `fetch` (no new npm package) |
| `src/server/providers/photos/index.ts` | Added | `photoStorage()` picks the provider from the settings |
| `src/app/api/photos/upload/route.ts`, `view/route.ts` | Added | The fake's two addresses (PUT and GET). They answer 404 when the fake isn't in use |
| `src/server/db/schema.ts`, `migrations/0007_photo_uploads.sql`, `meta/` | Changed / Added | Tables `photo_sets` and `photos` |
| `src/server/db/photos-tables.test.ts` | Added | Tests the CHECKs, the unique key and the cascades |
| `src/server/dal/photos.ts` (+ test) | Added | `startPhotoUpload`, `finishPhotoUpload`, `photoViewUrls`, `deleteOldPhotos`, `deletePhotosOfUser`, each with its access check |
| `src/server/actions/photos.ts` (+ test) | Added | Server Actions `startPhotos` and `finishPhotos`: the upload handshake |
| `src/lib/resize-photo.ts` (+ test) | Added | `fitWithin` (the math) and `resizePhoto` (the canvas work) |
| `src/components/site/photo-uploader.tsx` (+ test), `photo-uploader-labels.ts` | Added | `PhotoUploader`, the client island: pick, preview, upload, report |
| `messages/en.json` | Changed | A new `Photos` namespace at the end, and a `photos` item inside `PrivacyPage.items` |
| `src/domain/consent.ts` (+ test), `privacy/page.tsx`, `privacy/coverage.test.ts` | Changed | The notice's photo numbers come from `PHOTO_RULES`. `LOGIN_NOTICE_VERSION` moved from `2026-11-03` to `2026-11-13`. Both new tables are listed |
| `src/app/[locale]/dev/design/page.tsx`, `_components/photo-uploader-sample.tsx` | Changed / Added | The uploader on `/dev/design`, with stand-in actions (it resizes for real, but nothing is uploaded) |
| `e2e/dev/photo-resize.spec.ts` | Added | A real browser checks the resize and that the EXIF data is gone |
| `e2e/server-boundary.spec.ts`, `sms/index.test.ts`, `login.test.ts` | Changed | One-line updates for the new settings and code |
| `.gitignore`, `next.config.ts`, `package.json` | Changed | `.photos/` is git-ignored, left out of the build's file tracing, and deleted by `npm run db:reset` |
| `CLAUDE.md`, `MASTER.md`, `task.md` | Changed | The "Photos" rules, and backlog notes for tasks 20, 31, 32 and 43 |

## How: step by step

1. **Plan with `ce-plan`** and ask the owner the five questions under "Why". The answers are in the plan's Key Decisions.
2. **Settings (U1).** `serverEnv()` reads `PHOTO_STORAGE` (`fake` by default). With `supabase`, the URL and the service role key are required. `SUPABASE_SERVICE_ROLE_KEY` is a secret, so it never gets a `NEXT_PUBLIC_` prefix.
3. **The provider and the fake (U2).** The fake writes files to `.photos/` and makes links like `/api/photos/upload?t=<token>`. The token holds the file key, the action (`upload` or `view`) and an expiry time, plus a signature. The upload handler refuses a bad token (403), a body over 2 MB or one that isn't `image/jpeg`, and a second PUT to a key that already has a file (409).
4. **Supabase (U3).** Four REST calls with `fetch`: sign an upload, sign a view, read a file's info, delete. A signed upload link can't carry a size limit, so task 20 must create the bucket as private, with a 2 MB limit and `image/jpeg` only.
5. **Tables (U4).** First bring in anything new from `main`, then generate the migration:
   ```bash
   git fetch origin && git merge origin/main
   npm run db:generate -- --name=photo_uploads   # first wrote 0006_photo_uploads.sql; after task 23 merged, regenerated as 0007_photo_uploads.sql + meta/
   ```
   `--name` sets the part of the file name after the number.
6. **Data access (U5).** Every function checks who is asking on its first line. A customer can only touch their own sets. Anyone else, and an id that isn't a uuid, gets `not-found`. The 6-photo limit counts pending photos too. It's checked inside a transaction that locks the set's row, so two uploads at once can't both squeeze in.
7. **The handshake (U6).** `startPhotos` saves "pending" rows and returns one signed upload link per photo. The browser PUTs each JPEG straight to storage. Then `finishPhotos` gets back every photo id that was sent. For each photo, `inspect` checks that the file exists, is at most 2 MB and starts with `FF D8 FF`. If so, the photo is marked `stored`. If not, a bad file is removed but the row stays `pending` and keeps its place: the uploader sends that photo again through the same link, and the 24-hour cleanup removes anything that never arrives, file included. (The first version deleted the row here; the code review showed why that was wrong. See Review.)
8. **Resize and uploader (U7).** `resizePhoto` calls `createImageBitmap(file, { imageOrientation: "from-image" })`, draws the bitmap on a canvas and calls `canvas.toBlob(..., "image/jpeg", 0.85)`. If the result is still over 2 MB, it tries quality 0.7, then 0.5.
9. **Privacy notice (U8).** It got a "Photos you send us" item. `consent.test.ts` failed until `LOGIN_NOTICE_VERSION` moved, which is exactly its job.
10. **`/dev/design` and the browser check (U9).** The dev specs ran through a scratch Playwright config on port 3001, not `npm run test:design`, because port 3000 belonged to Session 1.

## New ideas in this task

- **Signed URL:** a link that carries its own permission slip: which file, what you may do, and until when, plus a signature. It's like a cinema ticket for one seat at one showing. Anyone holding it gets in, so it only works for a few minutes (10 for uploads, 5 for viewing).
- **HMAC:** a signature made from a message and a secret key (`createHmac("sha256", key)` in `token.ts`). Change one letter of the message and the signature no longer matches. Without the key, nobody can make a valid one. The fake's key is made from `BETTER_AUTH_SECRET` with the label `"photo links, version 1"`, so photo links and logins never share a key. `timingSafeEqual` compares signatures in constant time, so the time a comparison takes gives nothing away.
- **EXIF:** hidden data a camera writes inside a photo: the phone model, the time, often the GPS location. You can't see it, but anyone with the file can read it.
- **Canvas re-encoding:** drawing a photo onto a `<canvas>` and saving the canvas as a new JPEG. A canvas only holds pixels, so the new file has no EXIF. It's like photocopying a letter: you copy the words, not the sticky notes on the back.
- **Magic bytes:** the first few bytes of a file, which tell you its real type. Every JPEG starts with `FF D8 FF`. The server checks those bytes rather than trusting a file name or a `Content-Type` header.
- **Provider pattern:** the rest of the code talks to one interface (`PhotoStorage`). Which storage sits behind it is a setting. It's like a wall socket: the lamp doesn't care which power company you use. The SMS provider (task 15) works the same way.
- **Cascade delete:** `ON DELETE CASCADE` on a foreign key. Delete a user and their `photo_sets` rows go too, and with them their `photos` rows. But the database can't delete *files* in storage. That's why `deletePhotosOfUser` must remove the files first, before the user row is deleted.
- **Cleanup without a timer:** `deleteOldPhotos` runs at the start of each new upload, as the login-attempt cleanup does. The privacy notice says so honestly ("the next time anyone sends a photo, not on a timer").

## Check that it works

```bash
npx vitest run src/domain/photos.test.ts src/lib/resize-photo.test.ts src/server/providers/photos \
  src/server/dal/photos.test.ts src/server/db/photos-tables.test.ts \
  src/server/actions/photos.test.ts src/components/site/photo-uploader.test.tsx
# Test Files  8 passed (8)   Tests  67 passed (67)
npm run check                    # passed: 128 files, 1796 tests
npm run test:e2e -- --workers=2  # passed: 118 tests
```

`--workers=2` runs two test files at once instead of the default number, which kept the load down while three sessions shared the machine.

The dev specs (`design-preview` and the new `photo-resize`) passed 25 of 25 through the scratch config on port 3001. That was after an earlier full dev run had shown the touch-target failure described below. `e2e/dev/photo-resize.spec.ts` builds a 4000×3000 JPEG with an EXIF block holding the marker text `GPS-MARKER-18.6298N-73.7997E`. It feeds that file to the uploader and checks the preview: 1600×1200, starts with `FF D8 FF`, and contains neither `Exif` nor `GPS-MARKER`.

To try it by hand: `npm run dev`, open `/dev/design`, find the photo uploader, and pick a big photo from your computer.

## Common mistakes

What went wrong in this task, and was fixed:

- **The brand name in a code string.** The HMAC label was first `"gomechanic photo links"`. `brand-name.test.ts` caught it, because the brand name may only live in `messages/en.json`. It's now `"photo links, version 1"`. Nothing stored depends on the label, since links only last minutes.
- **A hidden input that wasn't hidden enough.** The file input was "screen-reader only" (`sr-only`), which still measures 1×1px. The design page's 44px touch-target check counted it as a tiny field and failed. The fix was the plain `hidden` attribute. The "Add photos" button still opens the file picker.
- **An ICU plural that would have shown raw.** A message like `{count, plural, one {...} other {...}}` needs next-intl to format it. But the uploader fills its templates itself (`fill()` in `photo-uploader.tsx`), so the customer would have seen the raw braces. The message became `"Photos uploaded: {count}."`.
- **TypeScript strictness.** A test's upload body had to be typed `Uint8Array<ArrayBuffer>`, not plain `Uint8Array`, before `fetch` accepted it. The transaction's result got an `ok: true | false` field (a **discriminated union**) so TypeScript knows which fields exist on each branch.

Mistakes to avoid later:

- **Sending the photo through a Server Action.** It caps the body at 1 MB, and it makes our server carry every byte. Use the signed upload link.
- **Building a storage key from a file name.** Keys are always `sets/<setId>/<photoId>.jpg`, made by the server. A typed name could contain `..` and point at another folder.
- **Deleting a user before their files.** The cascade removes the rows, and the files are left behind in storage with nothing pointing at them.
- **Calling storage inside a database transaction.** PGlite has one connection. Keep storage calls outside the transaction.

## Try it yourself

1. Open `src/server/providers/photos/token.ts` and `fake.test.ts`. Write a test that signs a `view` token, changes one character of its signature, and checks that `readPhotoToken` returns `null`.
2. In `src/lib/resize-photo.test.ts`, add a case: what does `fitWithin(1200, 5000, 1600)` return? Work it out on paper first (the long side is the height).
3. Bonus: change `PHOTO_RULES.maxPerSet` to 8 and run `npx vitest run src/domain/consent.test.ts`. See why it fails, then undo the change.

## Learn more

- [Supabase: create a signed upload URL](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl): what our REST calls do, explained through the official client.
- [Supabase: create a signed URL](https://supabase.com/docs/reference/javascript/storage-from-createsignedurl): the time-limited view link.
- [MDN: createImageBitmap()](https://developer.mozilla.org/en-US/docs/Web/API/Window/createImageBitmap): decoding a picked file, including `imageOrientation`.
- [MDN: HTMLCanvasElement.toBlob()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob): turning a canvas into a new JPEG.
- [Node.js: crypto.createHmac](https://nodejs.org/api/crypto.html#cryptocreatehmacalgorithm-key-options) and [timingSafeEqual](https://nodejs.org/api/crypto.html#cryptotimingsafeequala-b): how the fake signs and checks its links.

## Review

**`ce-code-review`: "Ready with fixes".** Ten reviewers (correctness, security, adversarial, project rules, testing, maintainability, data migration, reliability, past lessons, frontend races) ran locally; nothing was sent to another model. A separate validator confirmed all 5 main findings. What was fixed:

- **The big one (P1):** finishing an upload deleted a photo's row when its file was missing, but its upload link still worked. A late (or deliberate) upload then left a file no row pointed to: no cleanup would ever delete it, which broke the privacy notice, and the freed places let a customer go past 6 photos. Now a missing or bad photo stays `pending` and keeps its place; the uploader resends it through the same link, and the 24-hour cleanup removes anything that never arrives, file included. New tests prove a late upload is still cleaned up and that finishing early frees no place.
- **The uploader:** a failed "finish" call now says "no connection" instead of reporting success; nothing stays stuck on "uploading"; each thumbnail makes and frees its own preview link, so a page Next.js hides and shows again (`<Activity>`) keeps its thumbnails. A test hides and re-shows it. (A first try of that test failed for the wrong reason: `renderWithIntl`'s `rerender` drops its provider and remounts everything, so the test uses plain `render`.)
- **Rules:** `deleteOldPhotos` now checks the caller on its first line, and every photo function has a "logged out" test that also proves the database isn't touched.
- **Smaller:** a storage error on one photo no longer fails the rest; rows are taken back if storage fails before a link is handed out; Supabase requests time out after 10 seconds; cleanup removes files in batches of 100; an unused `maxBytes` parameter is gone; a test ties the database's 2 MB CHECK to `PHOTO_RULES`.
- **The notice:** "deleted 30 days after you sent them" became "30 days after the first photo of that group was sent", which is what the code does. The 2026-11-13 version never left this branch, so its pinned fingerprint was updated instead of adding a new version.
- **Plan:** R7 listed task 36 by mistake; corrected. The backlog asks tasks 31 and 32 to wrap the uploader in `FreshOnEachVisit` and to hold the form while photos upload.

Left as known risks (in the review report and the backlog): the Supabase request shapes are unverified until task 20; deleting a user removes the rows but the files only once task 43 calls `deletePhotosOfUser`; one account can still store about 1.8 GB over 30 days.

After the fixes: `npm run check` passed (128 files, 1808 tests), `npm run test:e2e -- --workers=2` passed (118), and the photo and design dev specs passed on port 3001 (the motion demo failed once and passed on a re-run; this task doesn't touch it).

**`code-reviewer`: "Needs changes", then fixed.** It re-ran `npm run check` (1808 tests, passing) and found:

- **Fixed (must fix):** the same orphan-file gap one level up. A photo added to an open set just before its 30-day cleanup got a link that outlived the set. A set in its last 24 hours now answers `not-found` (new test beside the 29- and 31-day cases).
- **Fixed (must fix):** step 7 above still described the old "delete the row" behaviour.
- **Fixed (suggestions):** a stale comment in the uploader; the fake now refuses an upload with no stated length (411) before reading it; the task 31 backlog note now says the notice's "who sees them" must change; the tracker link text.
- **Not fixable on this branch alone (must fix, coordination):** Session 1's unmerged `23_booking_flow` also adds a migration numbered `0006` and also sets `LOGIN_NOTICE_VERSION` to `2026-11-13`. Whichever branch merges second must merge `main`, regenerate its migration as `0007` (never rename), move the notice version (for example to `2026-11-13.2`) with its own fingerprint, and re-run the checks. The owner decides the order; this is what happens to task 30 if it goes second. **Done on 2026-11-18:** task 23 merged first, so this branch merged `main`, regenerated its migration as `0007_photo_uploads` (the SQL is byte-for-byte the old `0006`), and moved the notice to `2026-11-18` (a new day, so no `.2`) with its own pinned fingerprint; `main`'s `2026-11-13` pin is kept.

After these fixes `npm run check` passed again (128 files, 1810 tests).

## Compound

Yes, a lesson was saved: `document/solutions/conventions/signed-upload-links-keep-pending-rows-until-links-expire.md`. Without it, the next upload feature (task 31's mechanic photos) could repeat the mistake two reviews caught: deleting a pending row, or a whole set, while its upload link still works, which leaves files no cleanup can find.
