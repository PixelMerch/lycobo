CREATE TABLE IF NOT EXISTS "provider_webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"event_id" text NOT NULL,
	"task_id" text NOT NULL,
	"event_type" text NOT NULL,
	"task_status" text NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "provider_webhook_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "provider_webhook_tasks" (
	"item_id" uuid PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"task_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "provider_webhook_tasks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='provider_webhook_tasks_item_id_generation_job_items_id_fk') THEN ALTER TABLE "provider_webhook_tasks" ADD CONSTRAINT "provider_webhook_tasks_item_id_generation_job_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."generation_job_items"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "provider_webhook_task_idx" ON "provider_webhook_events" USING btree ("source","task_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "provider_webhook_created_idx" ON "provider_webhook_events" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "provider_webhook_source_task_idx" ON "provider_webhook_tasks" USING btree ("source","task_id");
--> statement-breakpoint
-- One transaction owns receipt + durable outbox wake. Never trust callback URLs or billing status.
CREATE OR REPLACE FUNCTION public.lycobo_provider_webhook(p_operation text,p_args jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE
 src text:=p_args->>'source'; tid text:=p_args->>'taskId'; eid text:=p_args->>'eventId';
 item uuid; job uuid; org uuid; current_status text; active_token uuid; snap jsonb;
 receipt public.provider_webhook_events; due timestamptz; ready boolean; has_lease boolean;
BEGIN
 IF p_operation='prune' THEN
   DELETE FROM public.provider_webhook_events WHERE id IN
     (SELECT id FROM public.provider_webhook_events WHERE created_at<now()-interval '7 days' ORDER BY created_at LIMIT 1000);
   RETURN 'false'::jsonb;
 END IF;
 IF src IS NULL OR src !~ '^[a-f0-9]{64}$' OR tid IS NULL OR length(tid)>200 OR tid !~ '^[A-Za-z0-9_-]+$' THEN RAISE EXCEPTION 'VALIDATION_ERROR'; END IF;
 -- Same lock for early receipt and task registration, avoiding a lost wake between transactions.
 PERFORM pg_advisory_xact_lock(hashtextextended(src||':'||tid,71421));
 IF p_operation='receive' THEN
   IF eid IS NULL OR length(eid)>200 OR eid !~ '^[A-Za-z0-9_-]+$'
      OR coalesce(p_args->>'eventType','') NOT IN('image.task.completed','image.task.failed')
      OR coalesce(p_args->>'taskStatus','') NOT IN('success','failed','uncertain') THEN RAISE EXCEPTION 'VALIDATION_ERROR'; END IF;
   INSERT INTO public.provider_webhook_events(id,source,event_id,task_id,event_type,task_status)
     VALUES(src||':'||eid,src,eid,tid,p_args->>'eventType',p_args->>'taskStatus') ON CONFLICT(id) DO NOTHING;
   SELECT * INTO STRICT receipt FROM public.provider_webhook_events WHERE id=src||':'||eid;
   IF receipt.task_id<>tid OR receipt.event_type<>p_args->>'eventType' OR receipt.task_status<>p_args->>'taskStatus' THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
   SELECT t.item_id,i.job_id INTO item,job FROM public.provider_webhook_tasks t JOIN public.generation_job_items i ON i.id=t.item_id WHERE t.source=src AND t.task_id=tid;
   IF item IS NULL THEN RETURN 'false'::jsonb; END IF;
 ELSIF p_operation='wait' THEN
   item:=(p_args->>'itemId')::uuid;
   SELECT job_id INTO job FROM public.generation_job_items WHERE id=item;
   IF job IS NULL THEN RETURN 'false'::jsonb; END IF;
 ELSE RAISE EXCEPTION 'VALIDATION_ERROR'; END IF;
 PERFORM id FROM public.generation_jobs WHERE id=job FOR UPDATE;
 SELECT i.status,i.execution_token,j.provider_snapshot,j.organization_id INTO current_status,active_token,snap,org
   FROM public.generation_job_items i JOIN public.generation_jobs j ON j.id=i.job_id WHERE i.id=item AND i.superseded_at IS NULL FOR UPDATE OF i;
 IF NOT FOUND OR snap->'webhook'->>'source' IS DISTINCT FROM src THEN RETURN 'false'::jsonb; END IF;
 IF p_operation='wait' THEN
   IF current_status<>'running' OR active_token IS DISTINCT FROM (p_args->>'executionToken')::uuid THEN RETURN 'false'::jsonb; END IF;
   INSERT INTO public.provider_webhook_tasks(item_id,source,task_id) VALUES(item,src,tid) ON CONFLICT(item_id) DO NOTHING;
   IF NOT EXISTS(SELECT 1 FROM public.provider_webhook_tasks WHERE item_id=item AND source=src AND task_id=tid) THEN RAISE EXCEPTION 'STATE_CONFLICT'; END IF;
   SELECT EXISTS(SELECT 1 FROM public.provider_webhook_events WHERE source=src AND task_id=tid AND consumed_at IS NULL) INTO ready;
   due:=CASE WHEN ready THEN now() ELSE now()+greatest(30,least(120,(snap->'webhook'->>'waitSeconds')::integer))*interval '1 second' END;
   UPDATE public.provider_executions SET phase='polling',task_id=tid,status_path=p_args->>'statusPath',next_poll_at=due,lease_until=null,poll_failures=0 WHERE item_id=item;
   UPDATE public.generation_job_items SET provider_request_id=coalesce(p_args->>'requestId',provider_request_id),lease_expires_at=(SELECT deadline_at+interval '1 minute' FROM public.provider_executions WHERE item_id=item) WHERE id=item;
 ELSE
   IF current_status NOT IN('running','needs_reconciliation') THEN RETURN 'false'::jsonb; END IF;
   -- A duplicate can re-wake existing durable work after a transport failure, but cannot
   -- reopen completed work or repeatedly extend the execution deadline.
   IF receipt.consumed_at IS NOT NULL THEN
     RETURN to_jsonb(EXISTS(SELECT 1 FROM public.provider_executions WHERE item_id=item AND next_poll_at<=now() AND (lease_until IS NULL OR lease_until<now())));
   END IF;
   SELECT lease_until>now() INTO has_lease FROM public.provider_executions WHERE item_id=item;
   IF current_status='running' AND coalesce(has_lease,false) THEN RETURN 'false'::jsonb; END IF;
   due:=now(); ready:=true;
   UPDATE public.provider_executions SET next_poll_at=due,lease_until=null,deadline_at=greatest(deadline_at,now()+interval '2 minutes') WHERE item_id=item AND phase='polling' AND task_id=tid;
   IF NOT FOUND THEN RETURN 'false'::jsonb; END IF;
   UPDATE public.generation_job_items SET status='running',error_code=null,completed_at=null,lease_expires_at=(SELECT deadline_at+interval '1 minute' FROM public.provider_executions WHERE item_id=item) WHERE id=item;
   UPDATE public.generation_jobs SET status='running',completed_at=null,updated_at=now() WHERE id=job;
 END IF;
 UPDATE public.provider_webhook_events SET consumed_at=now() WHERE source=src AND task_id=tid AND consumed_at IS NULL;
 UPDATE public.generation_outbox SET next_attempt_at=due,lease_token=null,lease_expires_at=null WHERE item_id=item;
 RETURN to_jsonb(ready);
END $$;
REVOKE ALL ON FUNCTION public.lycobo_provider_webhook(text,jsonb) FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON FUNCTION public.lycobo_provider_webhook(text,jsonb) FROM anon; REVOKE ALL ON public.provider_webhook_events,public.provider_webhook_tasks FROM anon; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON FUNCTION public.lycobo_provider_webhook(text,jsonb) FROM authenticated; REVOKE ALL ON public.provider_webhook_events,public.provider_webhook_tasks FROM authenticated; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
   REVOKE ALL ON public.provider_webhook_events,public.provider_webhook_tasks FROM service_role;
   GRANT EXECUTE ON FUNCTION public.lycobo_provider_webhook(text,jsonb) TO service_role;
 END IF;
END $$;

-- Bounded, tenant-scoped batch read; never query one task per network round trip.
CREATE FUNCTION public.lycobo_image_batch(p_org uuid,p_user uuid,p_ids uuid[]) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$ DECLARE result jsonb; BEGIN
 IF p_org IS NULL OR p_user IS NULL OR NOT EXISTS(SELECT 1 FROM public.organization_members WHERE organization_id=p_org AND user_id=p_user) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 PERFORM public._lycobo_expire(p_org);
 IF coalesce(cardinality(p_ids),0)<1 OR cardinality(p_ids)>50 THEN RAISE EXCEPTION 'STATE_CONFLICT'; END IF;
 SELECT coalesce(jsonb_agg(public._lycobo_job_view(j.id)||jsonb_build_object('recovery_due',EXISTS(
   SELECT 1 FROM public.generation_job_items i JOIN public.provider_executions e ON e.item_id=i.id
   WHERE i.job_id=j.id AND i.superseded_at IS NULL AND i.status='running' AND e.phase='polling' AND e.next_poll_at<=now() AND(e.lease_until IS NULL OR e.lease_until<now())
 ))),'[]'::jsonb) INTO result FROM public.generation_jobs j WHERE j.id=ANY(p_ids) AND j.organization_id=p_org;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.lycobo_image_batch(uuid,uuid,uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lycobo_image_batch(uuid,uuid,uuid[]) TO service_role;

-- Accepted webhook waits have their own provider deadline, not the old three-minute UI timeout.
CREATE OR REPLACE FUNCTION public._lycobo_expire(p_org uuid DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ DECLARE r record; BEGIN
 FOR r IN SELECT i.id,i.job_id FROM public.generation_job_items i WHERE i.status='running' AND i.superseded_at IS NULL
   AND i.started_at<now()-interval '3 minutes' AND(p_org IS NULL OR i.organization_id=p_org)
   AND NOT EXISTS(SELECT 1 FROM public.provider_webhook_tasks w JOIN public.provider_executions e ON e.item_id=w.item_id
     WHERE w.item_id=i.id AND e.phase='polling')
   ORDER BY i.job_id,i.id LIMIT 100 LOOP
 PERFORM id FROM public.generation_jobs WHERE id=r.job_id FOR UPDATE;
 UPDATE public.generation_job_items SET status='needs_reconciliation',error_code='PROVIDER_TIMEOUT',completed_at=now()
   WHERE id=r.id AND status='running' AND superseded_at IS NULL AND started_at<now()-interval '3 minutes'
   AND NOT EXISTS(SELECT 1 FROM public.provider_webhook_tasks w JOIN public.provider_executions e ON e.item_id=w.item_id WHERE w.item_id=r.id AND e.phase='polling');
 IF FOUND THEN PERFORM public._lycobo_refresh(r.job_id); END IF;
 END LOOP;
END $$;

-- Preserve earlier RPC fixes and privileges; only exempt registered waits from lost-lease expiry.
DO $migration$
DECLARE
 definition text:=pg_get_functiondef('public.lycobo_image_operation(text,jsonb)'::regprocedure);
 previous text:=$q$e.next_poll_at IS NOT NULL AND e.deadline_at>now()$q$;
 replacement text:=$q$e.next_poll_at IS NOT NULL AND(e.deadline_at>now() OR EXISTS(SELECT 1 FROM public.provider_webhook_tasks w WHERE w.item_id=e.item_id))$q$;
BEGIN
 IF (length(definition)-length(replace(definition,previous,'')))<>length(previous) THEN RAISE EXCEPTION 'Unexpected image RPC definition'; END IF;
 definition:=replace(definition,previous,replacement);
 previous:=$q$WHERE id=r.id AND status='running' AND lease_expires_at<now();$q$;
 replacement:=$q$WHERE id=r.id AND status='running' AND lease_expires_at<now() AND NOT EXISTS(SELECT 1 FROM public.provider_executions e WHERE e.item_id=r.id AND e.phase='polling' AND e.task_id IS NOT NULL AND e.status_path IS NOT NULL AND e.next_poll_at IS NOT NULL AND(e.deadline_at>now() OR EXISTS(SELECT 1 FROM public.provider_webhook_tasks w WHERE w.item_id=e.item_id)));$q$;
 IF (length(definition)-length(replace(definition,previous,'')))<>length(previous) THEN RAISE EXCEPTION 'Unexpected expiry definition'; END IF;
 EXECUTE replace(definition,previous,replacement);
END $migration$;
