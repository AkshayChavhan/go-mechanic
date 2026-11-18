CREATE TYPE "public"."photo_status" AS ENUM('pending', 'stored');--> statement-breakpoint
CREATE TABLE "photo_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"set_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"status" "photo_status" DEFAULT 'pending' NOT NULL,
	"bytes" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"stored_at" timestamp with time zone,
	CONSTRAINT "photos_storage_key_unique" UNIQUE("storage_key"),
	CONSTRAINT "photos_bytes_limit" CHECK ("photos"."bytes" is null or ("photos"."bytes" > 0 and "photos"."bytes" <= 2097152)),
	CONSTRAINT "photos_stored_complete" CHECK ("photos"."status" <> 'stored' or ("photos"."bytes" is not null and "photos"."stored_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "photo_sets" ADD CONSTRAINT "photo_sets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_set_id_photo_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."photo_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "photo_sets_user_created_index" ON "photo_sets" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "photos_set_index" ON "photos" USING btree ("set_id");