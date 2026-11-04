CREATE TABLE IF NOT EXISTS public.prompt_optimizations (
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"key" uuid NOT NULL,
	"input_hash" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"result" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prompt_optimizations_organization_id_user_id_key_pk" PRIMARY KEY("organization_id","user_id","key"),
	CONSTRAINT "prompt_optimizations_result_check" CHECK (("prompt_optimizations"."status" = 'ready' and "prompt_optimizations"."result" is not null and char_length("prompt_optimizations"."result") between 1 and 5000) or ("prompt_optimizations"."status" in ('running','failed') and "prompt_optimizations"."result" is null))
);
ALTER TABLE "wallet_entries" DROP CONSTRAINT "wallet_entry_source_check";
ALTER TABLE "wallet_entries" ADD CONSTRAINT "wallet_entry_source_check" CHECK (("wallet_entries"."kind" in ('consume','refund') and "wallet_entries"."job_id" is not null and "wallet_entries"."item_id" is not null and "wallet_entries"."recharge_id" is null) or ("wallet_entries"."kind" in ('consume','refund') and "wallet_entries"."event_key" like 'prompt-optimize:%' and "wallet_entries"."job_id" is null and "wallet_entries"."item_id" is null and "wallet_entries"."recharge_id" is null) or ("wallet_entries"."kind" = 'recharge' and "wallet_entries"."recharge_id" is not null and "wallet_entries"."job_id" is null and "wallet_entries"."item_id" is null) or ("wallet_entries"."kind" in ('opening','checkin') and "wallet_entries"."job_id" is null and "wallet_entries"."item_id" is null and "wallet_entries"."recharge_id" is null));
DO $$ BEGIN ALTER TABLE "prompt_optimizations" ADD CONSTRAINT "prompt_optimizations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "prompt_optimizations" ADD CONSTRAINT "prompt_optimizations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "prompt_optimizations_scope_created_idx" ON "prompt_optimizations" USING btree ("organization_id","user_id","created_at");
CREATE OR REPLACE FUNCTION public.validate_wallet_entry_scope() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE org uuid;
BEGIN
 SELECT organization_id INTO org FROM organization_wallets WHERE id=NEW.wallet_id;
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
CREATE OR REPLACE FUNCTION public.lycobo_prompt_optimization(p_operation text, p_args jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  org uuid := (p_args->>'organizationId')::uuid;
  actor uuid := (p_args->>'userId')::uuid;
  request_key uuid := (p_args->>'key')::uuid;
  entry_key text;
  wallet uuid;
  credits integer;
  attempt public.prompt_optimizations%ROWTYPE;
BEGIN
  PERFORM 1 FROM public.organization_members WHERE organization_id=org AND user_id=actor FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;

  SELECT id, balance INTO wallet, credits FROM public.organization_wallets
    WHERE organization_id=org FOR UPDATE;
  IF wallet IS NULL THEN RAISE EXCEPTION 'INSUFFICIENT_CREDITS'; END IF;

  IF p_operation = 'begin' THEN
    FOR attempt IN
      UPDATE public.prompt_optimizations SET status='failed'
      WHERE organization_id=org AND user_id=actor AND status='running'
        AND created_at < now() - interval '2 minutes'
      RETURNING *
    LOOP
      credits := credits + 1;
      UPDATE public.organization_wallets SET balance=credits, updated_at=now() WHERE id=wallet;
      INSERT INTO public.wallet_entries(wallet_id,event_key,kind,amount,balance_after,user_id)
        VALUES(wallet,'prompt-optimize:'||actor||':'||attempt.key||':refund','refund',1,credits,actor);
    END LOOP;
  END IF;

  SELECT * INTO attempt FROM public.prompt_optimizations
    WHERE organization_id=org AND user_id=actor AND key=request_key;
  entry_key := 'prompt-optimize:'||actor||':'||request_key;
  IF p_operation = 'begin' THEN
    IF FOUND THEN
      IF attempt.input_hash IS DISTINCT FROM p_args->>'inputHash' THEN
        RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';
      END IF;
      RETURN jsonb_build_object('status', attempt.status, 'result', attempt.result);
    END IF;
    IF EXISTS (SELECT 1 FROM public.prompt_optimizations WHERE organization_id=org
      AND user_id=actor AND status='running') OR
      (SELECT count(*) FROM public.prompt_optimizations WHERE organization_id=org
        AND user_id=actor AND created_at > now() - interval '1 minute') >= 3
    THEN RETURN jsonb_build_object('status', 'busy'); END IF;
    -- Return normally so an earlier expired reservation refund can commit.
    IF credits < 1 THEN RETURN jsonb_build_object('status', 'insufficient'); END IF;
    INSERT INTO public.prompt_optimizations(organization_id,user_id,key,input_hash)
      VALUES(org,actor,request_key,p_args->>'inputHash');
    UPDATE public.organization_wallets SET balance=credits-1, updated_at=now() WHERE id=wallet;
    INSERT INTO public.wallet_entries(wallet_id,event_key,kind,amount,balance_after,user_id)
      VALUES(wallet,entry_key,'consume',-1,credits-1,actor);
    RETURN jsonb_build_object('status', 'started');
  END IF;

  IF p_operation <> 'finish' OR attempt.key IS NULL THEN RAISE EXCEPTION 'STATE_CONFLICT'; END IF;
  IF attempt.status <> 'running' THEN
    RETURN jsonb_build_object('status', attempt.status, 'result', attempt.result);
  END IF;
  IF p_args->>'result' IS NULL THEN
    UPDATE public.prompt_optimizations SET status='failed'
      WHERE organization_id=org AND user_id=actor AND key=request_key;
    UPDATE public.organization_wallets SET balance=credits+1, updated_at=now() WHERE id=wallet;
    INSERT INTO public.wallet_entries(wallet_id,event_key,kind,amount,balance_after,user_id)
      VALUES(wallet,entry_key||':refund','refund',1,credits+1,actor);
    RETURN jsonb_build_object('status', 'failed');
  END IF;
  UPDATE public.prompt_optimizations SET status='ready', result=p_args->>'result'
    WHERE organization_id=org AND user_id=actor AND key=request_key;
  RETURN jsonb_build_object('status', 'ready', 'result', p_args->>'result');
END;
$$;
REVOKE ALL ON FUNCTION public.lycobo_prompt_optimization(text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lycobo_prompt_optimization(text, jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lycobo_prompt_optimization(text, jsonb) TO service_role;
REVOKE ALL ON TABLE public.prompt_optimizations FROM PUBLIC, anon, authenticated, service_role;
