// The database's tables, written in TypeScript with Drizzle.
//
// To change a table: edit this file, run `npm run db:generate`, and commit
// the new .sql file in src/server/db/migrations/ (with meta/) in the same
// commit. Restart `npm run dev` to apply it to your local database. Never
// edit a migration that is already merged: write a new one.
//
// Names in the database are snake_case (address_text); the TypeScript names
// are camelCase (addressText). Each column names its database name itself, so
// what you read here is what the SQL says.
//
// Rules for this file:
// - Import app code with `import type` only. drizzle-kit loads this file
//   outside Next.js, where the "@/" alias may not work at runtime; type
//   imports disappear before the file runs.
// - No `import "server-only"`: drizzle-kit and the tests read this file
//   outside Next.js. It holds no secrets and runs no queries.
// - Times are `timestamp with time zone`, stored in UTC (the database session
//   runs in UTC too: src/server/db/index.ts).

import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  time,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import type { ConsentPurpose } from "@/domain/consent";
import type { Weekday } from "@/domain/opening-hours";
import type { Role } from "@/domain/roles";
import type { LocalizedText } from "@/i18n/localized-text";

/**
 * The days of the week, Monday first. The same list as WEEKDAYS in
 * src/domain/opening-hours.ts (database.test.ts checks they match); it's
 * written out here because this file may only import types.
 */
export const weekday = pgEnum("weekday", [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const satisfies readonly Weekday[]);

/**
 * The garage's contact details: exactly one row, with id 1. The CHECK makes
 * a second row impossible, so code never has to ask "which garage?".
 */
export const garageSettings = pgTable(
  "garage_settings",
  {
    id: integer("id").primaryKey().default(1),
    /** E.164 ("+919764750567"). Any Indian number; checkGarage checks it before a save. */
    phone: text("phone").notNull(),
    /** E.164, and a mobile (WhatsApp needs one). */
    whatsapp: text("whatsapp").notNull(),
    /** Street, area, city and state, per language: { en, hi? }. */
    addressText: jsonb("address_text").$type<LocalizedText>().notNull(),
    /** The 6-digit PIN code, kept as text: "412101". */
    postalCode: text("postal_code").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check("garage_settings_single_row", sql`${table.id} = 1`)],
);

/**
 * One row per weekday. A closed day has no times; an open day has both, and
 * opens before it closes (India time, the garage's clock). Times come back
 * from the database as "10:00:00".
 */
export const openingHours = pgTable(
  "opening_hours",
  {
    weekday: weekday("weekday").primaryKey(),
    opens: time("opens"),
    closes: time("closes"),
  },
  (table) => [
    // Spelled out on purpose. A CHECK passes when its result is NULL, so
    // "opens < closes" alone would let a row with only one time through.
    check(
      "opening_hours_closed_or_opens_before_closes",
      sql`(${table.opens} is null and ${table.closes} is null) or (${table.opens} is not null and ${table.closes} is not null and ${table.opens} < ${table.closes})`,
    ),
  ],
);

// --- Booking slots (task 22) -------------------------------------------------
//
// src/domain/slots.ts works out the slots from these tables and the opening
// hours; src/server/dal/slots.ts reads and changes them.

/**
 * The slot rules: exactly one row, with id 1, like garage_settings. The
 * ranges in the CHECKs are SLOT_RULE_LIMITS in src/domain/slots.ts, typed
 * again here because this file may only import types (database.test.ts
 * checks they match). The capacity CHECK (at least 1) also lets a first
 * reservation insert its counter with 1 place taken.
 */
export const slotRules = pgTable(
  "slot_rules",
  {
    id: integer("id").primaryKey().default(1),
    /** How long a slot is, in minutes: 60. */
    slotMinutes: integer("slot_minutes").notNull(),
    /** Vehicles per slot, cars and two-wheelers together. */
    capacity: integer("capacity").notNull(),
    /** The first bookable day, counted from today in India: 1 = tomorrow. */
    minDaysAhead: integer("min_days_ahead").notNull(),
    /** The last bookable day, counted from today in India: 7. */
    maxDaysAhead: integer("max_days_ahead").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("slot_rules_single_row", sql`${table.id} = 1`),
    check("slot_rules_slot_minutes_range", sql`${table.slotMinutes} between 15 and 480`),
    check("slot_rules_capacity_range", sql`${table.capacity} between 1 and 50`),
    check("slot_rules_min_days_ahead_range", sql`${table.minDaysAhead} between 0 and 60`),
    check("slot_rules_max_days_ahead_range", sql`${table.maxDaysAhead} between ${table.minDaysAhead} and 60`),
  ],
);

/**
 * Days the garage is closed although their weekday has hours: festivals like
 * Diwali. One row per India date ("2026-11-08", string mode). Closed all day;
 * task 28 lets the owner add them, and may add a name or special hours as
 * new nullable columns.
 */
export const calendarExceptions = pgTable("calendar_exceptions", {
  date: date("date").primaryKey(),
});

/**
 * Places taken per slot. A slot is named by the moment it starts (UTC); its
 * row appears with the first reservation, so there's no row per future slot.
 * Only reserveSlot, releaseSlot and moveSlot change `reserved`, each in one
 * statement that never takes it past the slot's capacity or below 0.
 */
export const slotCounters = pgTable(
  "slot_counters",
  {
    startsAt: timestamp("starts_at", { withTimezone: true }).primaryKey(),
    reserved: integer("reserved").notNull(),
  },
  (table) => [check("slot_counters_reserved_not_negative", sql`${table.reserved} >= 0`)],
);

// --- Login (task 15) ---------------------------------------------------------
//
// users, sessions, accounts and verifications are Better Auth's tables
// (src/server/auth/auth.ts). Better Auth finds each table by its key in the
// schema object it's given, and each column by its TypeScript name, so those
// names are Better Auth's own (emailVerified, expiresAt). The database names
// stay snake_case. Better Auth checks these tables against what it expects
// when it starts, and refuses to run if a column is missing. Ids on its
// tables are text: Better Auth makes them.

/** Every role, as in ROLES (src/domain/roles.ts; database.test.ts checks they match). */
export const userRole = pgEnum("user_role", [
  "customer",
  "mechanic",
  "manager",
  "owner",
] as const satisfies readonly Role[]);

/** Everyone who has logged in. Phone login only: every user has a number. */
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  /** Empty for now: the profile (task 21) asks for a name. */
  name: text("name").notNull(),
  /**
   * Better Auth requires an email. Phone users get "<digits>@phone.invalid":
   * the .invalid domain is reserved, so nothing is ever delivered there.
   */
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  /** E.164: "+919876543210". */
  phoneNumber: text("phone_number").notNull().unique(),
  phoneNumberVerified: boolean("phone_number_verified").notNull().default(false),
  /** Everyone starts as a customer. Task 16 decides who can change it. */
  role: userRole("role").notNull().default("customer"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/**
 * One row per logged-in browser. The cookie holds the token (signed); each
 * request looks the row up, so deleting it logs that browser out.
 */
export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull().unique(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("sessions_user_id_index").on(table.userId)],
);

/**
 * Better Auth's sign-in methods per user (passwords, Google...). Phone login
 * never writes here, but Better Auth requires the table.
 */
export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("accounts_user_id_index").on(table.userId)],
);

