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
  type AnyPgColumn,
  boolean,
  check,
  date,
  foreignKey,
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

import type { BookingEventKind, BookingStatus, LinePriceStatus } from "@/domain/bookings";
import type { ConsentPurpose } from "@/domain/consent";
import type { JobStatus } from "@/domain/jobs";
import type { Weekday } from "@/domain/opening-hours";
import type { Role } from "@/domain/roles";
import type { ServiceKind } from "@/domain/services";
import type { Fuel, VehicleKind } from "@/domain/vehicles";
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
 * Only reserveSlot, releaseSlot and moveSlot change `reserved`. Each change
 * is one statement that never takes it past the slot's capacity or below 0
 * (moveSlot makes two, inside the caller's transaction).
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

// --- Vehicle catalogue (task 17) ---------------------------------------------
//
// The kinds, price groups, brands and models the garage works on
// (src/domain/vehicles.ts explains each). Ids are text made from names
// ("car-honda-city") and never change: every process seeds its own copy, so
// the same vehicle must get the same id everywhere. "make" in the table and
// column names means the brand (the master plan's names).
//
// Nothing is deleted: a brand or model the garage stops serving gets
// listed = false, so a customer's saved vehicle (task 21) can still point
// to it. The foreign keys refuse a delete ("restrict") to keep it that way.

/** Every kind, as in VEHICLE_KINDS (src/domain/vehicles.ts; vehicle-catalogue.test.ts checks they match). */
export const vehicleKind = pgEnum("vehicle_kind", ["car", "two-wheeler"] as const satisfies readonly VehicleKind[]);

/** Every fuel, as in FUELS, in the picker's order (vehicle-catalogue.test.ts checks they match). */
export const fuel = pgEnum("fuel", ["petrol", "diesel", "cng", "electric"] as const satisfies readonly Fuel[]);

/**
 * A CHECK that a LocalizedText's English is filled in. Spelled out with
 * coalesce: text with no "en" key gives NULL, and a CHECK whose result is
 * NULL passes.
 */
const englishFilled = (text: unknown) => sql`coalesce(btrim(${text} ->> 'en'), '') <> ''`;

/**
 * Price groups within a kind: task 18 prices services by group and fuel.
 * Visitors never see a group, so there's nothing to hide here.
 */
export const vehicleCategories = pgTable(
  "vehicle_categories",
  {
    /** "hatchback". */
    id: text("id").primaryKey(),
    kind: vehicleKind("kind").notNull(),
    name: jsonb("name").$type<LocalizedText>().notNull(),
    /** The list order, smallest first. */
    position: integer("position").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Lets a model's (category, kind) pair point here: the database then
    // refuses a car model in a two-wheeler group.
    unique("vehicle_categories_id_kind").on(table.id, table.kind),
    check("vehicle_categories_english_name", englishFilled(table.name)),
  ],
);

/** Brands, one row per kind: "car-honda" and "two-wheeler-honda" are two rows. */
export const vehicleMakes = pgTable(
  "vehicle_makes",
  {
    /** "car-maruti-suzuki". */
    id: text("id").primaryKey(),
    kind: vehicleKind("kind").notNull(),
    name: jsonb("name").$type<LocalizedText>().notNull(),
    /** The order within its kind's list, smallest first. */
    position: integer("position").notNull(),
    /** False hides it from the site without deleting it. */
    listed: boolean("listed").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("vehicle_makes_id_kind").on(table.id, table.kind),
    check("vehicle_makes_english_name", englishFilled(table.name)),
  ],
);

/**
 * Models. Each row repeats its brand's kind, so two composite foreign keys
 * can check it: (make_id, kind) must be a brand of that kind, and
 * (category_id, kind) a price group of that kind. A plain foreign key on
 * make_id alone couldn't stop a scooter group on a car.
 */
export const vehicleModels = pgTable(
  "vehicle_models",
  {
    /** "car-honda-city": its brand's id, then its own name. */
    id: text("id").primaryKey(),
    makeId: text("make_id").notNull(),
    categoryId: text("category_id").notNull(),
    kind: vehicleKind("kind").notNull(),
    name: jsonb("name").$type<LocalizedText>().notNull(),
    /** What it runs on: at least one, in FUELS order. */
    fuels: fuel("fuels").array().notNull(),
    /** The order within its brand, smallest first. */
    position: integer("position").notNull(),
    /** False hides it from the site without deleting it. */
    listed: boolean("listed").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: "vehicle_models_make_kind_fkey",
      columns: [table.makeId, table.kind],
      foreignColumns: [vehicleMakes.id, vehicleMakes.kind],
    }).onDelete("restrict"),
    foreignKey({
      name: "vehicle_models_category_kind_fkey",
      columns: [table.categoryId, table.kind],
      foreignColumns: [vehicleCategories.id, vehicleCategories.kind],
    }).onDelete("restrict"),
    check("vehicle_models_has_fuels", sql`cardinality(${table.fuels}) > 0`),
    check("vehicle_models_english_name", englishFilled(table.name)),
  ],
);

