---
title: "Idempotent saves: answer \"duplicate\" before any refusal that depends on data that can change, or a retried request gets refused for a booking that already exists"
last_updated: 2026-11-19
date: 2026-11-19
category: conventions
module: "src/server/dal/bookings.ts"
problem_type: convention
component: service_layer
related_components: [database]
severity: medium
applies_when:
  - "Adding a check to createMyBooking that reads something that can change (pickup areas, prices, services, the catalogue, a saved vehicle)"
  - "Tasks 25 and 27 (cancel, reschedule) and 47 (the /book confirm) add saves that a customer may send twice"
  - "Any save that takes a request token so a double tap or a retry after a lost answer makes one row"
  - "A save that locks its row through an access filter the save itself can change (updateJob in src/server/dal/jobs.ts: completing or reassigning a job ends a mechanic's access)"
tags: [idempotency, request-token, duplicate, retry, transaction, pglite, bookings, pickup, jobs, row-lock, access-filter]
---

# Answer "duplicate" before refusals that depend on data that can change

## Context

`createMyBooking` takes a request token, one per run of the booking page. Its header comment promises: "The same confirm again: the first booking's code, whatever happened since." The token lookup runs inside the booking transaction, because it must run under the customer's advisory lock.

Task 24 added pickup and drop. The first version read the pickup areas before the transaction (correct: PGlite has one connection, so a cached read inside the transaction would wait forever) and refused an unserved PIN code right there, with `pickup-not-offered`. The code review (testing reviewer, confirmed by the validator) found the gap. A customer confirms, the answer is lost, and the owner pauses that PIN code before the customer retries. The retry then got `pickup-not-offered`, although the booking and its slot place already existed. The customer would think nothing was booked.

## Guidance

Split "read" from "refuse". Read data that can change before the transaction, keep the result, and return its refusal inside the transaction after the duplicate checks and before `reserveSlot`:

```ts
// before the transaction (src/server/dal/bookings.ts)
let pickup: BookedPickup | null = null;
let pickupNotOffered = false;
if (booking.pickup) {
  const area = findPickupArea(await readPickupAreas(), booking.pickup.postalCode);
  if (area) pickup = { ...booking.pickup, feePaise: area.feePaise };
  else pickupNotOffered = true;
}

// inside it: token lookup -> same vehicle + same slot -> then the refusal
if (sameSlot) return { status: "duplicate", booking: await readBookedBooking(tx, user.id, sameSlot.id) };
if (pickupNotOffered) return { status: "problems", problems: [{ field: "pickup", problem: "pickup-not-offered" }] };
// ... future-bookings limit, then reserveSlot
```

The order is then: the input check (pure, can't change), the reads, the transaction, the lock, the "duplicate" answers, the refusals that depend on data that can change, `reserveSlot`, the writes. Every refusal still comes before `reserveSlot`, so nothing is written when one fires (CLAUDE.md "Bookings").

The test that guards it is in `src/server/dal/bookings.test.ts`: "a retry with the same token after the area was paused is still duplicate, not pickup-not-offered".

## When to apply

- **Every new refusal in a save with a request token.** If its answer can differ between the first try and a retry (because an owner edit, a price change or a hidden row changed the data in between), it belongs after the duplicate checks.
- **Not yet fixed, for the same reason:** task 23's refusals still sit before the transaction. These are a saved vehicle that was removed (`not-found`), a hidden or unpriced service (`problems`), and an unlisted model. A retry after such a change answers that refusal instead of "duplicate". Move them the same way when a task next changes that code (task 25), with a retry test for each.
- **Pure input checks may stay first.** `checkBookingInput` gives the same answer on every retry of the same input, so it can't contradict the first answer.

## When the row lock's filter is itself the refusal (task 31)

`updateJob` (`src/server/dal/jobs.ts`) locks the booking with `select ... for update` through `jobRowFilter` (`src/server/dal/job-access.ts`): for a mechanic that's "assigned to me and not completed". The first version answered `not-found` as soon as the lock found no row, and only then looked up the request token. But the filter is a refusal the first send can change: a mechanic's own update to "completed" ends their access, and so does a reassignment. A double tap on "Completed", or a retry after a lost answer, got `not-found`, and the mechanic's phone would say the job is gone. Four of eight code reviewers found it; no test had a retry of the completing update.

Fix: keep the lock first (a second send waiting on it then sees the first one's row), but look up the caller's own token whether or not the lock found a row, and answer `not-found` only after that:

```ts
const [job] = await tx.select(...).from(bookings).where(jobRowFilter(user, update.bookingId)).for("update");
const [earlier] = await tx.select(savedUpdateColumns).from(bookingEvents).where(
  and(eq(bookingEvents.bookingId, update.bookingId), eq(bookingEvents.actorUserId, user.id), eq(bookingEvents.requestToken, update.requestToken)),
);
if (earlier) return { status: "duplicate", update: earlier };
if (!job) return { status: "not-found" };
```

It's safe because the lookup is filtered by the caller's own id: it can only return what they wrote while they still had access, never another person's update or a booking they never touched. The guards are in `src/server/dal/jobs.test.ts`: "the mechanic's retry of the update that completed the job answers duplicate, not not-found" and "after the job is reassigned, the first mechanic's retry still answers duplicate with their own update". Moving `if (!job)` back above the lookup makes both fail.

Check any save whose `WHERE` filter (not only its later refusals) depends on a column the save writes: a status that ends access, an owner that changes, a soft delete.
