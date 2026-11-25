CREATE TABLE "billing_credit_entries" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "billing_credit_entries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"provider" text NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"amount" integer NOT NULL,
	"item_id" uuid,
	"order_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_entries_order" UNIQUE("order_id"),
	CONSTRAINT "billing_entries_item_kind" UNIQUE("item_id","kind"),
	CONSTRAINT "billing_entries_kind_amount" CHECK (("billing_credit_entries"."kind"='consume' and "billing_credit_entries"."amount"<0 and "billing_credit_entries"."item_id" is not null and "billing_credit_entries"."order_id" is null)
      or ("billing_credit_entries"."kind"='refund' and "billing_credit_entries"."amount">0 and "billing_credit_entries"."item_id" is not null and "billing_credit_entries"."order_id" is null)
      or ("billing_credit_entries"."kind"='recharge' and "billing_credit_entries"."amount">0 and "billing_credit_entries"."order_id" is not null and "billing_credit_entries"."item_id" is null))
);
--> statement-breakpoint
ALTER TABLE "billing_credit_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "billing_customers" (
	"provider" text NOT NULL,
	"user_id" uuid NOT NULL,
	"customer_id" text NOT NULL,
	"account_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_customers_provider_user_id_pk" PRIMARY KEY("provider","user_id"),
	CONSTRAINT "billing_customers_remote_customer" UNIQUE("provider","customer_id"),
	CONSTRAINT "billing_customers_remote_account" UNIQUE("provider","account_id")
);
--> statement-breakpoint
ALTER TABLE "billing_customers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "billing_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"provider" text NOT NULL,
	"product_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"checkout_id" text,
	"checkout_url" text,
	"transaction_id" text,
	"amount_minor" integer NOT NULL,
	"credits" integer NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_orders_request" UNIQUE("organization_id","user_id","idempotency_key"),
	CONSTRAINT "billing_orders_checkout" UNIQUE("provider","checkout_id"),
	CONSTRAINT "billing_orders_transaction" UNIQUE("provider","transaction_id"),
	CONSTRAINT "billing_orders_value" CHECK ("billing_orders"."amount_minor" > 0 and "billing_orders"."credits" > 0)
);
--> statement-breakpoint
ALTER TABLE "billing_orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "generation_credit_charges" (
	"item_id" uuid PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" text NOT NULL,
	"approval" text NOT NULL,
	"previous_item_id" uuid,
	"amount" integer NOT NULL,
	"state" text DEFAULT 'debit' NOT NULL,
	"transaction_id" text,
	"lease_token" uuid,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "generation_credit_provider_transaction" UNIQUE("provider","transaction_id"),
	CONSTRAINT "generation_credit_provider_approval" UNIQUE("provider","approval"),
	CONSTRAINT "generation_credit_amount" CHECK ("generation_credit_charges"."amount" > 0),
	CONSTRAINT "generation_credit_state" CHECK ("generation_credit_charges"."state" in ('debit','paid','declined','reverse','reversed')),
	CONSTRAINT "generation_credit_transaction_state" CHECK (("generation_credit_charges"."transaction_id" is not null) = ("generation_credit_charges"."state" in ('paid','reverse','reversed')))
);
--> statement-breakpoint
ALTER TABLE "generation_credit_charges" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "billing_credit_entries" ADD CONSTRAINT "billing_credit_entries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_credit_entries" ADD CONSTRAINT "billing_credit_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_credit_entries" ADD CONSTRAINT "billing_credit_entries_item_id_generation_job_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."generation_job_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_credit_entries" ADD CONSTRAINT "billing_credit_entries_order_id_billing_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."billing_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_customers" ADD CONSTRAINT "billing_customers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_orders" ADD CONSTRAINT "billing_orders_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_orders" ADD CONSTRAINT "billing_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_credit_charges" ADD CONSTRAINT "generation_credit_charges_item_id_generation_job_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."generation_job_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_credit_charges" ADD CONSTRAINT "generation_credit_charges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_credit_charges" ADD CONSTRAINT "generation_credit_charges_previous_item_id_generation_job_items_id_fk" FOREIGN KEY ("previous_item_id") REFERENCES "public"."generation_job_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "billing_entries_owner_cursor" ON "billing_credit_entries" USING btree ("provider","organization_id","user_id","id");--> statement-breakpoint
CREATE INDEX "billing_entries_user" ON "billing_credit_entries" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "billing_entries_org" ON "billing_credit_entries" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "billing_orders_owner" ON "billing_orders" USING btree ("organization_id","user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "billing_orders_user" ON "billing_orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "generation_credit_user" ON "generation_credit_charges" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "generation_credit_previous_item" ON "generation_credit_charges" USING btree ("previous_item_id");--> statement-breakpoint
CREATE INDEX "generation_credit_next_attempt" ON "generation_credit_charges" USING btree ("provider","next_attempt_at") WHERE "generation_credit_charges"."state" in ('debit','reverse');
--> statement-breakpoint
-- 计费数据仅供服务端访问，排除 Supabase 默认授予的前端权限。
DO $$
DECLARE frontend_role text;
BEGIN
  FOREACH frontend_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=frontend_role) THEN
      EXECUTE format('REVOKE ALL ON billing_customers,billing_orders,billing_credit_entries,generation_credit_charges FROM %I', frontend_role);
      EXECUTE format('REVOKE ALL ON SEQUENCE billing_credit_entries_id_seq FROM %I', frontend_role);
    END IF;
  END LOOP;
END $$;