// --- Services and prices (task 18) -------------------------------------------
//
// The services (brakes, AC...) and packages (Basic, Standard, Comprehensive)
// in one table, and their real prices (src/domain/services.ts explains each).
// Ids are text made from names, like the catalogue's, for the same reason:
// every process seeds its own copy. A service the garage stops offering gets
// listed = false; nothing is deleted while a price (or, from task 23, a
// booking) points to it.

/** Every kind, as in SERVICE_KINDS (src/domain/services.ts; services-tables.test.ts checks they match). */
export const serviceKind = pgEnum("service_kind", ["service", "package"] as const satisfies readonly ServiceKind[]);

export const services = pgTable(
  "services",
  {
    /** "periodic-service", "car-basic". A service's id is its page address. */
    id: text("id").primaryKey(),
    kind: serviceKind("kind").notNull(),
    name: jsonb("name").$type<LocalizedText>().notNull(),
    summary: jsonb("summary").$type<LocalizedText>().notNull(),
    /** Cars, two-wheelers or both (a package: exactly one). */
    vehicleKinds: vehicleKind("vehicle_kinds").array().notNull(),
    /** The fuels it's offered for, in FUELS order. */
    fuels: fuel("fuels").array().notNull(),
    /** What's included, in order: a list of LocalizedText, at least one. */
    included: jsonb("included").$type<LocalizedText[]>().notNull(),
    /** "Signs you need it": a list of LocalizedText, empty for a package. */
    signs: jsonb("signs").$type<LocalizedText[]>().notNull(),
    /** True when the garage prices it only after seeing the vehicle. */
    pricedAfterInspection: boolean("priced_after_inspection").notNull().default(false),
    /** The list order, smallest first. */
    position: integer("position").notNull(),
    /** False hides it from the site without deleting it. */
    listed: boolean("listed").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("services_has_vehicle_kinds", sql`cardinality(${table.vehicleKinds}) > 0`),
    check("services_package_one_kind", sql`${table.kind} <> 'package' or cardinality(${table.vehicleKinds}) = 1`),
    check("services_has_fuels", sql`cardinality(${table.fuels}) > 0`),
    check("services_english_name", englishFilled(table.name)),
    check("services_english_summary", englishFilled(table.summary)),
    // Only operators that can't fail: jsonb_array_length() would raise an
    // error on a non-list, and Postgres doesn't promise to test the type first.
    check("services_included_list", sql`jsonb_typeof(${table.included}) = 'array' and ${table.included} <> '[]'::jsonb`),
    check("services_signs_list", sql`jsonb_typeof(${table.signs}) = 'array'`),
  ],
);

/**
 * Real prices only: the sample prices that `npm run dev` shows live in code
 * (src/content/sample-prices.ts) and never reach this table. It starts empty;
 * task 39 lets the owner fill it in.
 */
