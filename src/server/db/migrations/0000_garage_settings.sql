CREATE TYPE "public"."weekday" AS ENUM('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday');--> statement-breakpoint
CREATE TABLE "garage_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"phone" text NOT NULL,
	"whatsapp" text NOT NULL,
	"address_text" jsonb NOT NULL,
	"postal_code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "garage_settings_single_row" CHECK ("garage_settings"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "opening_hours" (
	"weekday" "weekday" PRIMARY KEY NOT NULL,
	"opens" time,
	"closes" time,
	CONSTRAINT "opening_hours_closed_or_opens_before_closes" CHECK (("opening_hours"."opens" is null and "opening_hours"."closes" is null) or ("opening_hours"."opens" is not null and "opening_hours"."closes" is not null and "opening_hours"."opens" < "opening_hours"."closes"))
);
