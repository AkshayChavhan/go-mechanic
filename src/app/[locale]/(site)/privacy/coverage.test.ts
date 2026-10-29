import { getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { describe, expect, test } from "vitest";

import * as schema from "@/server/db/schema";
import messages from "../../../../../messages/en.json";

// The privacy notice must say what the website keeps (task 19's plan, R12).
// So every table in src/server/db/schema.ts is listed here, with the
// PrivacyPage item that describes it, or null when it holds no personal
// data in production. A task that adds a table fails this test until it
// decides which, and, if it's personal data, adds it to the notice (and moves
// LOGIN_NOTICE_VERSION: consent.test.ts pins the notice's wording).

const TABLES: Record<string, keyof typeof messages.PrivacyPage.items | null> = {
  // Personal data: the notice item that describes each table.
  users: "number",
  sessions: "session",
  verifications: "codes",
  consents: "consent",
  login_attempts: "attempts",
  // No personal data in production.
  accounts: null, // Better Auth's sign-in methods: phone login never writes here
  dev_messages: null, // the fake SMS provider's outbox: development and tests only
  garage_settings: null,
  opening_hours: null,
  slot_rules: null,
  calendar_exceptions: null,
  slot_counters: null,
};

/** The database name of every table schema.ts defines. */
function schemaTables(): string[] {
  return Object.values(schema)
    .filter((value) => is(value, PgTable))
    .map((table) => getTableName(table as PgTable))
    .sort();
}

describe("the privacy notice covers every table", () => {
  test("finds the tables (a broken scan would pass everything below)", () => {
    expect(schemaTables()).toEqual(expect.arrayContaining(["users", "sessions", "slot_counters"]));
  });

  test("every table in schema.ts is listed here, and no listed table is gone", () => {
    const tables = schemaTables();
    const unlisted = tables.filter((name) => !(name in TABLES));
    const gone = Object.keys(TABLES).filter((name) => !tables.includes(name));
    expect(
      unlisted,
      `New tables: ${unlisted.join(", ")}. Add each to TABLES in this file: the PrivacyPage item that describes it, or null if it holds no personal data. If it's personal data, add it to the privacy notice (messages/en.json, PrivacyPage.items, and the list in privacy/page.tsx) and move LOGIN_NOTICE_VERSION.`,
    ).toEqual([]);
    expect(gone, "Tables that no longer exist: remove them from TABLES and from the privacy notice.").toEqual([]);
  });

  test("each personal-data table points at an item the notice really has", () => {
    for (const [table, item] of Object.entries(TABLES)) {
      if (item) expect(messages.PrivacyPage.items[item], `${table} -> ${item}`).toBeTruthy();
    }
  });
});
