CREATE TYPE "public"."estimate_line_kind" AS ENUM('part', 'labour');--> statement-breakpoint
CREATE TABLE "estimate_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"estimate_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"kind" "estimate_line_kind" NOT NULL,
	"description" text NOT NULL,
	"amount_paise" integer NOT NULL,
	"needed" boolean NOT NULL,
	"service_id" text,
	"copied_from_line_id" uuid,
	"added_by" text NOT NULL,
	"request_token" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "estimate_lines_added_by_request_token" UNIQUE("added_by","request_token"),
	CONSTRAINT "estimate_lines_amount_range" CHECK ("estimate_lines"."amount_paise" between 100 and 100000000),
	CONSTRAINT "estimate_lines_description_length" CHECK (char_length("estimate_lines"."description") between 1 and 120),
	CONSTRAINT "estimate_lines_position_not_negative" CHECK ("estimate_lines"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "estimates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"create_token" uuid NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"sent_at" timestamp with time zone,
	"sent_by" text,
	"send_token" uuid,
	"superseded_at" timestamp with time zone,
	CONSTRAINT "estimates_booking_version" UNIQUE("booking_id","version"),
	CONSTRAINT "estimates_created_by_create_token" UNIQUE("created_by","create_token"),
	CONSTRAINT "estimates_sent_by_send_token" UNIQUE("sent_by","send_token"),
	CONSTRAINT "estimates_send_complete" CHECK (("estimates"."sent_at" is null) = ("estimates"."sent_by" is null) and ("estimates"."sent_at" is null) = ("estimates"."send_token" is null)),
	CONSTRAINT "estimates_superseded_after_send" CHECK ("estimates"."superseded_at" is null or "estimates"."sent_at" is not null),
	CONSTRAINT "estimates_version_positive" CHECK ("estimates"."version" >= 1),
	CONSTRAINT "estimates_revision_not_negative" CHECK ("estimates"."revision" >= 0)
);
--> statement-breakpoint
ALTER TABLE "estimate_lines" ADD CONSTRAINT "estimate_lines_estimate_id_estimates_id_fk" FOREIGN KEY ("estimate_id") REFERENCES "public"."estimates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_lines" ADD CONSTRAINT "estimate_lines_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_lines" ADD CONSTRAINT "estimate_lines_copied_from_line_id_estimate_lines_id_fk" FOREIGN KEY ("copied_from_line_id") REFERENCES "public"."estimate_lines"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_lines" ADD CONSTRAINT "estimate_lines_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_sent_by_users_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "estimate_lines_estimate_id_index" ON "estimate_lines" USING btree ("estimate_id");--> statement-breakpoint
CREATE UNIQUE INDEX "estimates_one_draft_per_booking" ON "estimates" USING btree ("booking_id") WHERE "estimates"."sent_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "estimates_one_current_per_booking" ON "estimates" USING btree ("booking_id") WHERE "estimates"."sent_at" is not null and "estimates"."superseded_at" is null;