export const servicePrices = pgTable(
  "service_prices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    serviceId: text("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "restrict" }),
    /** The price group (a vehicle_categories row): "hatchback". */
    categoryId: text("category_id")
      .notNull()
      .references(() => vehicleCategories.id, { onDelete: "restrict" }),
    /** Null prices every fuel the service covers; a row for one fuel wins over it. */
    fuel: fuel("fuel"),
    /** In paise: ₹1,500 is 150000. */
    pricePaise: integer("price_paise").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // NULLS NOT DISTINCT: without it, two "every fuel" rows (fuel null) for
    // the same service and group would both be allowed, since NULL never
    // equals NULL.
    unique("service_prices_service_category_fuel")
      .on(table.serviceId, table.categoryId, table.fuel)
      .nullsNotDistinct(),
    check("service_prices_positive", sql`${table.pricePaise} > 0`),
  ],
);

// --- Customers' vehicles (task 21) -------------------------------------------
//
// The vehicles customers add to their account. Only src/server/dal/
// customer-vehicles.ts reads or changes them, always for the logged-in user
// (never a user id from the browser). Ids are uuids: rows are made at
// runtime, so the catalogue's reason for name-based ids doesn't apply.

/**
 * A customer's vehicle. The brand and kind come from the model by a join, so
 * no copy of them can disagree with it.
 * - Deleting a user deletes their vehicles ("cascade"): a vehicle means
 *   nothing without its owner (task 43 erases a user's data).
 * - A model a vehicle uses can't be deleted ("restrict"): the garage hides
 *   models (listed = false), and the vehicle still shows its name.
 * - One customer can't save one registration number twice; two customers can.
 */
export const customerVehicles = pgTable(
  "customer_vehicles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    modelId: text("model_id")
      .notNull()
      .references(() => vehicleModels.id, { onDelete: "restrict" }),
    fuel: fuel("fuel").notNull(),
    /** The compact form from parseRegistration: "MH12AB1234", "22BH1234AB". */
    registrationNumber: text("registration_number").notNull(),
    /** India dates ("2027-03-12"); null when the customer didn't add one. Electric vehicles have no PUC date. */
    pucExpiresOn: date("puc_expires_on"),
    insuranceExpiresOn: date("insurance_expires_on"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("customer_vehicles_user_registration").on(table.userId, table.registrationNumber),
    // A backstop: the data-access layer only ever writes parseRegistration's compact form.
    check("customer_vehicles_registration_compact", sql`${table.registrationNumber} ~ '^[A-Z0-9]{8,11}$'`),
  ],
);

// --- Bookings (task 23) ------------------------------------------------------
//
// A customer's booking: one vehicle, one slot, and the services chosen.
// Only src/server/dal/bookings.ts writes them, always for the logged-in user,
// in the same transaction that takes the slot's place (reserveSlot). A
// booking keeps its own copy of the vehicle and of each service's name and
// price, so a later change to the vehicle, the catalogue or the price list
// never changes a booking that's already made.

/** Every status, as in BOOKING_STATUSES (src/domain/bookings.ts; bookings-tables.test.ts checks they match). */
export const bookingStatus = pgEnum("booking_status", ["booked"] as const satisfies readonly BookingStatus[]);

/** Every history entry kind, as in BOOKING_EVENT_KINDS (bookings-tables.test.ts checks they match). */
export const bookingEventKind = pgEnum("booking_event_kind", [
  "booked",
  "job-update",
] as const satisfies readonly BookingEventKind[]);

/** A job's step after Booked, as in JOB_STATUSES (src/domain/jobs.ts; job-timeline-tables.test.ts checks they match). */
export const jobStatus = pgEnum("job_status", [
  "vehicle-received",
  "inspection",
  "awaiting-approval",
  "in-service",
  "ready",
  "completed",
] as const satisfies readonly JobStatus[]);

/** How a line is priced, as in LINE_PRICE_STATUSES (bookings-tables.test.ts checks they match). */
export const bookingLinePriceStatus = pgEnum("booking_line_price_status", [
  "price",
  "on-inspection",
  "no-price",
] as const satisfies readonly LinePriceStatus[]);

/**
 * One booking.
 * - A user with bookings can't be deleted ("restrict"): task 43 decides what
 *   deleting someone's data does to their bookings.
 * - Removing the saved vehicle keeps the booking: vehicle_id becomes null
 *   ("set null") and the copy below still says which vehicle it was.
 * - A model or price group a booking points to can't be deleted ("restrict"):
 *   the garage hides them instead (listed = false).
 * - The same request token twice for one user is refused: a double tap on
 *   "Confirm" makes one booking (the save looks the token up first; this is
 *   the backstop).
 */
