CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"shown_name" text NOT NULL,
	"request_token" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"hidden_at" timestamp with time zone,
	"hidden_by" text,
	"reply" text,
	"replied_at" timestamp with time zone,
	"replied_by" text,
	CONSTRAINT "reviews_booking_id_unique" UNIQUE("booking_id"),
	CONSTRAINT "reviews_user_request_token" UNIQUE("user_id","request_token"),
	CONSTRAINT "reviews_rating_range" CHECK ("reviews"."rating" between 1 and 5),
	CONSTRAINT "reviews_comment_length" CHECK (char_length("reviews"."comment") between 1 and 1000),
	CONSTRAINT "reviews_shown_name_length" CHECK (char_length("reviews"."shown_name") between 1 and 60),
	CONSTRAINT "reviews_reply_length" CHECK (char_length("reviews"."reply") between 1 and 1000),
	CONSTRAINT "reviews_reply_complete" CHECK (("reviews"."reply" is null) = ("reviews"."replied_at" is null))
);
--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_hidden_by_users_id_fk" FOREIGN KEY ("hidden_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_replied_by_users_id_fk" FOREIGN KEY ("replied_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reviews_hidden_created_index" ON "reviews" USING btree ("hidden_at","created_at");