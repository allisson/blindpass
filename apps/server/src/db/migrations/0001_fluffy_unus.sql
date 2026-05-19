CREATE TABLE "biometric_credentials" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"credential_id" "bytea" NOT NULL,
	"label" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "biometric_credentials" ADD CONSTRAINT "biometric_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "biometric_credentials_user_id_idx" ON "biometric_credentials" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "biometric_credentials_user_credential_unique" ON "biometric_credentials" USING btree ("user_id","credential_id");