export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Six characters from BOOKING_CODE_ALPHABET, stored without the dash: "K7Q4MX" (shown "K7Q-4MX"). */
    code: text("code").notNull().unique(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    /** The saved vehicle it was made for; null once the customer removes that vehicle. */
    vehicleId: uuid("vehicle_id").references(() => customerVehicles.id, { onDelete: "set null" }),
    // The vehicle, copied at booking time.
    vehicleKind: vehicleKind("vehicle_kind").notNull(),
    modelId: text("model_id")
      .notNull()
      .references(() => vehicleModels.id, { onDelete: "restrict" }),
    fuel: fuel("fuel").notNull(),
    /** The price group the lines were priced for. */
    categoryId: text("category_id")
      .notNull()
      .references(() => vehicleCategories.id, { onDelete: "restrict" }),
    /** The compact form from parseRegistration: "MH12AB1234". */
    registrationNumber: text("registration_number").notNull(),
    /** The slot: the moment the vehicle reaches the garage (UTC). */
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    status: bookingStatus("status").notNull().default("booked"),
    /** True when any line has no amount (after inspection, or no price set yet). */
    isEstimate: boolean("is_estimate").notNull(),
    /** The sum of the priced lines, in paise; null when no line has a price. */
    totalPaise: integer("total_paise"),
    /** A random uuid per run of the booking page (see above). */
    requestToken: uuid("request_token").notNull(),
    // Pickup and drop (task 24): copies, so a later fee change never reaches
    // the booking. All three null when the customer brings the vehicle in.
    /** The address the vehicle is collected from and brought back to, as typed (spaces collapsed). */
    pickupAddress: text("pickup_address"),
    /** Its six-digit PIN code: "412101". No foreign key: a copy, like the vehicle's. */
    pickupPostalCode: text("pickup_postal_code"),
    /** The fee for pickup and drop together, in paise; 0 when free. Not part of total_paise. */
    pickupFeePaise: integer("pickup_fee_paise"),
    // The work (task 31). The step is apart from the booking's status above:
    // null until the vehicle reaches the garage, which the timeline shows as
    // "Booked". Only src/server/dal/jobs.ts moves it.
    jobStatus: jobStatus("job_status"),
    /**
     * The mechanic doing the job; task 27 assigns one. Deleting that user
     * unassigns the job ("set null"); their updates keep them as the actor.
     */
    assignedMechanicId: text("assigned_mechanic_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("bookings_user_request_token").on(table.userId, table.requestToken),
    // Backstops: the save only ever writes makeBookingCode's and parseRegistration's forms.
    check("bookings_code_format", sql`${table.code} ~ '^[A-HJKMNP-Z2-9]{6}$'`),
    check("bookings_registration_compact", sql`${table.registrationNumber} ~ '^[A-Z0-9]{8,11}$'`),
    check("bookings_total_positive", sql`${table.totalPaise} > 0`),
    // Pickup: all three or none, a real PIN code, and a fee that may be 0.
    check(
      "bookings_pickup_complete",
      sql`(${table.pickupAddress} is null) = (${table.pickupPostalCode} is null) and (${table.pickupAddress} is null) = (${table.pickupFeePaise} is null)`,
    ),
    check("bookings_pickup_postal_code_format", sql`${table.pickupPostalCode} ~ '^[1-9][0-9]{5}$'`),
    check("bookings_pickup_fee_not_negative", sql`${table.pickupFeePaise} >= 0`),
    // How full a slot is, and how many future bookings one customer holds.
    index("bookings_starts_at_index").on(table.startsAt),
    index("bookings_user_id_starts_at_index").on(table.userId, table.startsAt),
    // A mechanic's jobs.
    index("bookings_assigned_mechanic_index").on(table.assignedMechanicId),
  ],
);

