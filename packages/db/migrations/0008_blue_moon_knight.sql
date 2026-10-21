CREATE TABLE "organization_wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_wallets_organization_id_unique" UNIQUE("organization_id"),
	CONSTRAINT "wallet_balance_check" CHECK ("organization_wallets"."balance" >= 0)
);
--> statement-breakpoint
CREATE TABLE "recharge_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"credits" integer NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" text DEFAULT 'CNY' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"channel" text NOT NULL,
	"provider_transaction_id" text,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recharge_wallet_key_unique" UNIQUE("wallet_id","idempotency_key"),
	CONSTRAINT "recharge_provider_unique" UNIQUE("channel","provider_transaction_id"),
	CONSTRAINT "recharge_amount_check" CHECK ("recharge_orders"."credits" > 0 and "recharge_orders"."amount_minor" > 0 and "recharge_orders"."currency" = 'CNY'),
	CONSTRAINT "recharge_status_check" CHECK ("recharge_orders"."status" in ('pending','paid','closed')),
	CONSTRAINT "recharge_paid_check" CHECK (("recharge_orders"."status" = 'paid') = ("recharge_orders"."paid_at" is not null and "recharge_orders"."provider_transaction_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "wallet_checkins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"business_date" text NOT NULL,
	"rule_version" text NOT NULL,
	"credits" integer NOT NULL,
	"ledger_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallet_checkins_ledger_id_unique" UNIQUE("ledger_id"),
	CONSTRAINT "wallet_checkin_day_unique" UNIQUE("wallet_id","business_date"),
	CONSTRAINT "wallet_checkin_credits_check" CHECK ("wallet_checkins"."credits" > 0),
	CONSTRAINT "wallet_checkin_date_check" CHECK ("wallet_checkins"."business_date" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
);
--> statement-breakpoint
CREATE TABLE "wallet_entries" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "wallet_entries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"wallet_id" uuid NOT NULL,
	"user_id" uuid,
	"event_key" text NOT NULL,
	"kind" text NOT NULL,
	"amount" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"job_id" uuid,
	"item_id" uuid,
	"recharge_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallet_event_unique" UNIQUE("wallet_id","event_key"),
	CONSTRAINT "wallet_entry_amount_check" CHECK ("wallet_entries"."balance_after" >= 0 and (("wallet_entries"."kind" = 'consume' and "wallet_entries"."amount" < 0) or ("wallet_entries"."kind" in ('opening','recharge','refund','checkin') and "wallet_entries"."amount" > 0))),
	CONSTRAINT "wallet_entry_source_check" CHECK (("wallet_entries"."kind" in ('consume','refund') and "wallet_entries"."job_id" is not null and "wallet_entries"."item_id" is not null and "wallet_entries"."recharge_id" is null) or ("wallet_entries"."kind" = 'recharge' and "wallet_entries"."recharge_id" is not null and "wallet_entries"."job_id" is null and "wallet_entries"."item_id" is null) or ("wallet_entries"."kind" in ('opening','checkin') and "wallet_entries"."job_id" is null and "wallet_entries"."item_id" is null and "wallet_entries"."recharge_id" is null))
);
--> statement-breakpoint
ALTER TABLE "organization_wallets" ADD CONSTRAINT "organization_wallets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recharge_orders" ADD CONSTRAINT "recharge_orders_wallet_id_organization_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."organization_wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recharge_orders" ADD CONSTRAINT "recharge_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_checkins" ADD CONSTRAINT "wallet_checkins_wallet_id_organization_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."organization_wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_checkins" ADD CONSTRAINT "wallet_checkins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_checkins" ADD CONSTRAINT "wallet_checkins_ledger_id_wallet_entries_id_fk" FOREIGN KEY ("ledger_id") REFERENCES "public"."wallet_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_entries" ADD CONSTRAINT "wallet_entries_wallet_id_organization_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."organization_wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_entries" ADD CONSTRAINT "wallet_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_entries" ADD CONSTRAINT "wallet_entries_job_id_image_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."image_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_entries" ADD CONSTRAINT "wallet_entries_item_id_image_job_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."image_job_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_entries" ADD CONSTRAINT "wallet_entries_recharge_id_recharge_orders_id_fk" FOREIGN KEY ("recharge_id") REFERENCES "public"."recharge_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recharge_user_idx" ON "recharge_orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "recharge_wallet_created_idx" ON "recharge_orders" USING btree ("wallet_id","created_at","id");--> statement-breakpoint
CREATE INDEX "wallet_checkin_user_idx" ON "wallet_checkins" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "wallet_entries_user_idx" ON "wallet_entries" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "wallet_entries_cursor_idx" ON "wallet_entries" USING btree ("wallet_id","id");--> statement-breakpoint
CREATE INDEX "wallet_entries_job_idx" ON "wallet_entries" USING btree ("job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_entries_item_kind_unique" ON "wallet_entries" USING btree ("item_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_entries_recharge_unique" ON "wallet_entries" USING btree ("recharge_id");--> statement-breakpoint
-- Preserve the enterprise balance exactly once; members share this single wallet.
INSERT INTO organization_wallets (organization_id,balance)
SELECT id,available_credits FROM organizations;
--> statement-breakpoint
INSERT INTO wallet_entries (wallet_id,event_key,kind,amount,balance_after)
SELECT id,'migration-opening','opening',balance,balance FROM organization_wallets WHERE balance>0;
--> statement-breakpoint
-- Keep historical ledger and organization balance as migration evidence, never as spendable balances.
CREATE FUNCTION prevent_wallet_entry_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'WALLET_LEDGER_IMMUTABLE'; END $$;
--> statement-breakpoint
CREATE TRIGGER wallet_entries_immutable BEFORE UPDATE OR DELETE ON wallet_entries
FOR EACH ROW EXECUTE FUNCTION prevent_wallet_entry_mutation();
--> statement-breakpoint
CREATE FUNCTION validate_wallet_entry_scope() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE org uuid;
BEGIN
 SELECT organization_id INTO org FROM organization_wallets WHERE id=NEW.wallet_id;
 IF NEW.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM organization_members WHERE organization_id=org AND user_id=NEW.user_id)
 THEN RAISE EXCEPTION 'WALLET_MEMBER_MISMATCH'; END IF;
 IF NEW.kind IN ('consume','refund') AND NOT EXISTS (
  SELECT 1 FROM image_jobs j JOIN image_job_items i ON i.job_id=j.id
  WHERE j.id=NEW.job_id AND i.id=NEW.item_id AND j.organization_id=org AND j.user_id=NEW.user_id)
 THEN RAISE EXCEPTION 'WALLET_TASK_MISMATCH'; END IF;
 IF NEW.kind='recharge' AND NOT EXISTS (SELECT 1 FROM recharge_orders r WHERE r.id=NEW.recharge_id AND r.wallet_id=NEW.wallet_id AND r.user_id=NEW.user_id AND r.status='paid' AND r.credits=NEW.amount)
 THEN RAISE EXCEPTION 'WALLET_RECHARGE_MISMATCH'; END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER wallet_entries_scope BEFORE INSERT ON wallet_entries
FOR EACH ROW EXECUTE FUNCTION validate_wallet_entry_scope();
