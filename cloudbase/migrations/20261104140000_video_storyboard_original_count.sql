-- Keep the ordered product-image count in history alongside the provider input.
DO $$
DECLARE
 definition text := pg_catalog.pg_get_functiondef('public.lycobo_video_operation(text,jsonb)'::regprocedure);
 previous text := $value$ELSE '{}'::jsonb END,'Minimax-h3-933特价'$value$;
 replacement text := $value$ELSE '{}'::jsonb END ||
    CASE WHEN p_args ? 'storyboardOriginalImageCount'
      THEN jsonb_build_object('storyboardOriginalImageCount',p_args->'storyboardOriginalImageCount')
      ELSE '{}'::jsonb END,'Minimax-h3-933特价'$value$;
BEGIN
 IF position(previous IN definition)=0 THEN
  RAISE EXCEPTION 'Video history migration could not locate storyboard metadata';
 END IF;
 EXECUTE replace(definition,previous,replacement);
END $$;