/**
 * The lines of a booking: one package, or one or more services, each with a
 * copy of its name and its price at booking time. Deleting a booking deletes
 * its lines ("cascade"); a service a line points to can't be deleted
 * ("restrict"): the garage hides it instead.
 */
export const bookingItems = pgTable(
  "booking_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    serviceId: text("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "restrict" }),
    serviceKind: serviceKind("service_kind").notNull(),
    /** The service's name when it was booked. */
    name: jsonb("name").$type<LocalizedText>().notNull(),
    priceStatus: bookingLinePriceStatus("price_status").notNull(),
    /** In paise, only for "price"; null for the other two. */
    pricePaise: integer("price_paise"),
    /** 0, 1, 2...: the order the customer chose them in. */
    position: integer("position").notNull(),
  },
  (table) => [
    // NULL passes a CHECK, so a line without an amount is allowed here; the
    // next CHECK ties the amount to the status.
    check("booking_items_price_positive", sql`${table.pricePaise} > 0`),
    check(
      "booking_items_price_matches_status",
      sql`(${table.priceStatus} = 'price') = (${table.pricePaise} is not null)`,
    ),
    index("booking_items_booking_id_index").on(table.bookingId),
  ],
);

/**
 * A booking's history: who did what, and when. Each booking starts with one
 * "booked" entry; staff add "job-update" entries (task 31): a move to a new
 * step, a note for the customer, photos, or a mix. Tasks 25–27 add
 * cancelling, confirming and moving. Deleting a booking deletes its history
 * ("cascade"); a user named in one can't be deleted ("restrict"), like the
 * booking itself.
 */
export const bookingEvents = pgTable(
  "booking_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    kind: bookingEventKind("kind").notNull(),
    /** Who did it: the customer for "booked"; staff from task 26 on. */
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    // A job update's parts (task 31); all empty on a "booked" entry.
    /** The step the job moved to; null when the update didn't move it. */
    jobStatus: jobStatus("job_status"),
    /** For the customer, as staff wrote it (trimmed; line breaks kept). */
    note: text("note"),
    /**
     * The update's photos. One set belongs to one update. The photo cleanup
     * deleting the set (a year after the update) makes this null ("set null")
     * and keeps the update; had_photos still says it had some.
     */
    photoSetId: uuid("photo_set_id")
      .unique()
      .references((): AnyPgColumn => photoSets.id, { onDelete: "set null" }),
    hadPhotos: boolean("had_photos").notNull().default(false),
    /** A random uuid per visit of the update form: a second send makes no second update. */
    requestToken: uuid("request_token"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("booking_events_booking_id_index").on(table.bookingId),
    unique("booking_events_actor_request_token").on(table.actorUserId, table.requestToken),
    // These compare kind as text, never as the enum: the migration that adds
    // "job-update" runs in one transaction with every other pending
    // migration, and Postgres refuses a new enum value until it's committed.
    check(
      "booking_events_job_update_has_content",
      sql`${table.kind}::text <> 'job-update' or ${table.jobStatus} is not null or ${table.note} is not null or ${table.hadPhotos}`,
    ),
    check(
      "booking_events_booked_is_plain",
      sql`${table.kind}::text <> 'booked' or (${table.jobStatus} is null and ${table.note} is null and ${table.photoSetId} is null and not ${table.hadPhotos} and ${table.requestToken} is null)`,
    ),
    check("booking_events_photos_flag", sql`${table.photoSetId} is null or ${table.hadPhotos}`),
    // 1000 is JOB_UPDATE_RULES.noteMaxLength; job-timeline-tables.test.ts keeps them in step.
    check("booking_events_note_length", sql`char_length(${table.note}) between 1 and 1000`),
  ],
);

// --- Pickup and drop (task 24) ---------------------------------------------
//
// The PIN codes the garage collects vehicles from and brings them back to,
// each with one fee for pickup and drop together, the same for every vehicle
// (owner, 2026-11-18). Real areas only: it starts empty in every build, and
// the samples `npm run dev` shows live in src/content/sample-pickup-areas.ts.
// Task 28 lets the owner add, change and pause areas.

