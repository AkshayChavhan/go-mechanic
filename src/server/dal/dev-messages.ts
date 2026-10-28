// The messages the fake providers "sent" (src/server/providers/), for the
// /dev/outbox page. Real providers never write here.

import "server-only";

import { desc, lt, sql } from "drizzle-orm";

import { LOGIN_RULES } from "@/domain/login";
import { getDatabase } from "@/server/db";
import { devMessages } from "@/server/db/schema";

export type DevMessage = typeof devMessages.$inferSelect;

export type DevMessageInput = Pick<DevMessage, "channel" | "recipient" | "body">;

/** Stores one message, after deleting messages older than 48 hours. */
export async function saveDevMessage(message: DevMessageInput): Promise<void> {
  const db = await getDatabase();
  await db
    .delete(devMessages)
    .where(lt(devMessages.createdAt, sql`now() - make_interval(hours => ${LOGIN_RULES.keepRecordsHours})`));
  await db.insert(devMessages).values(message);
}

/** The newest messages first, at most `limit`. Not cached: the outbox must show every new code. */
export async function listDevMessages(limit = 50): Promise<DevMessage[]> {
  const db = await getDatabase();
  return db.select().from(devMessages).orderBy(desc(devMessages.createdAt)).limit(limit);
}
