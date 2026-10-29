CREATE TABLE "calendar_exceptions" (
	"date" date PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "slot_counters" (
	"starts_at" timestamp with time zone PRIMARY KEY NOT NULL,
	"reserved" integer NOT NULL,
	CONSTRAINT "slot_counters_reserved_not_negative" CHECK ("slot_counters"."reserved" >= 0)
);
--> statement-breakpoint
CREATE TABLE "slot_rules" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"slot_minutes" integer NOT NULL,
	"capacity" integer NOT NULL,
	"min_days_ahead" integer NOT NULL,
	"max_days_ahead" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "slot_rules_single_row" CHECK ("slot_rules"."id" = 1),
	CONSTRAINT "slot_rules_slot_minutes_range" CHECK ("slot_rules"."slot_minutes" between 15 and 480),
	CONSTRAINT "slot_rules_capacity_range" CHECK ("slot_rules"."capacity" between 1 and 50),
	CONSTRAINT "slot_rules_min_days_ahead_range" CHECK ("slot_rules"."min_days_ahead" between 0 and 60),
	CONSTRAINT "slot_rules_max_days_ahead_range" CHECK ("slot_rules"."max_days_ahead" between "slot_rules"."min_days_ahead" and 60)
);
