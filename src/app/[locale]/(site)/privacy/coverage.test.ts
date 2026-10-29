import { getTableColumns, getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { describe, expect, test } from "vitest";

import * as schema from "@/server/db/schema";
import messages from "../../../../../messages/en.json";

// The privacy notice must say what the website keeps (task 19's plan, R12).
// So every table in src/server/db/schema.ts is listed here: a personal-data
// table with the PrivacyPage item that describes it and its columns, or null
// when it holds no personal data in production. A task that adds a table, or
// a column to a personal-data table (a customer's name, say), fails this test
// until it decides what it is, and, if it's personal data, adds it to the
// notice (and moves LOGIN_NOTICE_VERSION: consent.test.ts pins the wording).

type Personal = { item: keyof typeof messages.PrivacyPage.items; columns: readonly string[] };

const TABLES: Record<string, Personal | null> = {
  // Personal data: the notice item that describes each table, and its columns.
  users: {
    item: "number",
    columns: ["id", "name", "email", "email_verified", "image", "phone_number", "phone_number_verified", "role", "created_at", "updated_at"],
  },
  sessions: {
    item: "session",
    columns: ["id", "token", "user_id", "expires_at", "ip_address", "user_agent", "created_at", "updated_at"],
  },
  verifications: { item: "codes", columns: ["id", "identifier", "value", "expires_at", "created_at", "updated_at"] },
  consents: {
    item: "consent",
    columns: ["id", "user_id", "purpose", "notice_version", "locale", "given_at", "recorded_at"],
  },
  login_attempts: {
    item: "attempts",
    columns: ["id", "phone_number", "ip_address", "locale", "notice_version", "consent_given_at", "sms_sent", "created_at"],
  },
  // No personal data in production.
  accounts: null, // Better Auth's sign-in methods: phone login never writes here
  dev_messages: null, // the fake SMS provider's outbox: development and tests only
  garage_settings: null,
  opening_hours: null,
  slot_rules: null,
  calendar_exceptions: null,
  slot_counters: null,
  // The vehicle catalogue (task 17): the garage's list of types, brands and models, nobody's own vehicle.
  vehicle_categories: null,
  vehicle_makes: null,
  vehicle_models: null,
};

/** Every table schema.ts defines, by its database name. */
function tablesByName(): Map<string, PgTable> {
  // Everything schema.ts exports that is a table (enums aside).
  const tables = Object.values(schema).filter((value) => is(value, PgTable)) as unknown as PgTable[];
  return new Map(tables.map((table) => [getTableName(table), table]));
}

const schemaTables = () => [...tablesByName().keys()].sort();

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
    for (const [table, personal] of Object.entries(TABLES)) {
      if (personal) expect(messages.PrivacyPage.items[personal.item], `${table} -> ${personal.item}`).toBeTruthy();
    }
  });

  test("a personal-data table's columns are the ones listed here (a new one may be new personal data)", () => {
    const tables = tablesByName();
    for (const [name, personal] of Object.entries(TABLES)) {
      if (!personal) continue;
      const columns = Object.values(getTableColumns(tables.get(name)!)).map((column) => column.name);
      expect(
        [...columns].sort(),
        `${name} changed. If a new column holds personal data, describe it in the privacy notice (PrivacyPage.items.${personal.item}) and move LOGIN_NOTICE_VERSION; then update its list here.`,
      ).toEqual([...personal.columns].sort());
    }
  });
});