/**
 * Login codes waiting to be typed in. identifier is the number; value is
 * "<code>:<wrong tries>" (Better Auth's format: readLiveCode in
 * src/server/dal/login-codes.ts parses it). A row lives 5 minutes at most.
 */
export const verifications = pgTable(
  "verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("verifications_identifier_index").on(table.identifier)],
);

/** Every purpose, as in CONSENT_PURPOSES (src/domain/consent.ts; database.test.ts checks they match). */
export const consentPurpose = pgEnum("consent_purpose", [
  "age_18_plus",
  "account_and_booking_contact",
] as const satisfies readonly ConsentPurpose[]);

/**
 * Proof of what each user agreed to (DPDP Act): one row per purpose and
 * notice version. Deleting a user is refused while it has consent records
 * ("restrict"): task 43 decides what deleting someone's data does to them.
 */
export const consents = pgTable(
  "consents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    purpose: consentPurpose("purpose").notNull(),
    /** Which wording the person saw (LOGIN_NOTICE_VERSION). */
    noticeVersion: text("notice_version").notNull(),
    /** The language the page was in: "en". */
    locale: text("locale").notNull(),
    /** When the box was ticked: the login attempt's time. */
    givenAt: timestamp("given_at", { withTimezone: true }).notNull(),
    /** When this row was written: after the code was checked. */
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("consents_user_purpose_version").on(table.userId, table.purpose, table.noticeVersion)],
);

/**
 * One row each time the login form asks for a code (the phone step, or
 * "Send a new code"), whether or not an SMS went out. It carries the consent
 * the person gave on that form, and the send limits count the rows with
 * sms_sent. Rows older than 48 hours are deleted.
 */
export const loginAttempts = pgTable(
  "login_attempts",
  {
    /** Random: the form sends it back with the code, to tie the consent to this attempt. */
    id: uuid("id").primaryKey().defaultRandom(),
    phoneNumber: text("phone_number").notNull(),
    /** Null when it isn't known (local runs). */
    ipAddress: text("ip_address"),
    locale: text("locale").notNull(),
    noticeVersion: text("notice_version").notNull(),
    consentGivenAt: timestamp("consent_given_at", { withTimezone: true }).notNull(),
    smsSent: boolean("sms_sent").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("login_attempts_phone_number_created_at_index").on(table.phoneNumber, table.createdAt),
    index("login_attempts_ip_address_created_at_index").on(table.ipAddress, table.createdAt),
  ],
);

/** How a message travels. Only SMS for now; WhatsApp and email come in task 35. */
export const messageChannel = pgEnum("message_channel", ["sms", "whatsapp", "email"]);

/**
 * Messages the fake providers "sent" (src/server/providers/), shown on
 * /dev/outbox. Real providers never write here. Rows older than 48 hours
 * are deleted.
 */
export const devMessages = pgTable(
  "dev_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channel: messageChannel("channel").notNull(),
    /** E.164 for SMS and WhatsApp. */
    recipient: text("recipient").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("dev_messages_created_at_index").on(table.createdAt)],
);