/**
 * One area. Keyed by its PIN code, which every build worker and process
 * agrees on. `listed = false` pauses pickup there without losing the fee; a
 * paused area is neither shown nor bookable. Bookings keep their own copy,
 * so deleting a row never changes one.
 */
export const pickupAreas = pgTable(
  "pickup_areas",
  {
    /** Six digits, the first never 0 (isIndianPinCode in src/domain/garage.ts). */
    postalCode: text("postal_code").primaryKey(),
    /** In paise, for pickup and drop together; 0 means free. */
    feePaise: integer("fee_paise").notNull(),
    listed: boolean("listed").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("pickup_areas_postal_code_format", sql`${table.postalCode} ~ '^[1-9][0-9]{5}$'`),
    check("pickup_areas_fee_not_negative", sql`${table.feePaise} >= 0`),
  ],
);

// --- Photos (task 30) ---------------------------------------------------------
//
// A customer's photos come in sets: one set per estimate request (task 32) or
// job update (task 31), at most 6 photos (PHOTO_RULES in src/domain/photos.ts,
// checked in src/server/dal/photos.ts). The files live in photo storage
// (src/server/providers/photos/); a row says where (storage_key) and whether
// the upload finished.
//
// Deleting a user deletes their sets and photos here ("cascade"), but not the
// files in storage: deletePhotosOfUser removes those first (task 43).

/** Every status, as in PHOTO_STATUSES (src/domain/photos.ts; photos-tables.test.ts checks they match). */
export const photoStatus = pgEnum("photo_status", ["pending", "stored"]);

export const photoSets = pgTable(
  "photo_sets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** The customer the photos belong to. */
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /**
     * Set when the set's job update is saved (task 31) or its estimate request
     * is closed (tasks 33, 34); a year later it's deleted.
     */
    closedAt: timestamp("closed_at", { withTimezone: true }),
    /**
     * Set for photos staff take of a job (task 31): the set is the job's, and
     * only staff who may update that job add to it. user_id is still the
     * booking's customer, so they see the photos and deleting their data
     * deletes them. A booking with job photos can't be deleted ("restrict")
     * until its photos are (task 43).
     */
    bookingId: uuid("booking_id").references((): AnyPgColumn => bookings.id, { onDelete: "restrict" }),
  },
  (table) => [
    index("photo_sets_user_created_index").on(table.userId, table.createdAt),
    index("photo_sets_booking_index").on(table.bookingId),
  ],
);

export const photos = pgTable(
  "photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    setId: uuid("set_id")
      .notNull()
      .references(() => photoSets.id, { onDelete: "cascade" }),
    /** "sets/<set id>/<photo id>.jpg" (photoKey in src/domain/photos.ts). */
    storageKey: text("storage_key").notNull().unique(),
    status: photoStatus("status").notNull().default("pending"),
    /** The stored file's size, filled in when the upload is finished. */
    bytes: integer("bytes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    storedAt: timestamp("stored_at", { withTimezone: true }),
  },
  (table) => [
    index("photos_set_index").on(table.setId),
    // 2097152 is PHOTO_RULES.maxBytes; photos-tables.test.ts keeps the two in step.
    check("photos_bytes_limit", sql`${table.bytes} is null or (${table.bytes} > 0 and ${table.bytes} <= 2097152)`),
    check("photos_stored_complete", sql`${table.status} <> 'stored' or (${table.bytes} is not null and ${table.storedAt} is not null)`),
  ],
);

/**
 * Requests for a free estimate (task 32): a customer says which vehicle and
 * what's wrong, with photos if they like. The vehicle is a copy, like a
 * booking's, so a later change to the saved vehicle never changes the
 * request. There's no status yet: every request is waiting for the garage
 * until task 33's estimates answer it.
 */
