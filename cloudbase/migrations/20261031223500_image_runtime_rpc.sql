-- All accepted operations are fixed below. No SQL or identifier interpolation.
CREATE FUNCTION public._lycobo_event(p_org uuid,p_kind text,p_resource uuid) RETURNS void
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_org::text,71420));
 INSERT INTO public.generation_events(organization_id,kind,resource_id) VALUES(p_org,p_kind,p_resource);
END $$;
CREATE FUNCTION public._lycobo_refresh(p_job uuid) RETURNS void
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ DECLARE org uuid; BEGIN
 UPDATE public.generation_jobs j SET status=CASE
 WHEN EXISTS(SELECT 1 FROM public.generation_job_items i WHERE i.job_id=j.id AND i.superseded_at IS NULL AND i.status='running') THEN 'running'
 WHEN EXISTS(SELECT 1 FROM public.generation_job_items i WHERE i.job_id=j.id AND i.superseded_at IS NULL AND i.status='queued') THEN 'queued'
 WHEN EXISTS(SELECT 1 FROM public.generation_job_items i WHERE i.job_id=j.id AND i.superseded_at IS NULL AND i.status='needs_reconciliation') THEN 'needs_reconciliation'
 WHEN NOT EXISTS(SELECT 1 FROM public.generation_job_items i WHERE i.job_id=j.id AND i.superseded_at IS NULL AND i.status<>'succeeded') THEN 'succeeded'
 WHEN EXISTS(SELECT 1 FROM public.generation_job_items i WHERE i.job_id=j.id AND i.superseded_at IS NULL AND i.status='succeeded') THEN 'partially_failed'
 ELSE 'failed' END,updated_at=now(),completed_at=CASE
 WHEN EXISTS(SELECT 1 FROM public.generation_job_items i WHERE i.job_id=j.id AND i.superseded_at IS NULL AND i.status IN('running','queued','needs_reconciliation')) THEN NULL ELSE now() END
 WHERE j.id=p_job RETURNING organization_id INTO org;
 IF org IS NOT NULL THEN PERFORM public._lycobo_event(org,'task',p_job); END IF;
END $$;
CREATE FUNCTION public._lycobo_wallet(p_org uuid,p_user uuid) RETURNS public.organization_wallets
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ DECLARE w public.organization_wallets; BEGIN
 PERFORM user_id FROM public.organization_members WHERE organization_id=p_org AND user_id=p_user FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 INSERT INTO public.organization_wallets(organization_id) VALUES(p_org) ON CONFLICT(organization_id) DO NOTHING;
 SELECT * INTO STRICT w FROM public.organization_wallets WHERE organization_id=p_org FOR UPDATE;
 RETURN w;
END $$;
CREATE FUNCTION public._lycobo_entry(p_wallet uuid,p_key text,p_kind text,p_amount integer,p_user uuid,p_job uuid,p_item uuid) RETURNS void
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ DECLARE b integer; BEGIN
 IF EXISTS(SELECT 1 FROM public.wallet_entries WHERE wallet_id=p_wallet AND event_key=p_key) THEN RETURN; END IF;
 UPDATE public.organization_wallets SET balance=balance+p_amount,updated_at=now() WHERE id=p_wallet AND balance+p_amount>=0 RETURNING balance INTO b;
 IF NOT FOUND THEN RAISE EXCEPTION 'INSUFFICIENT_CREDITS'; END IF;
 INSERT INTO public.wallet_entries(wallet_id,event_key,kind,amount,balance_after,user_id,job_id,item_id)
 VALUES(p_wallet,p_key,p_kind,p_amount,b,p_user,p_job,p_item);
END $$;
CREATE FUNCTION public._lycobo_refund(p_job uuid,p_item uuid) RETURNS void
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ DECLARE org uuid; amount integer; usr uuid; w public.organization_wallets; BEGIN
 INSERT INTO public.generation_credit_ledger(organization_id,job_id,item_id,event_type,amount)
 SELECT j.organization_id,j.id,p_item,'refund',coalesce((SELECT -e.amount FROM public.wallet_entries e JOIN public.organization_wallets wallet ON wallet.id=e.wallet_id
 WHERE e.event_key='consume:'||p_item::text AND e.job_id=j.id AND e.item_id=p_item AND e.kind='consume' AND wallet.organization_id=j.organization_id),j.unit_credits)
 FROM public.generation_jobs j WHERE j.id=p_job ON CONFLICT DO NOTHING RETURNING organization_id,generation_credit_ledger.amount INTO org,amount;
 IF org IS NOT NULL THEN
 SELECT user_id INTO usr FROM public.generation_jobs WHERE id=p_job;
 w:=public._lycobo_wallet(org,usr);
 PERFORM public._lycobo_entry(w.id,'refund:'||p_item::text,'refund',amount,usr,p_job,p_item);
 END IF;
