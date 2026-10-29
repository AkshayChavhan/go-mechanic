CREATE TYPE "public"."fuel" AS ENUM('petrol', 'diesel', 'cng', 'electric');--> statement-breakpoint
CREATE TYPE "public"."vehicle_kind" AS ENUM('car', 'two-wheeler');--> statement-breakpoint
CREATE TABLE "vehicle_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" "vehicle_kind" NOT NULL,
	"name" jsonb NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vehicle_categories_id_kind" UNIQUE("id","kind"),
	CONSTRAINT "vehicle_categories_english_name" CHECK (coalesce(btrim("vehicle_categories"."name" ->> 'en'), '') <> '')
);
--> statement-breakpoint
CREATE TABLE "vehicle_makes" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" "vehicle_kind" NOT NULL,
	"name" jsonb NOT NULL,
	"position" integer NOT NULL,
	"listed" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vehicle_makes_id_kind" UNIQUE("id","kind"),
	CONSTRAINT "vehicle_makes_english_name" CHECK (coalesce(btrim("vehicle_makes"."name" ->> 'en'), '') <> '')
);
--> statement-breakpoint
CREATE TABLE "vehicle_models" (
	"id" text PRIMARY KEY NOT NULL,
	"make_id" text NOT NULL,
	"category_id" text NOT NULL,
	"kind" "vehicle_kind" NOT NULL,
	"name" jsonb NOT NULL,
	"fuels" "fuel"[] NOT NULL,
	"position" integer NOT NULL,
	"listed" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vehicle_models_has_fuels" CHECK (cardinality("vehicle_models"."fuels") > 0),
	CONSTRAINT "vehicle_models_english_name" CHECK (coalesce(btrim("vehicle_models"."name" ->> 'en'), '') <> '')
);
--> statement-breakpoint
ALTER TABLE "vehicle_models" ADD CONSTRAINT "vehicle_models_make_kind_fkey" FOREIGN KEY ("make_id","kind") REFERENCES "public"."vehicle_makes"("id","kind") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_models" ADD CONSTRAINT "vehicle_models_category_kind_fkey" FOREIGN KEY ("category_id","kind") REFERENCES "public"."vehicle_categories"("id","kind") ON DELETE restrict ON UPDATE no action;