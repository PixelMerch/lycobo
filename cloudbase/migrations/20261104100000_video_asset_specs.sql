-- Asset tiles show a video's duration and resolution without loading the MP4.
DO $migration$
DECLARE
 definition text:=pg_get_functiondef('public.lycobo_image_operation(text,jsonb)'::regprocedure);
 previous text:=$q$j.public_id AS task_public_id,$q$;
BEGIN
 IF (length(definition)-length(replace(definition,previous,'')))<>length(previous) THEN
   RAISE EXCEPTION 'Unexpected listAssets columns';
 END IF;
 EXECUTE replace(definition,previous,previous||$q$(j.input->'video'->>'seconds')::integer AS duration_seconds,j.resolution,$q$);
END $migration$;
