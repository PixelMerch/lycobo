CREATE TABLE "generation_video_outbox" (
	"job_id" uuid PRIMARY KEY NOT NULL,
	"item_id" uuid NOT NULL,
	"origin" text NOT NULL,
	"credential_hash" text NOT NULL,
	"phase" text DEFAULT 'queued' NOT NULL,
	"provider_task_id" text,
	"provider_status" text,
	"next_run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deadline_at" timestamp with time zone NOT NULL,
	"lease_until" timestamp with time zone,
	"execution_token" uuid,
	"failures" integer DEFAULT 0 NOT NULL,
	"processed_at" timestamp with time zone,
	CONSTRAINT "generation_video_outbox_item_id_unique" UNIQUE("item_id"),
	CONSTRAINT "generation_video_phase_check" CHECK ("generation_video_outbox"."phase" in ('queued','submitting','polling','downloading','done')),
	CONSTRAINT "generation_video_failures_check" CHECK ("generation_video_outbox"."failures" >= 0)
);
--> statement-breakpoint
ALTER TABLE "generation_video_outbox" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "generation_video_outbox" ADD CONSTRAINT "generation_video_outbox_job_id_generation_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."generation_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_video_outbox" ADD CONSTRAINT "generation_video_outbox_item_id_generation_job_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."generation_job_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "generation_video_due_idx" ON "generation_video_outbox" USING btree ("next_run_at") WHERE "generation_video_outbox"."processed_at" is null;
--> statement-breakpoint
-- Fixed, service-only operations. API resolves scope; no client SQL or object keys are accepted.
CREATE FUNCTION public.lycobo_video_operation(p_operation text,p_args jsonb DEFAULT '{}'::jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE
 org uuid:=(p_args->>'organizationId')::uuid; usr uuid:=(p_args->>'userId')::uuid;
 ident uuid:=(p_args->>'id')::uuid; token uuid:=(p_args->>'token')::uuid;
 job public.generation_jobs; intent public.generation_video_outbox; wallet public.organization_wallets;
 task_id uuid; item_id uuid; balance_now integer; existing_hash text; count_refs integer;
 payload jsonb:=p_args->'input'; result jsonb; terminal text; new_asset uuid;
BEGIN
 IF p_operation IN ('create','list','get','storageUid') THEN
  PERFORM user_id FROM public.organization_members WHERE organization_id=org AND user_id=usr FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 END IF;
 IF p_operation='storageUid' THEN
  RETURN (SELECT to_jsonb(uid) FROM public.users WHERE id=usr);
 ELSIF p_operation='create' THEN
  -- Serialize replay and charge per member before inspecting the idempotency key.
  PERFORM pg_advisory_xact_lock(hashtextextended(org::text||usr::text,71426));
  SELECT id,input_hash INTO task_id,existing_hash FROM public.generation_jobs
   WHERE organization_id=org AND user_id=usr AND idempotency_key=(p_args->>'key')::uuid;
  IF FOUND THEN
   IF existing_hash<>p_args->>'inputHash' THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
   RETURN jsonb_build_object('id',task_id,'replayed',true);
  END IF;
  IF jsonb_typeof(payload)<>'object' OR (payload->>'seconds')::integer NOT IN (10,15,20,30)
   OR length(trim(payload->>'prompt')) NOT BETWEEN 1 AND 800
   OR payload->>'aspectRatio' NOT IN ('16:9','21:9','9:16','4:3','3:4','1:1')
   OR jsonb_array_length(payload->'referenceAssetIds')>9 THEN RAISE EXCEPTION 'STATE_CONFLICT'; END IF;
  IF (SELECT count(*) FROM public.generation_jobs WHERE organization_id=org AND user_id=usr
    AND input ? 'video' AND status IN ('queued','running','needs_reconciliation'))>=4 THEN RAISE EXCEPTION 'RATE_LIMITED'; END IF;
  PERFORM a.id FROM public.media_assets a WHERE a.id IN(SELECT value::uuid FROM jsonb_array_elements_text(payload->'referenceAssetIds')) FOR SHARE;
  SELECT count(DISTINCT a.id) INTO count_refs FROM public.media_assets a
   JOIN jsonb_array_elements_text(payload->'referenceAssetIds') r ON a.id=r.value::uuid
   WHERE a.organization_id=org AND a.user_id=usr AND a.media_type='image'
   AND (a.expires_at IS NULL OR a.expires_at>now()) AND a.storage_deleted_at IS NULL AND a.cleanup_started_at IS NULL;
  IF count_refs<>jsonb_array_length(payload->'referenceAssetIds') THEN RAISE EXCEPTION 'REFERENCE_NOT_FOUND'; END IF;
  INSERT INTO public.organization_wallets(organization_id) VALUES(org) ON CONFLICT DO NOTHING;
  SELECT * INTO STRICT wallet FROM public.organization_wallets WHERE organization_id=org FOR UPDATE;
  IF wallet.balance<100 THEN RAISE EXCEPTION 'INSUFFICIENT_CREDITS'; END IF;
  INSERT INTO public.generation_jobs(organization_id,user_id,idempotency_key,input_hash,input,model,prompt,resolution,aspect_ratio,requested_count,unit_credits)
   VALUES(org,usr,(p_args->>'key')::uuid,p_args->>'inputHash',jsonb_build_object('video',payload),'Minimax-h3-933特价',payload->>'prompt','768p',payload->>'aspectRatio',1,100) RETURNING id INTO task_id;
  INSERT INTO public.generation_job_items(job_id,organization_id,position,provider) VALUES(task_id,org,0,'fluxport-video') RETURNING id INTO item_id;
  UPDATE public.organization_wallets SET balance=balance-100,updated_at=now() WHERE id=wallet.id RETURNING balance INTO balance_now;
  INSERT INTO public.wallet_entries(wallet_id,user_id,event_key,kind,amount,balance_after,job_id,item_id)
   VALUES(wallet.id,usr,'consume:'||item_id,'consume',-100,balance_now,task_id,item_id);
  INSERT INTO public.generation_credit_ledger(organization_id,job_id,item_id,event_type,amount) VALUES(org,task_id,NULL,'reserve',-100);
  INSERT INTO public.generation_video_outbox(job_id,item_id,origin,credential_hash,deadline_at)
   VALUES(task_id,item_id,p_args->>'origin',p_args->>'credentialHash',now()+interval '30 minutes');
  UPDATE public.media_assets SET expires_at=NULL WHERE id IN(SELECT value::uuid FROM jsonb_array_elements_text(payload->'referenceAssetIds'));
  RETURN jsonb_build_object('id',task_id,'replayed',false);
 ELSIF p_operation IN ('get','list') THEN
  SELECT coalesce(jsonb_agg(to_jsonb(v)),'[]'::jsonb) INTO result FROM (
   SELECT j.id,j.public_id,j.prompt,j.status,j.created_at,j.input,i.error_code,i.output_asset_id AS asset_id,o.provider_status,
    a.object_key,a.width,a.height FROM public.generation_jobs j
    JOIN public.generation_video_outbox o ON o.job_id=j.id
    JOIN public.generation_job_items i ON i.id=o.item_id LEFT JOIN public.media_assets a ON a.id=i.output_asset_id
    WHERE j.organization_id=org AND j.user_id=usr AND j.archived_at IS NULL
    AND (ident IS NULL OR j.id=ident)
    AND (p_args->>'before' IS NULL OR (j.created_at,j.id)<(SELECT created_at,id FROM public.generation_jobs WHERE id=(p_args->>'before')::uuid AND organization_id=org AND user_id=usr))
    ORDER BY j.created_at DESC,j.id DESC LIMIT 20
  )v;
  RETURN result;
 ELSIF p_operation='claim' THEN
  SELECT * INTO intent FROM public.generation_video_outbox WHERE processed_at IS NULL
   AND next_run_at<=now() AND (lease_until IS NULL OR lease_until<now()) ORDER BY next_run_at LIMIT 1 FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO STRICT job FROM public.generation_jobs WHERE id=intent.job_id FOR UPDATE;
  IF intent.phase='submitting' AND intent.provider_task_id IS NULL OR intent.deadline_at<=now() THEN
   UPDATE public.generation_job_items SET status='needs_reconciliation',error_code='VIDEO_OUTCOME_UNKNOWN' WHERE id=intent.item_id;
   UPDATE public.generation_jobs SET status='needs_reconciliation',updated_at=now() WHERE id=job.id;
   UPDATE public.generation_video_outbox SET processed_at=now(),phase='done',lease_until=NULL WHERE job_id=job.id;
   RETURN jsonb_build_object('skipped',true);
  END IF;
  token:=gen_random_uuid();
  UPDATE public.generation_video_outbox SET execution_token=token,lease_until=now()+interval '3 minutes',
   phase=CASE WHEN phase='queued' THEN 'submitting' ELSE phase END WHERE job_id=job.id;
  UPDATE public.generation_jobs SET status='running',updated_at=now() WHERE id=job.id;
  UPDATE public.generation_job_items SET status='running',started_at=coalesce(started_at,now()),attempts=attempts+1 WHERE id=intent.item_id;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',a.id,'objectKey',a.object_key) ORDER BY r.ordinality),'[]'::jsonb) INTO result
   FROM jsonb_array_elements_text(job.input->'video'->'referenceAssetIds') WITH ORDINALITY r(value,ordinality)
   JOIN public.media_assets a ON a.id=r.value::uuid AND a.organization_id=job.organization_id AND a.user_id=job.user_id
   AND a.storage_deleted_at IS NULL;
  RETURN jsonb_build_object('id',job.id,'itemId',intent.item_id,'organizationId',job.organization_id,'userId',job.user_id,
   'token',token,'input',job.input->'video','origin',intent.origin,'credentialHash',intent.credential_hash,
   'providerTaskId',intent.provider_task_id,'failures',intent.failures,'references',result,'submit',intent.phase='queued');
 ELSIF p_operation='due' THEN
  SELECT to_jsonb(min(greatest(next_run_at,coalesce(lease_until,next_run_at)))) INTO result FROM public.generation_video_outbox WHERE processed_at IS NULL;
  RETURN result;
 ELSIF p_operation IN ('defer','finish') THEN
  SELECT * INTO intent FROM public.generation_video_outbox WHERE job_id=ident AND execution_token=token AND processed_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN 'false'::jsonb; END IF;
  SELECT * INTO STRICT job FROM public.generation_jobs WHERE id=ident FOR UPDATE;
  IF p_operation='defer' THEN
   UPDATE public.generation_video_outbox SET provider_task_id=coalesce(provider_task_id,p_args->>'providerTaskId'),
    provider_status=coalesce(p_args->>'providerStatus',provider_status),phase=CASE WHEN p_args->>'phase'='downloading' THEN 'downloading' ELSE 'polling' END,
    next_run_at=now()+make_interval(secs=>least(1800,greatest(5,(p_args->>'delaySeconds')::integer))),
    lease_until=NULL,execution_token=NULL,failures=CASE WHEN coalesce((p_args->>'failure')::boolean,false) THEN failures+1 ELSE 0 END WHERE job_id=ident;
   RETURN 'true'::jsonb;
  END IF;
  terminal:=p_args->>'status';
  IF terminal NOT IN ('succeeded','failed','needs_reconciliation') THEN RAISE EXCEPTION 'STATE_CONFLICT'; END IF;
  IF terminal='succeeded' THEN
   new_asset:=intent.item_id;
   IF p_args->'asset'->>'objectKey' IS NULL THEN RAISE EXCEPTION 'STATE_CONFLICT'; END IF;
   INSERT INTO public.media_assets(id,organization_id,user_id,kind,media_type,object_key,mime_type,width,height,bytes,sha256)
    VALUES(new_asset,job.organization_id,job.user_id,'output','video',p_args->'asset'->>'objectKey','video/mp4',
     (p_args->'asset'->>'width')::integer,(p_args->'asset'->>'height')::integer,(p_args->'asset'->>'bytes')::integer,p_args->'asset'->>'sha256');
  ELSIF terminal='failed' THEN
   INSERT INTO public.organization_wallets(organization_id) VALUES(job.organization_id) ON CONFLICT DO NOTHING;
   SELECT * INTO STRICT wallet FROM public.organization_wallets WHERE organization_id=job.organization_id FOR UPDATE;
   IF NOT EXISTS(SELECT 1 FROM public.wallet_entries WHERE wallet_id=wallet.id AND event_key='refund:'||intent.item_id) THEN
    UPDATE public.organization_wallets SET balance=balance+job.unit_credits,updated_at=now() WHERE id=wallet.id RETURNING balance INTO balance_now;
    INSERT INTO public.wallet_entries(wallet_id,user_id,event_key,kind,amount,balance_after,job_id,item_id)
     VALUES(wallet.id,job.user_id,'refund:'||intent.item_id,'refund',job.unit_credits,balance_now,job.id,intent.item_id);
    INSERT INTO public.generation_credit_ledger(organization_id,job_id,item_id,event_type,amount)
     VALUES(job.organization_id,job.id,intent.item_id,'refund',job.unit_credits) ON CONFLICT DO NOTHING;
   END IF;
  END IF;
  UPDATE public.generation_job_items SET status=terminal,output_asset_id=new_asset,error_code=p_args->>'errorCode',completed_at=CASE WHEN terminal='needs_reconciliation' THEN NULL ELSE now() END WHERE id=intent.item_id;
  UPDATE public.generation_jobs SET status=terminal,updated_at=now(),completed_at=CASE WHEN terminal='needs_reconciliation' THEN NULL ELSE now() END WHERE id=ident;
  UPDATE public.generation_video_outbox SET processed_at=now(),phase='done',lease_until=NULL,execution_token=NULL WHERE job_id=ident;
  RETURN 'true'::jsonb;
 ELSE RAISE EXCEPTION 'STATE_CONFLICT'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.lycobo_video_operation(text,jsonb) FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  GRANT EXECUTE ON FUNCTION public.lycobo_video_operation(text,jsonb) TO service_role;
  REVOKE ALL ON public.generation_video_outbox FROM service_role;
 END IF;
END $$;