END $$;
CREATE FUNCTION public._lycobo_job_view(p_job uuid) RETURNS jsonb
LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
 SELECT jsonb_build_object('public_id',j.public_id,'id',j.id,'organization_id',j.organization_id,'user_id',j.user_id,
 'model',CASE WHEN j.model IN('nano-banana-2.1','gemini-nano-banana-2.1') THEN 'nano-banana-2.1' WHEN j.model IN('gpt-image-2.5','gpt-image-2.5-flare','gpt-image-2.5-sunburst') THEN 'gpt-image-2.5' WHEN j.model IN('gpt-image-2','gpt-image-2-4K') THEN 'gpt-image-2' ELSE j.model END,
 'prompt',j.prompt,'resolution',j.resolution,'aspect_ratio',j.aspect_ratio,'requested_count',j.requested_count,'unit_credits',j.unit_credits,
 'status',j.status,'input',j.input,'created_at',j.created_at,'updated_at',j.updated_at,'completed_at',j.completed_at,
 'items',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',i.id,'position',i.position,'status',i.status,'worker_id',i.worker_id,'provider',i.provider,
 'provider_request_id',i.provider_request_id,'attempts',i.attempts,'error_code',i.error_code,'started_at',i.started_at,'completed_at',i.completed_at,
 'output_asset_id',i.output_asset_id,'output_public_id',a.public_id,'width',a.width,'height',a.height,'bytes',a.bytes) ORDER BY i.position),'[]'::jsonb)
 FROM public.generation_job_items i LEFT JOIN public.media_assets a ON a.id=i.output_asset_id AND a.organization_id=i.organization_id WHERE i.job_id=j.id AND i.superseded_at IS NULL))
 FROM public.generation_jobs j WHERE j.id=p_job;
