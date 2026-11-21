ALTER TYPE "public"."booking_event_kind" ADD VALUE 'status-change';--> statement-breakpoint
ALTER TYPE "public"."booking_event_kind" ADD VALUE 'rescheduled';--> statement-breakpoint
ALTER TYPE "public"."booking_event_kind" ADD VALUE 'assigned';--> statement-breakpoint
ALTER TYPE "public"."booking_status" ADD VALUE 'confirmed';--> statement-breakpoint
ALTER TYPE "public"."booking_status" ADD VALUE 'cancelled';--> statement-breakpoint
ALTER TYPE "public"."booking_status" ADD VALUE 'no-show';--> statement-breakpoint
ALTER TABLE "booking_events" ADD COLUMN "new_status" "booking_status";--> statement-breakpoint
ALTER TABLE "booking_events" ADD COLUMN "reason" text;--> statement-breakpoint
ALTER TABLE "booking_events" ADD COLUMN "moved_from" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "booking_events" ADD COLUMN "moved_to" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "booking_events" ADD COLUMN "mechanic_id" text;--> statement-breakpoint
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_mechanic_id_users_id_fk" FOREIGN KEY ("mechanic_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_staff_change_shape" CHECK ("booking_events"."kind"::text not in ('status-change', 'rescheduled', 'assigned') or ("booking_events"."request_token" is not null and "booking_events"."job_status" is null and "booking_events"."note" is null and "booking_events"."photo_set_id" is null and not "booking_events"."had_photos"));--> statement-breakpoint
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_status_change_has_status" CHECK (("booking_events"."kind"::text = 'status-change') = ("booking_events"."new_status" is not null));--> statement-breakpoint
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_reason_only_on_cancel" CHECK (("booking_events"."reason" is not null) = coalesce("booking_events"."kind"::text = 'status-change' and "booking_events"."new_status"::text = 'cancelled', false));--> statement-breakpoint
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_rescheduled_has_times" CHECK (("booking_events"."kind"::text = 'rescheduled') = ("booking_events"."moved_from" is not null) and ("booking_events"."moved_from" is null) = ("booking_events"."moved_to" is null) and ("booking_events"."moved_from" is null or "booking_events"."moved_from" <> "booking_events"."moved_to"));--> statement-breakpoint
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_mechanic_only_on_assigned" CHECK ("booking_events"."kind"::text = 'assigned' or "booking_events"."mechanic_id" is null);--> statement-breakpoint
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_reason_length" CHECK (char_length("booking_events"."reason") between 3 and 200);