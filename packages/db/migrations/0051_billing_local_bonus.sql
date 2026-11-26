ALTER TABLE "wallet_entries" DROP CONSTRAINT "wallet_entry_source_check";--> statement-breakpoint
ALTER TABLE "billing_orders" ADD COLUMN "bonus_credits" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "wallet_entries" ADD COLUMN "billing_order_id" uuid;--> statement-breakpoint
ALTER TABLE "wallet_entries" ADD CONSTRAINT "wallet_entries_billing_order_id_billing_orders_id_fk" FOREIGN KEY ("billing_order_id") REFERENCES "public"."billing_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_entries_billing_order_unique" ON "wallet_entries" USING btree ("billing_order_id") WHERE "wallet_entries"."billing_order_id" is not null;--> statement-breakpoint
ALTER TABLE "billing_orders" ADD CONSTRAINT "billing_orders_bonus_credits" CHECK ("billing_orders"."bonus_credits" >= 0);--> statement-breakpoint
ALTER TABLE "wallet_entries" ADD CONSTRAINT "wallet_entry_source_check" CHECK (("wallet_entries"."billing_order_id" is null and (
        ("wallet_entries"."kind" in ('consume','refund') and "wallet_entries"."job_id" is not null and "wallet_entries"."item_id" is not null and "wallet_entries"."recharge_id" is null)
        or ("wallet_entries"."kind" in ('consume','refund') and "wallet_entries"."event_key" like 'prompt-optimize:%' and "wallet_entries"."job_id" is null and "wallet_entries"."item_id" is null and "wallet_entries"."recharge_id" is null)
        or ("wallet_entries"."kind" = 'recharge' and "wallet_entries"."recharge_id" is not null and "wallet_entries"."job_id" is null and "wallet_entries"."item_id" is null)
        or ("wallet_entries"."kind" in ('opening','checkin') and "wallet_entries"."job_id" is null and "wallet_entries"."item_id" is null and "wallet_entries"."recharge_id" is null)
      )) or ("wallet_entries"."billing_order_id" is not null and "wallet_entries"."kind" = 'recharge' and "wallet_entries"."recharge_id" is null and "wallet_entries"."job_id" is null and "wallet_entries"."item_id" is null));
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.validate_wallet_entry_scope() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE org uuid;
BEGIN
 SELECT organization_id INTO org FROM organization_wallets WHERE id=NEW.wallet_id;
 -- 支付回调使用下单时确认的工作区，成员退出后仍能在原钱包完成结算。
 IF NEW.billing_order_id IS NOT NULL THEN
  IF NOT EXISTS (
    SELECT 1 FROM public.billing_orders b
    WHERE b.id=NEW.billing_order_id AND b.organization_id=org AND b.user_id=NEW.user_id
      AND b.paid_at IS NOT NULL AND b.bonus_credits=NEW.amount
      AND NEW.event_key='billing-bonus:'||b.id
  ) THEN RAISE EXCEPTION 'WALLET_RECHARGE_MISMATCH'; END IF;
  RETURN NEW;
 END IF;
 IF NEW.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM organization_members WHERE organization_id=org AND user_id=NEW.user_id)
 THEN RAISE EXCEPTION 'WALLET_MEMBER_MISMATCH'; END IF;
 IF NEW.kind IN ('consume','refund') AND NEW.job_id IS NULL AND NEW.item_id IS NULL THEN
  IF NOT EXISTS (
    SELECT 1 FROM public.prompt_optimizations p
    WHERE p.organization_id=org AND p.user_id=NEW.user_id AND
      ((NEW.kind='consume' AND NEW.amount=-1 AND p.status='running'
        AND NEW.event_key='prompt-optimize:'||p.user_id||':'||p.key)
      OR (NEW.kind='refund' AND NEW.amount=1 AND p.status='failed'
        AND NEW.event_key='prompt-optimize:'||p.user_id||':'||p.key||':refund'))
  ) THEN RAISE EXCEPTION 'WALLET_TASK_MISMATCH'; END IF;
 ELSIF NEW.kind IN ('consume','refund') AND NOT EXISTS (
  SELECT 1 FROM generation_jobs j JOIN generation_job_items i ON i.job_id=j.id
  WHERE j.id=NEW.job_id AND i.id=NEW.item_id AND j.organization_id=org AND j.user_id=NEW.user_id)
 THEN RAISE EXCEPTION 'WALLET_TASK_MISMATCH'; END IF;
 IF NEW.kind='recharge' AND NOT EXISTS (SELECT 1 FROM recharge_orders r WHERE r.id=NEW.recharge_id AND r.wallet_id=NEW.wallet_id AND r.user_id=NEW.user_id AND r.status='paid' AND r.credits=NEW.amount)
 THEN RAISE EXCEPTION 'WALLET_RECHARGE_MISMATCH'; END IF;
 RETURN NEW;
END $$;
