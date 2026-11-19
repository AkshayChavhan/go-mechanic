// The PIN codes the garage picks up from, and their fees (task 24).
//
// The rules of this folder are in garage.ts. This is a public read: anyone
// may see where the garage picks up and what it costs, so there's no check.
// It is cached, so /contact stays built ahead of time. Task 28 adds the save,
// with authorize(), and calls updateTag(PICKUP_AREAS_TAG).

import "server-only";

import { asc, eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";

import type { PickupArea } from "@/domain/pickup";
import { getDatabase } from "@/server/db";
import { pickupAreas } from "@/server/db/schema";

/** The cache tag on every cached read of the pickup areas. */
export const PICKUP_AREAS_TAG = "pickup-areas";

/**
 * The listed areas, ordered by PIN code; paused ones are left out. Real rows
 * only: an empty table (every build until the owner gives real areas) is an
 * empty list, not an error. Pages show samples through selectPickupAreas()
 * (src/content/sample-pickup-areas.ts); the booking save uses this list as
 * it is, so a sample can never be booked.
 */
export async function readPickupAreas(): Promise<PickupArea[]> {
  "use cache";
  cacheTag(PICKUP_AREAS_TAG);
  cacheLife("max");

  const db = await getDatabase();
  return db
    .select({ postalCode: pickupAreas.postalCode, feePaise: pickupAreas.feePaise })
    .from(pickupAreas)
    .where(eq(pickupAreas.listed, true))
    .orderBy(asc(pickupAreas.postalCode));
}
