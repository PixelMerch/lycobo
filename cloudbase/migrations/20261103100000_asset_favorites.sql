-- Asset library: per-member favorites plus tool, model and favorite filters on listAssets.
-- Mirrors packages/db migration 0038; IF NOT EXISTS keeps the local isolated check idempotent.
CREATE TABLE IF NOT EXISTS "image_asset_favorites" (
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "image_asset_favorites_pk" PRIMARY KEY("organization_id","user_id","asset_id")
);
--> statement-breakpoint
ALTER TABLE "image_asset_favorites" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='image_asset_favorites_asset_org_fk') THEN ALTER TABLE "image_asset_favorites" ADD CONSTRAINT "image_asset_favorites_asset_org_fk" FOREIGN KEY ("asset_id","organization_id") REFERENCES "public"."media_assets"("id","organization_id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='image_asset_favorites_member_fk') THEN ALTER TABLE "image_asset_favorites" ADD CONSTRAINT "image_asset_favorites_member_fk" FOREIGN KEY ("organization_id","user_id") REFERENCES "public"."organization_members"("organization_id","user_id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "image_asset_favorites_recent_idx" ON "image_asset_favorites" USING btree ("organization_id","user_id","created_at" DESC NULLS LAST,"asset_id" DESC NULLS LAST);
--> statement-breakpoint
-- The runtime key reaches favorites only through the fixed image RPC, never the table itself.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON public.image_asset_favorites FROM anon; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON public.image_asset_favorites FROM authenticated; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN REVOKE ALL ON public.image_asset_favorites FROM service_role; END IF;
END $$;

-- Patch the existing dispatcher in place: each fragment must appear exactly once, so earlier RPC
-- fixes, SECURITY DEFINER, search_path, owner and privileges are preserved.
DO $migration$
DECLARE
 definition text:=pg_get_functiondef('public.lycobo_image_operation(text,jsonb)'::regprocedure);
 previous text; replacement text;
BEGIN
 -- New operations require an authenticated organization member like the other scoped reads.
 previous:=$q$'assetLocations','listAssets','providerRetryCandidates'$q$;
 replacement:=$q$'assetLocations','listAssets','setAssetFavorite','favoriteAssetIds','providerRetryCandidates'$q$;
 IF (length(definition)-length(replace(definition,previous,'')))<>length(previous) THEN RAISE EXCEPTION 'Unexpected scoped operation list'; END IF;
 definition:=replace(definition,previous,replacement);

 -- listAssets returns the producing tool and the member's favorite flag.
 previous:=$q$j.public_id AS task_public_id,$q$;
 replacement:=$q$j.public_id AS task_public_id,CASE WHEN j.id IS NULL THEN NULL WHEN j.input ? 'textileSet' THEN 'textile' WHEN j.input ? 'variation' THEN 'variation' ELSE 'create' END AS tool,EXISTS(SELECT 1 FROM public.image_asset_favorites f WHERE f.organization_id=a.organization_id AND f.user_id=usr AND f.asset_id=a.id) AS favorite,$q$;
 IF (length(definition)-length(replace(definition,previous,'')))<>length(previous) THEN RAISE EXCEPTION 'Unexpected listAssets columns'; END IF;
 definition:=replace(definition,previous,replacement);

 -- Tool, public model and favorite filters run before pagination.
 previous:=$q$AND(p_args->>'kind' IS NULL OR a.kind=p_args->>'kind') AND(p_args->>'type' IS NULL OR a.media_type=p_args->>'type')$q$;
 replacement:=previous||$q$
 AND(p_args->>'tool' IS NULL OR(j.id IS NOT NULL AND CASE p_args->>'tool' WHEN 'textile' THEN j.input ? 'textileSet' WHEN 'variation' THEN j.input ? 'variation' ELSE NOT(j.input ? 'textileSet') AND NOT(j.input ? 'variation') END))
 AND(p_args->>'model' IS NULL OR CASE WHEN j.model IN('nano-banana-2.1','gemini-nano-banana-2.1') THEN 'nano-banana-2.1' WHEN j.model IN('gpt-image-2.5','gpt-image-2.5-flare','gpt-image-2.5-sunburst') THEN 'gpt-image-2.5' WHEN j.model IN('gpt-image-2','gpt-image-2-4K') THEN 'gpt-image-2' ELSE j.model END=p_args->>'model')
 AND(NOT coalesce((p_args->>'favorite')::boolean,false) OR EXISTS(SELECT 1 FROM public.image_asset_favorites f WHERE f.organization_id=a.organization_id AND f.user_id=usr AND f.asset_id=a.id))$q$;
 IF (length(definition)-length(replace(definition,previous,'')))<>length(previous) THEN RAISE EXCEPTION 'Unexpected listAssets filters'; END IF;
 definition:=replace(definition,previous,replacement);

 -- Favorites: idempotent set/unset with a per-member limit, and the bounded id list.
 previous:=$q$ WHEN 'expiredReferences' THEN$q$;
 replacement:=$q$ WHEN 'setAssetFavorite' THEN
 IF NOT EXISTS(SELECT 1 FROM public.media_assets WHERE id=ident AND organization_id=org AND(expires_at IS NULL OR expires_at>now()) AND storage_deleted_at IS NULL) THEN RETURN NULL; END IF;
 IF NOT coalesce((p_args->>'favorite')::boolean,false) THEN
 DELETE FROM public.image_asset_favorites WHERE organization_id=org AND user_id=usr AND asset_id=ident; RETURN 'false'::jsonb;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(org::text||':'||usr::text,71421));
 IF EXISTS(SELECT 1 FROM public.image_asset_favorites WHERE organization_id=org AND user_id=usr AND asset_id=ident) THEN RETURN 'true'::jsonb; END IF;
 IF(SELECT count(*) FROM public.image_asset_favorites f JOIN public.media_assets a ON a.id=f.asset_id AND a.organization_id=f.organization_id
 WHERE f.organization_id=org AND f.user_id=usr AND(a.expires_at IS NULL OR a.expires_at>now()) AND a.storage_deleted_at IS NULL)>=1000 THEN RAISE EXCEPTION 'STATE_CONFLICT'; END IF;
 INSERT INTO public.image_asset_favorites(organization_id,user_id,asset_id) VALUES(org,usr,ident) ON CONFLICT DO NOTHING; RETURN 'true'::jsonb;
 WHEN 'favoriteAssetIds' THEN
 SELECT coalesce(jsonb_agg(v.asset_id ORDER BY v.created_at DESC,v.asset_id DESC),'[]'::jsonb) INTO result FROM(
 SELECT f.asset_id,f.created_at FROM public.image_asset_favorites f JOIN public.media_assets a ON a.id=f.asset_id AND a.organization_id=f.organization_id
 WHERE f.organization_id=org AND f.user_id=usr AND(a.expires_at IS NULL OR a.expires_at>now()) AND a.storage_deleted_at IS NULL
 ORDER BY f.created_at DESC,f.asset_id DESC LIMIT 1000)v; RETURN result;
 WHEN 'expiredReferences' THEN$q$;
 IF (length(definition)-length(replace(definition,previous,'')))<>length(previous) THEN RAISE EXCEPTION 'Unexpected dispatcher branches'; END IF;
 EXECUTE replace(definition,previous,replacement);
END $migration$;
