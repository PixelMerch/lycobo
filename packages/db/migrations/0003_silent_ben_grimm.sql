CREATE TABLE "enterprise_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account" text NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"password_hash" text NOT NULL,
	"credential_version" uuid DEFAULT gen_random_uuid() NOT NULL,
	"disabled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enterprise_accounts_account_unique" UNIQUE("account"),
	CONSTRAINT "enterprise_account_normalized" CHECK ("enterprise_accounts"."account" = lower(trim("enterprise_accounts"."account")) and length("enterprise_accounts"."account") between 3 and 128)
);
--> statement-breakpoint
CREATE TABLE "enterprise_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"credential_version" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"attempts" integer NOT NULL,
	CONSTRAINT "login_rate_limits_attempts_check" CHECK ("login_rate_limits"."attempts" > 0)
);
--> statement-breakpoint
ALTER TABLE "enterprise_accounts" ADD CONSTRAINT "enterprise_account_member_fk" FOREIGN KEY ("organization_id","user_id") REFERENCES "public"."organization_members"("organization_id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enterprise_sessions" ADD CONSTRAINT "enterprise_sessions_account_id_enterprise_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."enterprise_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "enterprise_accounts_member_idx" ON "enterprise_accounts" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "enterprise_sessions_account_idx" ON "enterprise_sessions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "enterprise_sessions_expiry_idx" ON "enterprise_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "login_rate_limits_window_idx" ON "login_rate_limits" USING btree ("window_start");