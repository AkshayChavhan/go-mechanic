CREATE TYPE "public"."booking_event_kind" AS ENUM('booked');--> statement-breakpoint
CREATE TYPE "public"."booking_line_price_status" AS ENUM('price', 'on-inspection', 'no-price');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('booked');--> statement-breakpoint
CREATE TABLE "booking_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"kind" "booking_event_kind" NOT NULL,
	"actor_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"service_id" text NOT NULL,
	"service_kind" "service_kind" NOT NULL,
	"name" jsonb NOT NULL,
	"price_status" "booking_line_price_status" NOT NULL,
	"price_paise" integer,
	"position" integer NOT NULL,
	CONSTRAINT "booking_items_price_positive" CHECK ("booking_items"."price_paise" > 0),
	CONSTRAINT "booking_items_price_matches_status" CHECK (("booking_items"."price_status" = 'price') = ("booking_items"."price_paise" is not null))
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"user_id" text NOT NULL,
	"vehicle_id" uuid,
	"vehicle_kind" "vehicle_kind" NOT NULL,
	"model_id" text NOT NULL,
	"fuel" "fuel" NOT NULL,
	"category_id" text NOT NULL,
	"registration_number" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"status" "booking_status" DEFAULT 'booked' NOT NULL,
	"is_estimate" boolean NOT NULL,
	"total_paise" integer,
	"request_token" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_code_unique" UNIQUE("code"),
	CONSTRAINT "bookings_user_request_token" UNIQUE("user_id","request_token"),
	CONSTRAINT "bookings_code_format" CHECK ("bookings"."code" ~ '^[A-HJKMNP-Z2-9]{6}$'),
	CONSTRAINT "bookings_registration_compact" CHECK ("bookings"."registration_number" ~ '^[A-Z0-9]{8,11}$'),
	CONSTRAINT "bookings_total_positive" CHECK ("bookings"."total_paise" > 0)
);
--> statement-breakpoint
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_vehicle_id_customer_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."customer_vehicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_model_id_vehicle_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."vehicle_models"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_category_id_vehicle_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."vehicle_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_events_booking_id_index" ON "booking_events" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "booking_items_booking_id_index" ON "booking_items" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "bookings_starts_at_index" ON "bookings" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "bookings_user_id_starts_at_index" ON "bookings" USING btree ("user_id","starts_at");