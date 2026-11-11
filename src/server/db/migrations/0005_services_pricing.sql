CREATE TYPE "public"."service_kind" AS ENUM('service', 'package');--> statement-breakpoint
CREATE TABLE "service_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_id" text NOT NULL,
	"category_id" text NOT NULL,
	"fuel" "fuel",
	"price_paise" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_prices_service_category_fuel" UNIQUE NULLS NOT DISTINCT("service_id","category_id","fuel"),
	CONSTRAINT "service_prices_positive" CHECK ("service_prices"."price_paise" > 0)
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" "service_kind" NOT NULL,
	"name" jsonb NOT NULL,
	"summary" jsonb NOT NULL,
	"vehicle_kinds" "vehicle_kind"[] NOT NULL,
	"fuels" "fuel"[] NOT NULL,
	"included" jsonb NOT NULL,
	"signs" jsonb NOT NULL,
	"priced_after_inspection" boolean DEFAULT false NOT NULL,
	"position" integer NOT NULL,
	"listed" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "services_has_vehicle_kinds" CHECK (cardinality("services"."vehicle_kinds") > 0),
	CONSTRAINT "services_package_one_kind" CHECK ("services"."kind" <> 'package' or cardinality("services"."vehicle_kinds") = 1),
	CONSTRAINT "services_has_fuels" CHECK (cardinality("services"."fuels") > 0),
	CONSTRAINT "services_english_name" CHECK (coalesce(btrim("services"."name" ->> 'en'), '') <> ''),
	CONSTRAINT "services_english_summary" CHECK (coalesce(btrim("services"."summary" ->> 'en'), '') <> ''),
	CONSTRAINT "services_included_list" CHECK (jsonb_typeof("services"."included") = 'array' and "services"."included" <> '[]'::jsonb),
	CONSTRAINT "services_signs_list" CHECK (jsonb_typeof("services"."signs") = 'array')
);
--> statement-breakpoint
ALTER TABLE "service_prices" ADD CONSTRAINT "service_prices_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_prices" ADD CONSTRAINT "service_prices_category_id_vehicle_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."vehicle_categories"("id") ON DELETE restrict ON UPDATE no action;