export const estimateRequests = pgTable(
  "estimate_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Like bookings, deleting a customer with requests is refused until task 43 decides. */
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    /** The saved vehicle it was sent for; null when it came from the picker, or once the vehicle is removed. */
    vehicleId: uuid("vehicle_id").references(() => customerVehicles.id, { onDelete: "set null" }),
    // The vehicle, copied when the request is sent.
    vehicleKind: vehicleKind("vehicle_kind").notNull(),
    modelId: text("model_id")
      .notNull()
      .references(() => vehicleModels.id, { onDelete: "restrict" }),
    fuel: fuel("fuel").notNull(),
    /** The compact form ("MH12AB1234"), only when it came from a saved vehicle. */
    registrationNumber: text("registration_number"),
    /** What's wrong, as the customer wrote it (trimmed; line breaks kept). */
    description: text("description").notNull(),
    /**
     * The customer's photos, if any. One set belongs to one request. When the
     * photo cleanup deletes the set (30 days after it started, unless task 33
     * closes it), this goes null and the request stays.
     */
    photoSetId: uuid("photo_set_id")
      .unique()
      .references(() => photoSets.id, { onDelete: "set null" }),
    /** A random uuid per visit of the form: a second send makes no second request. */
    requestToken: uuid("request_token").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("estimate_requests_user_request_token").on(table.userId, table.requestToken),
    // Backstops: the save only ever writes checkEstimateRequestInput's and parseRegistration's forms.
    // 10 and 1000 are ESTIMATE_REQUEST_RULES; estimate-requests-table.test.ts keeps them in step.
    check(
      "estimate_requests_description_length",
      sql`char_length(${table.description}) between 10 and 1000`,
    ),
    check("estimate_requests_registration_compact", sql`${table.registrationNumber} ~ '^[A-Z0-9]{8,11}$'`),
    // The customer's list, and the staff list, newest first.
    index("estimate_requests_user_created_index").on(table.userId, table.createdAt),
    index("estimate_requests_created_index").on(table.createdAt),
  ],
);

// --- Reviews (task 37) --------------------------------------------------------
//
// A customer's review of one completed job, public as soon as it's sent
// (owner, 2026-11-19). Staff with "content.edit" can hide it, show it
// again, and reply. Only src/server/dal/reviews.ts writes them.

/**
 * One review per booking. It keeps its own copy of the first name it's
 * credited to, so a later name change never rewrites a public review; the
 * vehicle comes from the booking, which keeps its own copy. Deleting the
 * booking deletes its review ("cascade"); a customer with reviews can't be
 * deleted ("restrict"), like their bookings, until task 43 decides.
 */
export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .unique()
      .references(() => bookings.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    /** 1 to 5 stars. */
    rating: integer("rating").notNull(),
    /** As the customer wrote it (trimmed; line breaks kept), or null for stars only. */
    comment: text("comment"),
    /** The first word of the customer's name when they sent it: "Asha". */
    shownName: text("shown_name").notNull(),
    /** A random uuid per visit of the form: a second send makes no second review. */
    requestToken: uuid("request_token").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /** Set while staff hide it: hidden reviews stay stored but aren't shown or counted. */
    hiddenAt: timestamp("hidden_at", { withTimezone: true }),
    hiddenBy: text("hidden_by").references(() => users.id, { onDelete: "set null" }),
    /** The garage's one reply, shown under the review. */
    reply: text("reply"),
    repliedAt: timestamp("replied_at", { withTimezone: true }),
    repliedBy: text("replied_by").references(() => users.id, { onDelete: "set null" }),
  },
  (table) => [
    unique("reviews_user_request_token").on(table.userId, table.requestToken),
    // Backstops: the save only writes checkReviewInput's forms. 1000 is
    // REVIEW_RULES.commentMaxLength and 60 the name form's NAME_MAX_LENGTH;
    // reviews-table.test.ts keeps them in step.
    check("reviews_rating_range", sql`${table.rating} between 1 and 5`),
    check("reviews_comment_length", sql`char_length(${table.comment}) between 1 and 1000`),
    check("reviews_shown_name_length", sql`char_length(${table.shownName}) between 1 and 60`),
    check("reviews_reply_length", sql`char_length(${table.reply}) between 1 and 1000`),
    // A reply has its time, and only a reply has one.
    check("reviews_reply_complete", sql`(${table.reply} is null) = (${table.repliedAt} is null)`),
    // The public list: shown ones, newest first.
    index("reviews_hidden_created_index").on(table.hiddenAt, table.createdAt),
  ],
);
