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
tags: [idempotency, request-token, duplicate, retry, transaction, pglite, bookings, pickup]
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
