-- 第三方身份独立于企业凭据，既有会话保留原账号关系。
SET LOCAL lock_timeout = '3s';--> statement-breakpoint
CREATE TABLE "social_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supabase_user_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" text,
	"credential_version" uuid DEFAULT gen_random_uuid() NOT NULL,
	"disabled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "social_accounts_supabase_user_id_unique" UNIQUE("supabase_user_id"),
	CONSTRAINT "social_accounts_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "enterprise_sessions" ALTER COLUMN "account_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "enterprise_sessions" ADD COLUMN "social_account_id" uuid;--> statement-breakpoint
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_account_member_fk" FOREIGN KEY ("organization_id","user_id") REFERENCES "public"."organization_members"("organization_id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enterprise_sessions" ADD CONSTRAINT "enterprise_sessions_social_account_id_social_accounts_id_fk" FOREIGN KEY ("social_account_id") REFERENCES "public"."social_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "enterprise_sessions_social_account_idx" ON "enterprise_sessions" USING btree ("social_account_id");--> statement-breakpoint
ALTER TABLE "enterprise_sessions" ADD CONSTRAINT "enterprise_sessions_one_account" CHECK (("enterprise_sessions"."account_id" is null) <> ("enterprise_sessions"."social_account_id" is null));--> statement-breakpoint
ALTER TABLE "social_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "social_accounts" FROM PUBLIC;--> statement-breakpoint
DO $$
DECLARE frontend_role text;
BEGIN
  FOREACH frontend_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = frontend_role) THEN
      EXECUTE format('REVOKE ALL ON TABLE public.social_accounts FROM %I', frontend_role);
    END IF;
  END LOOP;
END $$;
