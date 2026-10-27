CREATE TABLE "admin_login_limits" (
	"subject_hash" text PRIMARY KEY NOT NULL,
	"attempts" integer DEFAULT 1 NOT NULL,
	"reset_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_login_limits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "admin_sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"administrator_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account" text NOT NULL,
	"password_hash" text NOT NULL,
	"is_super_admin" integer DEFAULT 0 NOT NULL,
	"disabled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_users_account_unique" UNIQUE("account"),
	CONSTRAINT "admin_users_super_admin_check" CHECK ("admin_users"."is_super_admin" in (0,1))
);
--> statement-breakpoint
ALTER TABLE "admin_users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "model_audit_events" ALTER COLUMN "actor_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "model_audit_events" ADD COLUMN "administrator_id" uuid;--> statement-breakpoint
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_administrator_id_admin_users_id_fk" FOREIGN KEY ("administrator_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_login_limits_reset_idx" ON "admin_login_limits" USING btree ("reset_at");--> statement-breakpoint
CREATE INDEX "admin_sessions_user_idx" ON "admin_sessions" USING btree ("administrator_id");--> statement-breakpoint
CREATE INDEX "admin_sessions_expiry_idx" ON "admin_sessions" USING btree ("expires_at");--> statement-breakpoint
ALTER TABLE "model_audit_events" ADD CONSTRAINT "model_audit_events_administrator_id_admin_users_id_fk" FOREIGN KEY ("administrator_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;