CREATE TABLE "pending_totp_enrollments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"encrypted_secret" "bytea" NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"admin_user_id" uuid NOT NULL,
	"registrations_enabled" boolean DEFAULT true NOT NULL,
	"default_owner_quota" integer DEFAULT 10 NOT NULL,
	"default_vault_item_quota" integer DEFAULT 1000 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recovery_tokens" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_agent" varchar(512),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "user_totp_secrets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"encrypted_secret" "bytea" NOT NULL,
	"enabled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_rotated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"username" varchar(32) NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"kek_salt" "bytea",
	"encrypted_master_key_ciphertext" "bytea",
	"encrypted_master_key_nonce" "bytea",
	"encrypted_master_key_for_recovery_ciphertext" "bytea",
	"encrypted_master_key_for_recovery_nonce" "bytea",
	"encrypted_private_key_ciphertext" "bytea",
	"encrypted_private_key_nonce" "bytea",
	"encrypted_recovery_key_ciphertext" "bytea",
	"encrypted_recovery_key_nonce" "bytea",
	"public_key" "bytea",
	"recovery_verifier_hash" varchar(255),
	"recovery_verifier_salt" "bytea",
	"totp_last_used_counter" bigint,
	"revoked_at" timestamp with time zone,
	"owner_quota_override" integer,
	"vault_item_quota_override" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vault_folders" (
	"id" uuid PRIMARY KEY NOT NULL,
	"vault_id" uuid NOT NULL,
	"encrypted_name_ciphertext" "bytea" NOT NULL,
	"encrypted_name_nonce" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vault_item_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"item_id" uuid NOT NULL,
	"version_num" integer NOT NULL,
	"encrypted_data_ciphertext" "bytea" NOT NULL,
	"encrypted_data_nonce" "bytea" NOT NULL,
	"encrypted_item_key_ciphertext" "bytea" NOT NULL,
	"encrypted_item_key_nonce" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vault_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"vault_id" uuid NOT NULL,
	"folder_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "vault_shares" (
	"id" uuid PRIMARY KEY NOT NULL,
	"vault_id" uuid NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"receiver_user_id" uuid NOT NULL,
	"sealed_vault_key" "bytea" NOT NULL,
	"role" varchar(20) DEFAULT 'viewer' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vaults" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"encrypted_vault_key_ciphertext" "bytea" NOT NULL,
	"encrypted_vault_key_nonce" "bytea" NOT NULL,
	"encrypted_vault_data_ciphertext" "bytea" NOT NULL,
	"encrypted_vault_data_nonce" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pending_totp_enrollments" ADD CONSTRAINT "pending_totp_enrollments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_settings" ADD CONSTRAINT "project_settings_admin_user_id_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recovery_tokens" ADD CONSTRAINT "recovery_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_totp_secrets" ADD CONSTRAINT "user_totp_secrets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_folders" ADD CONSTRAINT "vault_folders_vault_id_vaults_id_fk" FOREIGN KEY ("vault_id") REFERENCES "public"."vaults"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_item_versions" ADD CONSTRAINT "vault_item_versions_item_id_vault_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."vault_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_items" ADD CONSTRAINT "vault_items_vault_id_vaults_id_fk" FOREIGN KEY ("vault_id") REFERENCES "public"."vaults"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_items" ADD CONSTRAINT "vault_items_folder_id_vault_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."vault_folders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_shares" ADD CONSTRAINT "vault_shares_vault_id_vaults_id_fk" FOREIGN KEY ("vault_id") REFERENCES "public"."vaults"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_shares" ADD CONSTRAINT "vault_shares_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_shares" ADD CONSTRAINT "vault_shares_receiver_user_id_users_id_fk" FOREIGN KEY ("receiver_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vaults" ADD CONSTRAINT "vaults_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pending_totp_enrollments_user_id_expires_at_idx" ON "pending_totp_enrollments" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE INDEX "recovery_tokens_user_id_expires_at_idx" ON "recovery_tokens" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_totp_secrets_user_id_unique" ON "user_totp_secrets" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_unique" ON "users" USING btree ("username");--> statement-breakpoint
CREATE INDEX "vault_folders_vault_id_idx" ON "vault_folders" USING btree ("vault_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vault_item_versions_item_version_unique" ON "vault_item_versions" USING btree ("item_id","version_num");--> statement-breakpoint
CREATE INDEX "vault_item_versions_item_id_idx" ON "vault_item_versions" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "vault_items_vault_id_deleted_at_id_idx" ON "vault_items" USING btree ("vault_id","deleted_at","id");--> statement-breakpoint
CREATE INDEX "vault_items_vault_id_updated_at_idx" ON "vault_items" USING btree ("vault_id","updated_at");--> statement-breakpoint
CREATE INDEX "vault_items_folder_id_idx" ON "vault_items" USING btree ("folder_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vault_shares_vault_receiver_unique" ON "vault_shares" USING btree ("vault_id","receiver_user_id");--> statement-breakpoint
CREATE INDEX "vault_shares_vault_id_idx" ON "vault_shares" USING btree ("vault_id");--> statement-breakpoint
CREATE INDEX "vault_shares_receiver_user_id_idx" ON "vault_shares" USING btree ("receiver_user_id");--> statement-breakpoint
CREATE INDEX "vaults_user_id_idx" ON "vaults" USING btree ("user_id");