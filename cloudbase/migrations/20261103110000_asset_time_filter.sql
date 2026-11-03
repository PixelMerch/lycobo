-- Filter creation time before cursor pagination; preserve organization scoping and privileges.
DO $migration$
DECLARE
 definition text:=pg_get_functiondef('public.lycobo_image_operation(text,jsonb)'::regprocedure);
 previous text:=$q$AND(p_args->>'type' IS NULL OR a.media_type=p_args->>'type')$q$;
BEGIN
 IF (length(definition)-length(replace(definition,previous,'')))<>length(previous) THEN
   RAISE EXCEPTION 'Unexpected listAssets type filter';
 END IF;
 EXECUTE replace(definition,previous,previous||$q$
 AND(p_args->>'since' IS NULL OR a.created_at>=(p_args->>'since')::timestamptz)$q$);
END $migration$;
