CREATE TABLE "pickup_areas" (
	"postal_code" text PRIMARY KEY NOT NULL,
	"fee_paise" integer NOT NULL,
	"listed" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pickup_areas_postal_code_format" CHECK ("pickup_areas"."postal_code" ~ '^[1-9][0-9]{5}$'),
	CONSTRAINT "pickup_areas_fee_not_negative" CHECK ("pickup_areas"."fee_paise" >= 0)
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "pickup_address" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "pickup_postal_code" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "pickup_fee_paise" integer;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_pickup_complete" CHECK (("bookings"."pickup_address" is null) = ("bookings"."pickup_postal_code" is null) and ("bookings"."pickup_address" is null) = ("bookings"."pickup_fee_paise" is null));--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_pickup_postal_code_format" CHECK ("bookings"."pickup_postal_code" ~ '^[1-9][0-9]{5}$');--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_pickup_fee_not_negative" CHECK ("bookings"."pickup_fee_paise" >= 0);