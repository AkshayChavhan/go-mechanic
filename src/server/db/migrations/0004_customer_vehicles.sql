CREATE TABLE "customer_vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"model_id" text NOT NULL,
	"fuel" "fuel" NOT NULL,
	"registration_number" text NOT NULL,
	"puc_expires_on" date,
	"insurance_expires_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_vehicles_user_registration" UNIQUE("user_id","registration_number"),
	CONSTRAINT "customer_vehicles_registration_compact" CHECK ("customer_vehicles"."registration_number" ~ '^[A-Z0-9]{8,11}$')
);
--> statement-breakpoint
ALTER TABLE "customer_vehicles" ADD CONSTRAINT "customer_vehicles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_vehicles" ADD CONSTRAINT "customer_vehicles_model_id_vehicle_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."vehicle_models"("id") ON DELETE restrict ON UPDATE no action;