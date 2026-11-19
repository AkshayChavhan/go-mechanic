CREATE TABLE "estimate_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"vehicle_id" uuid,
	"vehicle_kind" "vehicle_kind" NOT NULL,
	"model_id" text NOT NULL,
	"fuel" "fuel" NOT NULL,
	"registration_number" text,
	"description" text NOT NULL,
	"photo_set_id" uuid,
	"request_token" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "estimate_requests_photo_set_id_unique" UNIQUE("photo_set_id"),
	CONSTRAINT "estimate_requests_user_request_token" UNIQUE("user_id","request_token"),
	CONSTRAINT "estimate_requests_description_length" CHECK (char_length("estimate_requests"."description") between 10 and 1000),
	CONSTRAINT "estimate_requests_registration_compact" CHECK ("estimate_requests"."registration_number" ~ '^[A-Z0-9]{8,11}$')
);
--> statement-breakpoint
ALTER TABLE "estimate_requests" ADD CONSTRAINT "estimate_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_requests" ADD CONSTRAINT "estimate_requests_vehicle_id_customer_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."customer_vehicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_requests" ADD CONSTRAINT "estimate_requests_model_id_vehicle_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."vehicle_models"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_requests" ADD CONSTRAINT "estimate_requests_photo_set_id_photo_sets_id_fk" FOREIGN KEY ("photo_set_id") REFERENCES "public"."photo_sets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "estimate_requests_user_created_index" ON "estimate_requests" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "estimate_requests_created_index" ON "estimate_requests" USING btree ("created_at");