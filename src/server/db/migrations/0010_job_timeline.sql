CREATE TYPE "public"."job_status" AS ENUM('vehicle-received', 'inspection', 'awaiting-approval', 'in-service', 'ready', 'completed');--> statement-breakpoint
ALTER TYPE "public"."booking_event_kind" ADD VALUE 'job-update';--> statement-breakpoint
ALTER TABLE "booking_events" ADD COLUMN "job_status" "job_status";--> statement-breakpoint
ALTER TABLE "booking_events" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "booking_events" ADD COLUMN "photo_set_id" uuid;--> statement-breakpoint
ALTER TABLE "booking_events" ADD COLUMN "had_photos" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "booking_events" ADD COLUMN "request_token" uuid;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "job_status" "job_status";--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "assigned_mechanic_id" text;--> statement-breakpoint
ALTER TABLE "photo_sets" ADD COLUMN "booking_id" uuid;--> statement-breakpoint
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_photo_set_id_photo_sets_id_fk" FOREIGN KEY ("photo_set_id") REFERENCES "public"."photo_sets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_assigned_mechanic_id_users_id_fk" FOREIGN KEY ("assigned_mechanic_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_sets" ADD CONSTRAINT "photo_sets_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookings_assigned_mechanic_index" ON "bookings" USING btree ("assigned_mechanic_id");--> statement-breakpoint
CREATE INDEX "photo_sets_booking_index" ON "photo_sets" USING btree ("booking_id");--> statement-breakpoint
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_photo_set_id_unique" UNIQUE("photo_set_id");--> statement-breakpoint
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_actor_request_token" UNIQUE("actor_user_id","request_token");--> statement-breakpoint
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_job_update_has_content" CHECK ("booking_events"."kind"::text <> 'job-update' or "booking_events"."job_status" is not null or "booking_events"."note" is not null or "booking_events"."had_photos");--> statement-breakpoint
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_booked_is_plain" CHECK ("booking_events"."kind"::text <> 'booked' or ("booking_events"."job_status" is null and "booking_events"."note" is null and "booking_events"."photo_set_id" is null and not "booking_events"."had_photos" and "booking_events"."request_token" is null));--> statement-breakpoint
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_photos_flag" CHECK ("booking_events"."photo_set_id" is null or "booking_events"."had_photos");--> statement-breakpoint
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_note_length" CHECK (char_length("booking_events"."note") between 1 and 1000);