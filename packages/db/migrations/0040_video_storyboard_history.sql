-- Store history-only storyboard metadata alongside the unchanged provider input.
DO $$
DECLARE
 definition text := pg_catalog.pg_get_functiondef('public.lycobo_video_operation(text,jsonb)'::regprocedure);
 previous text := $value$jsonb_build_object('video',payload),'Minimax-h3-933特价'$value$;
 replacement text := $value$jsonb_build_object('video',payload) ||
    CASE WHEN p_args ? 'storyboard' THEN jsonb_build_object('storyboard',p_args->'storyboard')
      ELSE '{}'::jsonb END,'Minimax-h3-933特价'$value$;
BEGIN
 IF position(previous IN definition)=0 THEN
  RAISE EXCEPTION 'Video history migration could not locate task input';
 END IF;
 EXECUTE replace(definition,previous,replacement);
END $$;