$$;
CREATE FUNCTION public._lycobo_expire(p_org uuid DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ DECLARE r record; BEGIN
 FOR r IN SELECT id,job_id FROM public.generation_job_items WHERE status='running' AND superseded_at IS NULL AND started_at<now()-interval '3 minutes' AND(p_org IS NULL OR organization_id=p_org) ORDER BY job_id,id LIMIT 100 LOOP
 PERFORM id FROM public.generation_jobs WHERE id=r.job_id FOR UPDATE;
 UPDATE public.generation_job_items SET status='needs_reconciliation',error_code='PROVIDER_TIMEOUT',completed_at=now() WHERE id=r.id AND status='running' AND superseded_at IS NULL AND started_at<now()-interval '3 minutes';
 IF FOUND THEN PERFORM public._lycobo_refresh(r.job_id); END IF;
 END LOOP;
END $$;

CREATE FUNCTION public.lycobo_image_operation(p_operation text,p_args jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE
 org uuid:=(p_args->>'organizationId')::uuid; usr uuid:=(p_args->>'userId')::uuid;
 ident uuid:=(p_args->>'id')::uuid; v_job_id uuid:=(p_args->>'jobId')::uuid;
 v_item_id uuid:=(p_args->>'itemId')::uuid; token uuid:=(p_args->>'executionToken')::uuid;
 before_id uuid:=(p_args->>'before')::uuid; n integer:=least(greatest(coalesce((p_args->>'limit')::integer,50),1),200);
 input jsonb:=p_args->'input'; snap jsonb:=p_args->'snapshot'; result jsonb; r record; v_job public.generation_jobs;
 v_wallet public.organization_wallets; new_id uuid; affected uuid; refs uuid[]; failed_ids uuid[]; rows_count integer;
 delay_ms integer; lease_ms integer; deadline timestamptz; phase text; wanted_item uuid; input_hash text:=p_args->>'inputHash';
BEGIN
 IF p_operation IN('storageUid','wallet','walletEntries','rechargeOrders','create','get','list','latestEdit','archive','addReference','asset','assetLocations','listAssets','providerRetryCandidates','resumeProvider','retry','reconcile','variationBegin','variationGet','variationFinish','eventsLatest','eventsSince') AND(org IS NULL OR usr IS NULL) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 -- Every scoped operation rechecks membership; callers obtain scope from server authentication.
 IF org IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.organization_members WHERE organization_id=org AND user_id=usr) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 CASE p_operation
 WHEN 'storageUid' THEN
 SELECT to_jsonb(uid) INTO result FROM public.users WHERE id=usr;
 RETURN result;
 WHEN 'authenticate' THEN
 SELECT jsonb_build_object('userId',k.user_id,'organizationId',k.organization_id,'uid',u.uid,'role',m.role) INTO result
 FROM public.generation_api_keys k JOIN public.users u ON u.id=k.user_id JOIN public.organization_members m ON m.organization_id=k.organization_id AND m.user_id=k.user_id
 WHERE k.token_hash=p_args->>'tokenHash' AND k.revoked_at IS NULL AND k.expires_at>now(); RETURN result;
 WHEN 'wallet' THEN
 RETURN jsonb_build_object('balance',coalesce((SELECT balance FROM public.organization_wallets WHERE organization_id=org),0));
 WHEN 'walletEntries' THEN
 SELECT coalesce(jsonb_agg(to_jsonb(v)),'[]'::jsonb) INTO result FROM (
 SELECT e.id::text,u.uid AS user_uid,e.kind,e.amount,e.balance_after,e.job_id,j.public_id AS task_id,e.item_id,e.recharge_id,e.created_at
 FROM public.wallet_entries e JOIN public.organization_wallets w ON w.id=e.wallet_id LEFT JOIN public.generation_jobs j ON j.id=e.job_id LEFT JOIN public.users u ON u.id=e.user_id
 WHERE w.organization_id=org AND(p_args->>'beforeEntry' IS NULL OR e.id<(p_args->>'beforeEntry')::bigint) ORDER BY e.id DESC LIMIT n) v; RETURN result;
 WHEN 'rechargeOrders' THEN
 SELECT coalesce(jsonb_agg(to_jsonb(v)),'[]'::jsonb) INTO result FROM (
 SELECT orders.id,u.uid AS user_uid,orders.credits,orders.amount_minor,orders.currency,orders.status,orders.channel,orders.created_at,orders.paid_at
 FROM public.recharge_orders orders JOIN public.organization_wallets w ON w.id=orders.wallet_id JOIN public.users u ON u.id=orders.user_id
 WHERE w.organization_id=org AND(before_id IS NULL OR(orders.created_at,orders.id)<(SELECT created_at,id FROM public.recharge_orders WHERE id=before_id AND wallet_id=w.id)) ORDER BY orders.created_at DESC,orders.id DESC LIMIT n) v; RETURN result;
 WHEN 'create' THEN
 PERFORM user_id FROM public.organization_members WHERE organization_id=org AND user_id=usr FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 SELECT * INTO v_job FROM public.generation_jobs WHERE organization_id=org AND user_id=usr AND idempotency_key=(p_args->>'key')::uuid;
 IF FOUND THEN
 IF v_job.input_hash<>input_hash THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
 RETURN jsonb_build_object('id',v_job.id,'replayed',true); END IF;
 IF snap IS NULL OR snap='null'::jsonb THEN RAISE EXCEPTION 'MODEL_CAPABILITY_UNVERIFIED'; END IF;
 INSERT INTO public.generation_jobs(organization_id,user_id,idempotency_key,input_hash,input,model,provider_model,prompt,resolution,aspect_ratio,requested_count,unit_credits,provider_snapshot)
 VALUES(org,usr,(p_args->>'key')::uuid,input_hash,input,input->>'model',p_args->>'providerModel',input->>'prompt',input->>'resolution',input->>'aspectRatio',(input->>'count')::integer,2,snap)
 ON CONFLICT(organization_id,user_id,idempotency_key) DO NOTHING RETURNING id INTO new_id;
 IF new_id IS NULL THEN
 SELECT * INTO v_job FROM public.generation_jobs WHERE organization_id=org AND user_id=usr AND idempotency_key=(p_args->>'key')::uuid;
 IF v_job.id IS NULL OR v_job.input_hash<>input_hash THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
 RETURN jsonb_build_object('id',v_job.id,'replayed',true); END IF;
 SELECT coalesce(array_agg(value::uuid),ARRAY[]::uuid[]) INTO refs FROM jsonb_array_elements_text(input->'referenceAssetIds');
 PERFORM id FROM public.media_assets WHERE organization_id=org AND id=ANY(refs) AND(expires_at IS NULL OR expires_at>now()) AND storage_deleted_at IS NULL AND cleanup_started_at IS NULL ORDER BY id FOR UPDATE;
 GET DIAGNOSTICS rows_count=ROW_COUNT;
 IF rows_count<>cardinality(refs) THEN RAISE EXCEPTION 'REFERENCE_NOT_FOUND'; END IF;
 IF input ? 'localEdit' THEN
 IF NOT EXISTS(SELECT 1 FROM public.media_assets WHERE id=(input->'localEdit'->>'sourceAssetId')::uuid AND organization_id=org AND width=(input->'localEdit'->>'width')::integer AND height=(input->'localEdit'->>'height')::integer) THEN RAISE EXCEPTION 'REFERENCE_NOT_FOUND'; END IF;
 INSERT INTO public.image_local_edits(job_id,organization_id,user_id,source_asset_id) VALUES(new_id,org,usr,(input->'localEdit'->>'sourceAssetId')::uuid);
 END IF;
 IF input ? 'variation' THEN
 SELECT v.input,v.status INTO r FROM public.variation_plans v WHERE id=(input->'variation'->>'planId')::uuid AND organization_id=org AND user_id=usr;
 IF NOT FOUND OR r.status<>'ready' THEN RAISE EXCEPTION 'STATE_CONFLICT'; END IF;
 IF r.input->'referenceAssetIds' IS DISTINCT FROM input->'referenceAssetIds' THEN RAISE EXCEPTION 'REFERENCE_NOT_FOUND'; END IF;
 END IF;
 v_wallet:=public._lycobo_wallet(org,usr);
 IF v_wallet.balance<2*(input->>'count')::integer THEN RAISE EXCEPTION 'INSUFFICIENT_CREDITS'; END IF;
 INSERT INTO public.generation_credit_ledger(organization_id,job_id,event_type,amount) VALUES(org,new_id,'reserve',-2*(input->>'count')::integer);
 FOR pos IN 0..(input->>'count')::integer-1 LOOP
 v_item_id:=gen_random_uuid();
 INSERT INTO public.generation_job_items(id,job_id,organization_id,position) VALUES(v_item_id,new_id,org,pos);
 PERFORM public._lycobo_entry(v_wallet.id,'consume:'||v_item_id::text,'consume',-2,usr,new_id,v_item_id);
 INSERT INTO public.generation_outbox(item_id) VALUES(v_item_id);
 END LOOP;
 UPDATE public.media_assets SET expires_at=null WHERE organization_id=org AND id=ANY(refs);
 PERFORM public._lycobo_event(org,'task',new_id);
 RETURN jsonb_build_object('id',new_id,'replayed',false);
 WHEN 'get','list','latestEdit' THEN
 IF p_operation<>'latestEdit' THEN PERFORM public._lycobo_expire(org); END IF;
 IF p_operation='get' THEN
 IF NOT EXISTS(SELECT 1 FROM public.generation_jobs WHERE id=ident AND organization_id=org) THEN RETURN NULL; END IF;
 RETURN public._lycobo_job_view(ident);
 ELSIF p_operation='latestEdit' THEN
 IF NOT EXISTS(SELECT 1 FROM public.media_assets WHERE id=ident AND organization_id=org) THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
 SELECT e.job_id INTO new_id FROM public.image_local_edits e JOIN public.generation_jobs j ON j.id=e.job_id AND j.organization_id=e.organization_id WHERE e.organization_id=org AND e.user_id=usr AND e.source_asset_id=ident ORDER BY e.created_at DESC,e.job_id DESC LIMIT 1;
 RETURN public._lycobo_job_view(new_id);
 END IF;
 SELECT coalesce(jsonb_agg(public._lycobo_job_view(v.id)),'[]'::jsonb) INTO result FROM(
 SELECT id FROM public.generation_jobs j WHERE organization_id=org AND archived_at IS NULL
 AND(p_args->>'tool' IS NULL OR CASE p_args->>'tool' WHEN 'textile' THEN j.input ? 'textileSet' WHEN 'variation' THEN j.input ? 'variation' ELSE NOT(j.input ? 'textileSet') AND NOT(j.input ? 'variation') END)
 AND(before_id IS NULL OR(j.created_at,j.id)<(SELECT created_at,id FROM public.generation_jobs WHERE id=before_id AND organization_id=org)) ORDER BY created_at DESC,id DESC LIMIT n)v;
 RETURN result;
 WHEN 'archive' THEN
 UPDATE public.generation_jobs SET archived_at=coalesce(archived_at,now()) WHERE id=ident AND organization_id=org RETURNING id INTO affected;
 IF affected IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
 PERFORM public._lycobo_event(org,'task',ident); RETURN 'true'::jsonb;
 WHEN 'addReference' THEN
 input:=p_args->'image';
 INSERT INTO public.media_assets(id,organization_id,user_id,kind,media_type,object_key,mime_type,width,height,bytes,sha256,expires_at)
 VALUES((input->>'id')::uuid,org,usr,'reference','image',input->>'objectKey','image/png',(input->>'width')::integer,(input->>'height')::integer,(input->>'bytes')::integer,input->>'sha256',now()+interval '3 days');
 PERFORM public._lycobo_event(org,'asset',(input->>'id')::uuid); RETURN 'true'::jsonb;
 WHEN 'asset' THEN
 SELECT jsonb_build_object('id',id,'objectKey',object_key,'mimeType','image/png','width',width,'height',height,'bytes',bytes,'sha256',sha256) INTO result
 FROM public.media_assets WHERE id=ident AND organization_id=org AND(expires_at IS NULL OR expires_at>now()) AND storage_deleted_at IS NULL;
 RETURN result;
 WHEN 'assetLocations' THEN
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'objectKey',object_key)),'[]'::jsonb) INTO result FROM public.media_assets
 WHERE organization_id=org AND id IN(SELECT value::uuid FROM jsonb_array_elements_text(p_args->'ids')) AND(expires_at IS NULL OR expires_at>now()) AND storage_deleted_at IS NULL; RETURN result;
 WHEN 'listAssets' THEN
 SELECT coalesce(jsonb_agg(to_jsonb(v)),'[]'::jsonb) INTO result FROM(
 SELECT a.public_id,a.id,a.kind,a.media_type AS type,a.width,a.height,a.bytes,a.created_at,j.public_id AS task_public_id,
 CASE WHEN j.model IN('nano-banana-2.1','gemini-nano-banana-2.1') THEN 'nano-banana-2.1' WHEN j.model IN('gpt-image-2.5','gpt-image-2.5-flare','gpt-image-2.5-sunburst') THEN 'gpt-image-2.5' WHEN j.model IN('gpt-image-2','gpt-image-2-4K') THEN 'gpt-image-2' ELSE j.model END AS model,j.prompt
 FROM public.media_assets a LEFT JOIN public.generation_job_items i ON i.output_asset_id=a.id AND i.organization_id=a.organization_id LEFT JOIN public.generation_jobs j ON j.id=i.job_id AND j.organization_id=a.organization_id
 WHERE a.organization_id=org AND(a.expires_at IS NULL OR a.expires_at>now()) AND a.storage_deleted_at IS NULL
 AND(p_args->>'kind' IS NULL OR a.kind=p_args->>'kind') AND(p_args->>'type' IS NULL OR a.media_type=p_args->>'type')
 AND(before_id IS NULL OR(a.created_at,a.id)<(SELECT created_at,id FROM public.media_assets WHERE id=before_id AND organization_id=org)) ORDER BY a.created_at DESC,a.id DESC LIMIT n)v; RETURN result;
 WHEN 'expiredReferences' THEN
 WITH expired AS(SELECT id FROM public.media_assets WHERE expires_at<=now() AND storage_deleted_at IS NULL ORDER BY expires_at,id LIMIT 20 FOR UPDATE SKIP LOCKED),updated AS(
 UPDATE public.media_assets a SET cleanup_started_at=coalesce(cleanup_started_at,now()) FROM expired e WHERE a.id=e.id RETURNING a.*)
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'objectKey',object_key,'mimeType','image/png','width',width,'height',height,'bytes',bytes,'sha256',sha256)),'[]'::jsonb) INTO result FROM updated; RETURN result;
 WHEN 'markReferenceDeleted' THEN
 UPDATE public.media_assets SET storage_deleted_at=now() WHERE id=ident AND expires_at<=now() AND storage_deleted_at IS NULL; RETURN 'true'::jsonb;
 WHEN 'leaseOutbox' THEN
 WITH candidates AS(SELECT o.id FROM public.generation_outbox o JOIN public.generation_job_items i ON i.id=o.item_id
 WHERE(i.status='queued' OR(i.status='running' AND EXISTS(SELECT 1 FROM public.provider_executions e WHERE e.item_id=i.id AND e.phase='polling' AND e.next_poll_at<=now() AND(e.lease_until IS NULL OR e.lease_until<now()))))
 AND o.next_attempt_at<=now() AND(o.lease_expires_at IS NULL OR o.lease_expires_at<now()) ORDER BY o.next_attempt_at LIMIT 20 FOR UPDATE OF o SKIP LOCKED),leased AS(
 UPDATE public.generation_outbox o SET lease_token=gen_random_uuid(),lease_expires_at=now()+interval '30 seconds' FROM candidates c WHERE o.id=c.id RETURNING o.*)
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'itemId',item_id,'leaseToken',lease_token)),'[]'::jsonb) INTO result FROM leased; RETURN result;
 WHEN 'ackOutbox' THEN
 UPDATE public.generation_outbox SET dispatched_at=coalesce(dispatched_at,now()),next_attempt_at=now()+interval '30 seconds',lease_token=null,lease_expires_at=null WHERE id=ident AND lease_token=(p_args->>'leaseToken')::uuid; RETURN 'true'::jsonb;
 WHEN 'claim' THEN
 lease_ms:=least(greatest((p_args->>'leaseMs')::integer,1000),90000);
 SELECT i.job_id INTO v_job_id FROM public.generation_job_items i WHERE i.id=v_item_id AND(i.status='queued' OR(i.status='running' AND EXISTS(SELECT 1 FROM public.provider_executions e WHERE e.item_id=i.id AND e.phase='polling' AND e.next_poll_at<=now() AND(e.lease_until IS NULL OR e.lease_until<now()))));
 IF v_job_id IS NULL THEN RETURN NULL; END IF;
 PERFORM id FROM public.generation_jobs WHERE id=v_job_id FOR UPDATE;
 SELECT i.id,i.position,i.job_id,j.organization_id,j.user_id,j.input,j.provider_model,j.provider_snapshot,e.phase,e.task_id,e.status_path,e.deadline_at,e.poll_failures INTO r
 FROM public.generation_job_items i JOIN public.generation_jobs j ON j.id=i.job_id LEFT JOIN public.provider_executions e ON e.item_id=i.id
 WHERE i.id=v_item_id AND(i.status='queued' OR(i.status='running' AND e.phase='polling' AND e.next_poll_at<=now() AND(e.lease_until IS NULL OR e.lease_until<now()))) FOR UPDATE OF i SKIP LOCKED;
 IF NOT FOUND THEN RETURN NULL; END IF;
 token:=gen_random_uuid(); snap:=r.provider_snapshot;
 IF snap IS NOT NULL THEN
 deadline:=coalesce(r.deadline_at,now()+(snap->>'taskTimeoutSeconds')::integer*interval '1 second');
 INSERT INTO public.provider_executions(item_id,phase,deadline_at,lease_until) VALUES(v_item_id,'submitting',deadline,now()+lease_ms*interval '1 millisecond')
 ON CONFLICT(item_id) DO UPDATE SET lease_until=excluded.lease_until,next_poll_at=CASE WHEN provider_executions.phase='polling' THEN provider_executions.next_poll_at ELSE null END,poll_count=provider_executions.poll_count+1;
 END IF;
 UPDATE public.generation_job_items SET status='running',worker_id=p_args->>'workerId',execution_token=token,provider=coalesce(snap->>'adapter','vakv'),attempts=attempts+CASE WHEN status='queued' THEN 1 ELSE 0 END,started_at=coalesce(started_at,now()),lease_expires_at=now()+lease_ms*interval '1 millisecond' WHERE id=v_item_id;
 UPDATE public.generation_jobs SET status='running',updated_at=now() WHERE id=v_job_id;
 PERFORM public._lycobo_event(r.organization_id,'task',v_job_id);
 RETURN jsonb_build_object('itemId',v_item_id,'position',r.position,'jobId',v_job_id,'organizationId',r.organization_id,'userId',r.user_id,'executionToken',token,'input',r.input,'providerModel',coalesce(r.provider_model,r.input->>'model'),
 'configuredProvider',CASE WHEN snap IS NULL THEN null ELSE jsonb_build_object('snapshot',snap,'phase',coalesce(r.phase,'submitting'),'taskId',r.task_id,'statusPath',r.status_path,'deadlineAt',deadline,'pollFailures',coalesce(r.poll_failures,0)) END);
 WHEN 'deferProvider' THEN
 delay_ms:=greatest(2000,least((p_args->>'delayMs')::integer,60000));
 UPDATE public.generation_job_items SET provider_request_id=coalesce(p_args->>'requestId',provider_request_id),lease_expires_at=(SELECT deadline_at+interval '1 minute' FROM public.provider_executions e WHERE e.item_id=v_item_id)
 WHERE id=v_item_id AND status='running' AND execution_token=token RETURNING id INTO affected;
 IF affected IS NULL THEN RETURN 'true'::jsonb; END IF;
 UPDATE public.provider_executions SET poll_failures=CASE WHEN coalesce((p_args->>'failed')::boolean,false) THEN poll_failures+1 ELSE 0 END,phase='polling',task_id=p_args->>'taskId',status_path=p_args->>'statusPath',next_poll_at=now()+delay_ms*interval '1 millisecond',lease_until=null WHERE provider_executions.item_id=v_item_id;
 UPDATE public.generation_outbox SET next_attempt_at=now()+delay_ms*interval '1 millisecond',lease_token=null,lease_expires_at=null WHERE generation_outbox.item_id=v_item_id; RETURN 'true'::jsonb;
 WHEN 'finish' THEN
 PERFORM id FROM public.generation_jobs WHERE id=v_job_id FOR UPDATE;
 SELECT i.status INTO phase FROM public.generation_job_items i WHERE i.id=v_item_id AND i.job_id=v_job_id AND i.execution_token=token AND i.superseded_at IS NULL FOR UPDATE;
 input:=p_args->'result';
 IF phase IS NULL OR(phase<>'running' AND NOT(phase='needs_reconciliation' AND input ? 'image')) THEN RETURN 'false'::jsonb; END IF;
 SELECT * INTO STRICT v_job FROM public.generation_jobs WHERE id=v_job_id;
 IF input ? 'image' THEN
 snap:=input->'image'; new_id:=(snap->>'id')::uuid;
 INSERT INTO public.media_assets(id,organization_id,user_id,kind,media_type,object_key,mime_type,width,height,bytes,sha256)
 VALUES(new_id,v_job.organization_id,v_job.user_id,'output','image',snap->>'objectKey','image/png',(snap->>'width')::integer,(snap->>'height')::integer,(snap->>'bytes')::integer,snap->>'sha256');
 UPDATE public.generation_job_items SET status='succeeded',error_code=null,output_asset_id=new_id,provider_request_id=coalesce(input->>'requestId',provider_request_id),completed_at=now() WHERE id=v_item_id;
 ELSE
 UPDATE public.generation_job_items SET status=CASE WHEN(input->>'unknown')::boolean AND input->>'errorCode'<>'PROVIDER_INVALID_IMAGE_RESPONSE' THEN 'needs_reconciliation' ELSE 'failed' END,error_code=input->>'errorCode',provider_request_id=coalesce(input->>'requestId',provider_request_id),completed_at=now() WHERE id=v_item_id;
 IF NOT(input->>'unknown')::boolean OR input->>'errorCode'='PROVIDER_INVALID_IMAGE_RESPONSE' THEN PERFORM public._lycobo_refund(v_job_id,v_item_id); END IF;
 END IF;
 PERFORM public._lycobo_refresh(v_job_id); RETURN 'true'::jsonb;
 WHEN 'providerCipher' THEN
 SELECT to_jsonb(ciphertext) INTO result FROM public.model_credentials WHERE id=ident; RETURN result;
 WHEN 'pruneEvents' THEN
 DELETE FROM public.generation_events WHERE id IN(SELECT id FROM public.generation_events WHERE created_at<now()-interval '7 days' ORDER BY created_at LIMIT 1000); RETURN 'true'::jsonb;
 WHEN 'settleInvalidResponses','expireClaims' THEN
 IF p_operation='expireClaims' THEN PERFORM public._lycobo_expire(); END IF;
 FOR r IN SELECT id,job_id FROM public.generation_job_items WHERE status='needs_reconciliation' AND error_code='PROVIDER_INVALID_IMAGE_RESPONSE' AND superseded_at IS NULL ORDER BY job_id,id LIMIT 100 LOOP
 PERFORM id FROM public.generation_jobs WHERE id=r.job_id FOR UPDATE;
 UPDATE public.generation_job_items SET status='failed',reconciliation_evidence='Invalid response: no usable image delivered',completed_at=coalesce(completed_at,now()) WHERE id=r.id AND status='needs_reconciliation' AND error_code='PROVIDER_INVALID_IMAGE_RESPONSE' RETURNING id INTO affected;
 IF affected IS NOT NULL THEN PERFORM public._lycobo_refund(r.job_id,r.id); PERFORM public._lycobo_refresh(r.job_id); END IF;
 END LOOP;
 IF p_operation='expireClaims' THEN
 FOR r IN SELECT i.id,i.job_id FROM public.generation_job_items i WHERE status='running' AND lease_expires_at<now() AND NOT EXISTS(SELECT 1 FROM public.provider_executions e WHERE e.item_id=i.id AND e.phase='polling' AND e.task_id IS NOT NULL AND e.status_path IS NOT NULL AND e.next_poll_at IS NOT NULL AND e.deadline_at>now()) ORDER BY i.job_id,i.id LIMIT 100 LOOP
 PERFORM id FROM public.generation_jobs WHERE id=r.job_id FOR UPDATE;
 UPDATE public.generation_job_items SET status='needs_reconciliation',error_code='WORKER_OUTCOME_UNKNOWN',completed_at=now() WHERE id=r.id AND status='running' AND lease_expires_at<now();
 PERFORM public._lycobo_refresh(r.job_id);
 END LOOP; END IF;
 RETURN 'true'::jsonb;
 WHEN 'eventsLatest' THEN
 RETURN to_jsonb(coalesce((SELECT id::text FROM public.generation_events WHERE organization_id=org ORDER BY id DESC LIMIT 1),'0'));
 WHEN 'eventsSince' THEN
 SELECT coalesce(jsonb_agg(to_jsonb(v)),'[]'::jsonb) INTO result FROM(SELECT id::text,kind,resource_id AS "resourceId" FROM public.generation_events WHERE organization_id=org AND id>(p_args->>'after')::bigint ORDER BY id LIMIT 201)v; RETURN result;
 WHEN 'providerRetryCandidates' THEN
 SELECT coalesce(jsonb_agg(jsonb_build_object('itemId',i.id,'taskId',e.task_id,'statusPath',e.status_path,'snapshot',j.provider_snapshot,'input',j.input)),'[]'::jsonb) INTO result
 FROM public.generation_jobs j JOIN public.generation_job_items i ON i.job_id=j.id JOIN public.provider_executions e ON e.item_id=i.id
 WHERE j.id=v_job_id AND j.organization_id=org AND i.superseded_at IS NULL AND i.status IN('failed','needs_reconciliation') AND e.task_id IS NOT NULL AND e.status_path IS NOT NULL AND(v_item_id IS NULL OR i.id=v_item_id); RETURN result;
 WHEN 'resumeProvider' THEN
 PERFORM id FROM public.generation_jobs WHERE id=v_job_id AND organization_id=org FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
 UPDATE public.generation_job_items SET status='running',error_code=null,completed_at=null,execution_token=gen_random_uuid(),lease_expires_at=null,started_at=now(),reconciled_by=usr,
 reconciliation_evidence='User retry verified the original provider task; resume result retrieval without new generation or charge'
 WHERE id=v_item_id AND job_id=v_job_id AND superseded_at IS NULL AND status IN('failed','needs_reconciliation') RETURNING id INTO affected;
 IF affected IS NULL THEN RETURN 'true'::jsonb; END IF;
 UPDATE public.provider_executions SET phase='polling',deadline_at=now()+interval '3 minutes',next_poll_at=now(),lease_until=null,poll_failures=0 WHERE item_id=v_item_id;
 UPDATE public.generation_outbox SET next_attempt_at=now(),lease_token=null,lease_expires_at=null WHERE item_id=v_item_id;
 PERFORM public._lycobo_refresh(v_job_id); RETURN 'true'::jsonb;
 WHEN 'retry' THEN
 PERFORM user_id FROM public.organization_members WHERE organization_id=org AND user_id=usr FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 SELECT * INTO v_job FROM public.generation_jobs WHERE id=v_job_id AND organization_id=org FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
 SELECT g.job_id,g.target_item_id INTO r FROM public.generation_retries g WHERE organization_id=org AND user_id=usr AND idempotency_key=(p_args->>'key')::uuid;
 IF FOUND THEN
 IF r.job_id<>v_job_id OR r.target_item_id IS DISTINCT FROM v_item_id THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
 RETURN jsonb_build_object('id',v_job_id,'replayed',true); END IF;
 PERFORM id FROM public.generation_job_items WHERE job_id=v_job_id AND superseded_at IS NULL ORDER BY position FOR UPDATE;
 IF v_item_id IS NULL AND EXISTS(SELECT 1 FROM public.generation_job_items WHERE job_id=v_job_id AND superseded_at IS NULL AND status IN('queued','running')) THEN RAISE EXCEPTION 'STATE_CONFLICT'; END IF;
 SELECT array_agg(id ORDER BY position) INTO failed_ids FROM public.generation_job_items WHERE job_id=v_job_id AND superseded_at IS NULL AND(v_item_id IS NULL OR id=v_item_id) AND status IN('failed','needs_reconciliation');
 IF failed_ids IS NULL THEN RAISE EXCEPTION 'STATE_CONFLICT'; END IF;
 IF coalesce((p_args->>'requireManaged')::boolean,false) AND(v_job.provider_snapshot IS NULL OR NOT EXISTS(SELECT 1 FROM public.generation_job_items WHERE job_id=v_job_id AND superseded_at IS NULL AND status<>'failed')) THEN
 IF EXISTS(SELECT 1 FROM public.generation_job_items WHERE job_id=v_job_id AND superseded_at IS NULL AND status IN('queued','running')) THEN RAISE EXCEPTION 'STATE_CONFLICT'; END IF;
 IF snap IS NULL OR snap='null'::jsonb THEN RAISE EXCEPTION 'MODEL_CAPABILITY_UNVERIFIED'; END IF;
 IF v_job.provider_snapshot IS NOT NULL THEN UPDATE public.generation_job_items SET reconciliation_evidence=concat_ws('; ',reconciliation_evidence,'Explicit retry adopted current routing; prior provider snapshot: '||v_job.provider_snapshot::text) WHERE job_id=v_job_id AND superseded_at IS NULL; END IF;
 UPDATE public.generation_jobs SET provider_snapshot=snap,provider_model=p_args->>'providerModel' WHERE id=v_job_id;
 END IF;
 FOREACH wanted_item IN ARRAY failed_ids LOOP
 UPDATE public.generation_job_items SET status='failed',reconciled_by=usr,reconciliation_evidence='User requested retry; prior provider outcome remains unconfirmed; undelivered attempt retired',completed_at=coalesce(completed_at,now()) WHERE id=wanted_item AND status='needs_reconciliation';
 PERFORM public._lycobo_refund(v_job_id,wanted_item);
 END LOOP;
 v_wallet:=public._lycobo_wallet(org,usr);
 IF v_wallet.balance<2*cardinality(failed_ids) THEN RAISE EXCEPTION 'INSUFFICIENT_CREDITS'; END IF;
 INSERT INTO public.generation_retries(organization_id,user_id,job_id,idempotency_key,target_item_id) VALUES(org,usr,v_job_id,(p_args->>'key')::uuid,v_item_id);
 FOR r IN SELECT id,position FROM public.generation_job_items WHERE id=ANY(failed_ids) ORDER BY position LOOP
 UPDATE public.generation_job_items SET superseded_at=now() WHERE id=r.id;
 new_id:=gen_random_uuid();
 INSERT INTO public.generation_job_items(id,job_id,organization_id,position) VALUES(new_id,v_job_id,org,r.position);
 PERFORM public._lycobo_entry(v_wallet.id,'consume:'||new_id::text,'consume',-2,usr,v_job_id,new_id);
 INSERT INTO public.generation_outbox(item_id) VALUES(new_id);
 END LOOP;
 PERFORM public._lycobo_refresh(v_job_id); RETURN jsonb_build_object('id',v_job_id,'replayed',false);
 WHEN 'reconcile' THEN
 PERFORM user_id FROM public.organization_members WHERE organization_id=org AND user_id=usr AND role='admin' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 PERFORM id FROM public.generation_jobs WHERE id=v_job_id AND organization_id=org FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
 UPDATE public.generation_job_items SET status='failed',error_code='RECONCILED_FAILED',reconciled_by=usr,reconciliation_evidence=p_args->>'evidence',completed_at=now()
 WHERE id=v_item_id AND job_id=v_job_id AND status='needs_reconciliation' RETURNING id INTO affected;
 IF affected IS NULL THEN RAISE EXCEPTION 'STATE_CONFLICT'; END IF;
 PERFORM public._lycobo_refund(v_job_id,v_item_id); PERFORM public._lycobo_refresh(v_job_id); RETURN 'true'::jsonb;
 WHEN 'variationBegin' THEN
 PERFORM user_id FROM public.organization_members WHERE organization_id=org AND user_id=usr FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
 UPDATE public.variation_plans SET status='uncertain',error_code='PLANNER_OUTCOME_UNKNOWN' WHERE organization_id=org AND user_id=usr AND status='running' AND created_at<now()-interval '120 seconds';
 SELECT to_jsonb(v) INTO result FROM public.variation_plans v WHERE organization_id=org AND user_id=usr AND idempotency_key=(p_args->>'key')::uuid;
 IF result IS NOT NULL THEN
 IF result->>'input_hash'<>input_hash THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
 RETURN jsonb_build_object('plan',result,'replayed',true); END IF;
 IF(SELECT count(*) FROM public.variation_plans WHERE organization_id=org AND user_id=usr AND created_at>now()-interval '1 minute')>=3 THEN RAISE EXCEPTION 'RATE_LIMITED'; END IF;
 SELECT coalesce(array_agg(value::uuid),ARRAY[]::uuid[]) INTO refs FROM jsonb_array_elements_text(input->'referenceAssetIds');
 IF(SELECT count(*) FROM public.media_assets WHERE organization_id=org AND id=ANY(refs) AND(expires_at IS NULL OR expires_at>now()) AND cleanup_started_at IS NULL)<>cardinality(refs) THEN RAISE EXCEPTION 'REFERENCE_NOT_FOUND'; END IF;
 INSERT INTO public.variation_plans(organization_id,user_id,idempotency_key,input_hash,input) VALUES(org,usr,(p_args->>'key')::uuid,input_hash,input) RETURNING to_jsonb(variation_plans) INTO result;
 RETURN jsonb_build_object('plan',result,'replayed',false);
 WHEN 'variationGet' THEN
 UPDATE public.variation_plans SET status='uncertain',error_code='PLANNER_OUTCOME_UNKNOWN' WHERE id=ident AND organization_id=org AND user_id=usr AND status='running' AND created_at<now()-interval '120 seconds';
 SELECT to_jsonb(v) INTO result FROM public.variation_plans v WHERE id=ident AND organization_id=org AND user_id=usr; RETURN result;
 WHEN 'variationFinish' THEN
 UPDATE public.variation_plans SET status=CASE WHEN p_args->>'errorCode' IS NULL THEN 'ready' WHEN p_args->>'errorCode'='PLANNER_OUTCOME_UNKNOWN' THEN 'uncertain' ELSE 'failed' END,items=p_args->'items',error_code=p_args->>'errorCode'
 WHERE id=ident AND organization_id=org AND user_id=usr AND status='running'; RETURN 'true'::jsonb;
 ELSE RAISE EXCEPTION 'INVALID_OPERATION';
 END CASE;
END $$;

REVOKE ALL ON FUNCTION public._lycobo_event(uuid,text,uuid),public._lycobo_refresh(uuid),public._lycobo_wallet(uuid,uuid),public._lycobo_entry(uuid,text,text,integer,uuid,uuid,uuid),public._lycobo_refund(uuid,uuid),public._lycobo_job_view(uuid),public._lycobo_expire(uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.lycobo_image_operation(text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lycobo_image_operation(text,jsonb) TO service_role;
