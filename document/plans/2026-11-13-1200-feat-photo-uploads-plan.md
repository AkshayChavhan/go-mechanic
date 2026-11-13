---
title: Photo Uploads - Plan
type: feat
date: 2026-11-13
origin: document/plans/2026-10-24-gomechanic-master-plan.md
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-plan-bootstrap
execution: code
---

# Photo Uploads - Plan

## Goal Capsule

- **Objective:** a logged-in customer can attach a small set of photos to a request, and only they and the garage's manager and owner can ever see them. Tasks 31 (job timeline) and 32 (estimate requests) build the screens on this.
- **Means:** a storage provider interface with a local-disk fake and a Supabase Storage provider (REST, no new package), `photo_sets` and `photos` tables, a data-access layer with the access checks, two Server Actions for the upload handshake, a browser resize helper, a `PhotoUploader` client island, and the privacy notice entry (KTD1-KTD9).
- **Authority:** the master plan (row 30, the Photos architecture line, "photos upload directly with signed URLs"); `CLAUDE.md` (Database, Roles and access, Customer data, Login and sessions' providers rule, Languages, Secrets, the privacy-notice rule); this plan.
  Lessons that apply (`document/solutions/`): `conventions/privacy-notice-retention-from-delete-code-not-expiry.md` (state retention from the code that deletes); `conventions/nextjs-16-dev-server-is-not-one-process-use-cache-probe.md` (helper processes; no database in `generateStaticParams`); `conventions/react-19-form-islands-hydration-action-activity.md` (the uploader is a form island); `workflow-issues/parallel-branches-same-migration-number-regenerate-not-rename.md` (merge `main` right before `db:generate`).
- **Stop conditions:** a paid service; a new npm package (none planned); a change in another task's code beyond the privacy notice entry task 19's rules require.
- **Who finishes:** Session 2 on branch `30_photo_uploads`. Commit and stop; push and the pull request only after the owner says yes.

---

## Product Contract

### Requirements

- R1. A logged-in customer can start a photo set and upload up to 6 photos into it; a 7th is refused.
- R2. Each photo is resized in the browser to at most 1600px on its long side and re-encoded as JPEG, which drops EXIF data (camera, time, GPS location); the original file never leaves the phone.
- R3. Photos go straight from the browser to storage through a signed upload link; no photo passes through a Server Action (they accept at most 1 MB).
- R4. Photos are private. A signed view link works for a few minutes and for one photo. Only the set's customer and staff with `photos.view` (manager, owner) get one; anyone else gets "not found". The assigned mechanic's access comes with task 31.
- R5. Storage is local disk under `npm run dev` and the tests, and Supabase Storage on staging and production; the fake is refused outside local runs.
- R6. A set closed by its job or estimate (tasks 31, 32) is deleted, files and rows, a year after it closed; a set never closed is deleted 30 days after it was started; an upload never finished is deleted after a day. The privacy notice says this as it really happens.
- R7. Later tasks find what they need: backlog notes for tasks 20 (the bucket and its limits, the settings staging must have or `serverEnv()` refuses to start, a real upload, view and delete), 31 (mechanic uploads and assigned-mechanic viewing; closing sets), 32 (closing sets) and 43 (`deletePhotosOfUser`). (Task 36 was listed here by mistake: reminders use no photos. Corrected after the code review.)

### Key Decisions

- **Both providers now; only the fake is tested now.** (session-settled: user-directed — chosen over writing only the fake: the Supabase provider is ready for task 20, which runs its real test.)
- **Kept a year after the job or estimate closes; deleted at once with the account.** (session-settled: user-directed — chosen over 90 days and over keeping until the account is deleted.)
- **6 photos per set, 1600px.** (session-settled: user-directed — chosen over 10 photos at 2048px.)
- **A set never closed is deleted 30 days after it was started.** (session-settled: user-directed — chosen over 90 days and a year.)
- **The customer, the assigned mechanic, the manager and the owner see them; nobody else.** (session-settled: user-directed — chosen over all staff.)

### Scope Boundaries

- No screen that real visitors use: tasks 31 and 32 put `PhotoUploader` on their pages. Task 30 shows it on `/dev/design` (resize only, no upload).
- No mechanic uploads and no assigned-mechanic viewing: they need task 31's jobs (backlog).
- No account deletion screen (task 43); `deletePhotosOfUser` is ready for it.
- No timer for deletions: they run at the start of each new upload (R6), as login attempts do.

---

## Planning Contract

### Key Technical Decisions

- KTD1. **A provider in `src/server/providers/photos/`**, like SMS: `types.ts` (the interface), `fake.ts`, `supabase.ts`, `index.ts` (`photoStorage()` picks by `PHOTO_STORAGE`). The interface: `uploadTarget(key, contentType, maxBytes)` → `{ url, method: "PUT", headers }`; `viewUrl(key, seconds)` → URL; `inspect(key)` → `{ bytes, contentType, firstBytes } | null` (the first 3 bytes, to check for a JPEG); `remove(keys)`. Each provider enforces `maxBytes` and the type its own way (the fake in its Route Handler, Supabase through the bucket's settings), and `finishPhotoUpload`'s check is the second guard.
- KTD2. **The fake** stores files in `.photos/` (git-ignored, deleted by `npm run db:reset` too) and signs its links itself: `/api/photos/upload?t=…` and `/api/photos/view?t=…`, where `t` is the key, the action, an expiry time and an HMAC-SHA256 over them, keyed from `BETTER_AUTH_SECRET` with a "photos" label. Two Route Handlers check the token, the size limit and the content type; the upload handler refuses (409) a key that already has a file, so a finished photo can't be replaced, and the view handler sends `X-Content-Type-Options: nosniff` and `Cache-Control: private, no-store`. `/api/...` is outside the proxy already. `next.config.ts` leaves `.photos/` out of the build's file tracing, as it does `.pglite/`.
- KTD3. **Supabase through its REST API with `fetch`** (no `@supabase/supabase-js`): `POST /storage/v1/object/upload/sign/{bucket}/{key}`, `POST /storage/v1/object/sign/{bucket}/{key}`, `GET` info, `DELETE /storage/v1/object/{bucket}` with `prefixes`. A signed upload link can't carry a size or type limit: the bucket must be created private with `file_size_limit` 2 MB and `allowed_mime_types` `['image/jpeg']` (task 20's backlog line), and the provider never sends `x-upsert`. Signed URLs come back as paths to prefix with `${SUPABASE_URL}/storage/v1`. Unit tests check the requests against a mocked `fetch`; the real test is task 20's, and these shapes count as unverified until then.
- KTD4. **Settings** in `serverEnv()`: `PHOTO_STORAGE` (`fake` default, `supabase`), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (a secret, server only, never `NEXT_PUBLIC_`), `PHOTO_BUCKET` (default `photos`). The fake is refused when `APP_ENV` isn't `local`; `supabase` requires the URL and the key. `.env.example` gets all four.
- KTD5. **Tables:** `photo_sets` (`id` uuid, `user_id` → users, on delete cascade; `created_at`; `closed_at` null until task 31 or 32 closes it) and `photos` (`id` uuid, `set_id` → photo_sets, cascade; `storage_key` unique; `status` `pending` | `stored`; `bytes` (filled by `finishPhotoUpload`); `created_at`, `stored_at`). A CHECK caps `bytes` at 2 MB. The 6-per-set limit counts `pending` and `stored` rows and is checked in one transaction with a row lock on the set; in the same transaction a customer with 5 open sets started in the last 24 hours gets `too-many-sets`, so one account can't fill the bucket. Keys are `sets/<setId>/<photoId>.jpg`: never a file name or anything a person typed.
- KTD6. **Access in the data-access layer.** `startPhotoUpload` and `finishPhotoUpload` call `authorizeUser()` first and work only on the caller's own sets. `photoViewUrls(setId)` gives links to the set's customer, or to a caller `authorize("photos.view")` allows (a new permission: manager, owner); everyone else, and a malformed id, gets `not-found`. The view links last 5 minutes.
- KTD7. **The upload handshake, two Server Actions** (`src/server/actions/photos.ts`): `startPhotoUpload(locale, { setId?, count })` checks the count (1-6, and what the set already holds), creates the set if needed and `pending` rows, and returns one upload target per photo; the browser PUTs each JPEG; `finishPhotoUpload(locale, photoIds)` checks each file with `inspect` (exists, JPEG, at most 2 MB) and that it starts with the JPEG bytes `FF D8 FF`, and marks it `stored`; anything else stays `pending` with its place (a bad file is removed). *Revised after the code review:* the first version deleted a failed photo's row at once, but its upload link still worked, so a late upload left a file no cleanup could find and freed places past the limit. Now `PhotoUploader` sends a failed photo again through the same link, and the 24-hour cleanup removes what never arrives.
- KTD8. **Resize in the browser** (`src/lib/resize-photo.ts`): `fitWithin(width, height, 1600)` (pure, tested) and `resizePhoto(file)`: `createImageBitmap(file, { imageOrientation: "from-image" })`, draw on a canvas, `toBlob("image/jpeg", 0.85)`. Drawing to a canvas keeps only pixels, so EXIF and GPS are gone. `PhotoUploader` (client island, labels as props) picks up to 6, shows thumbnails, uploads, and reports each photo's result.
- KTD9. **Deletion and the notice.** `deleteOldPhotos(clock)` runs in `startPhotoUpload` after `authorizeUser()`: sets closed more than 365 days ago, sets never closed started more than 30 days ago, and `pending` photos older than 24 hours, files first, then rows. A storage failure during this cleanup is logged without any key and skipped (the rows stay, so the next upload retries); the customer's upload goes on. `deletePhotosOfUser(userId)` (for task 43) calls `authorize("customers.delete")` first, a new permission for the owner that names task 43, and removes the files before the cascade. The notice says photos are shrunk and stripped of location data by our uploader, not that the server guarantees it. The privacy notice gets a "photos" item with those exact triggers, its numbers from `PRIVACY_NOTICE_VALUES`; `LOGIN_NOTICE_VERSION` moves and `coverage.test.ts` lists both tables.

### Risks

| Risk | Mitigation |
| --- | --- |
| The Supabase provider is wrong and nothing notices until staging | Request-shape unit tests; task 20's backlog line runs an upload, a view and a delete against the real bucket before testers use it |
| Another session's migration lands first | Merge `origin/main` right before `db:generate`; regenerate, never rename (the lesson) |
| A token or a key lets someone reach another customer's photo | Keys are server-made uuids; tokens are HMAC-signed with an expiry and checked in constant time; tests for a changed key, a changed action, an expired token and another customer's set |
| The notice claims more than the code does | Retention text names the real triggers (next upload; no timer), from `PRIVACY_NOTICE_VALUES` |

---

## Implementation Units

| U | Title | Main files |
| --- | --- | --- |
| U1 | Settings | `src/server/env.ts`, `.env.example` |
| U2 | Provider interface, fake, token helper, Route Handlers | `src/server/providers/photos/`, `src/app/api/photos/` |
| U3 | Supabase provider | `src/server/providers/photos/supabase.ts` |
| U4 | Tables and migration | `src/server/db/schema.ts`, `migrations/0006_*` |
| U5 | Data access and permission | `src/server/dal/photos.ts`, `src/domain/permissions.ts`, `src/domain/photos.ts` |
| U6 | Server Actions | `src/server/actions/photos.ts` |
| U7 | Browser resize and `PhotoUploader` | `src/lib/resize-photo.ts`, `src/components/site/photo-uploader.tsx` |
| U8 | Privacy notice | `messages/en.json` (`PrivacyPage.items.photos`), `src/domain/consent.ts`, `consent.test.ts`, `coverage.test.ts` |
| U9 | `/dev/design` sample and browser check | `src/app/[locale]/dev/design/page.tsx`, `e2e/dev/` |
| U10 | Docs, tracker, full checks | `CLAUDE.md`, `task.md`, `.gitignore`, `next.config.ts` (tracing), `db:reset` script |

Test scenarios per unit:

- U1: defaults; fake refused on staging and production; supabase without URL or key refused; no value in any message.
- U2: a signed upload stores the bytes; an expired, altered or wrong-action token is refused (403); a body over 2 MB or not `image/jpeg` is refused; a view token returns the file with `Cache-Control: private, no-store` and `nosniff`; a second PUT to a stored key is refused (409); `remove` deletes; a key with `..` is refused.
- U3: each method sends the right URL, method, headers and body to a mocked `fetch`, and maps a failure to an error without the key or URL in its message.
- U4: the CHECKs, the unique key, the cascades; the enum matches the domain.
- U5: start makes a set and pending rows; a 7th photo is refused, also across two calls; a 6th open set within 24 hours is `too-many-sets`; a failed PUT then a retry into the same set is accepted; `deletePhotosOfUser` gives a customer and a mechanic `AccessDeniedError` before `getDatabase`; a cleanup storage failure doesn't fail the upload; finish marks stored only after `inspect` agrees; another customer's set and a malformed id are `not-found`; a manager gets view links, a mechanic and another customer don't; `deleteOldPhotos` keeps a set closed 364 days ago and deletes one closed 366 days ago, keeps an open set started 29 days ago and deletes one started 31 days ago, files first; pending photos older than 24 hours go; a file that doesn't start with `FF D8 FF` is refused at finish.
- U6: logged out → redirect; a posted `userId` is ignored; the answers the uploader needs.
- U7: `fitWithin` for landscape, portrait, small images (never enlarged); the island with mocked actions: 7 files picked → only 6 accepted with a message; a failed PUT shows that photo's error; every label from props.
- U8: coverage test lists `photo_sets` and `photos`; the fingerprint test fails until the version moves.
- U9: Playwright on `next dev` (port 3001): a 4000×3000 JPEG with a GPS EXIF block, resized by the sample, comes out 1600×1200 and its bytes contain no `Exif` marker.

## Verification Contract

| Gate | Command |
| --- | --- |
| Lint, types, unit tests | `npm run check` |
| Production build and browser tests | `npm run test:e2e -- --workers=2` (port 3210; wait if another session holds it) |
| Dev specs | `e2e/dev` through the scratch config on port 3001 (never `npm run test:design`) |

## Definition of Done

U1-U10 in small commits; every gate passed with its output in the learning doc; `ce-code-review` and `code-reviewer` ran and their must-fixes are fixed; the compound question answered; the pull request only after the owner says yes, noting that `/dev/design` changed.
