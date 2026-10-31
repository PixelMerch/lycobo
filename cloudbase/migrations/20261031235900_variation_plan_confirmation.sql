-- 修复计划确认时 input 变量与 variation_plans.input 列同名造成的 42702。
-- 仅替换已存在函数的这一条查询，保留所有者、SECURITY DEFINER、search_path 和权限。
DO $migration$
DECLARE
  definition text := pg_get_functiondef('public.lycobo_image_operation(text,jsonb)'::regprocedure);
  previous_query text := $query$SELECT v.input,v.status INTO r FROM public.variation_plans v WHERE id=(input->'variation'->>'planId')::uuid AND organization_id=org AND user_id=usr;$query$;
  corrected_query text := $query$SELECT v.input,v.status INTO r FROM public.variation_plans v WHERE v.id=(p_args->'input'->'variation'->>'planId')::uuid AND v.organization_id=org AND v.user_id=usr;$query$;
BEGIN
  IF (length(definition) - length(replace(definition, previous_query, ''))) <> length(previous_query) THEN
    RAISE EXCEPTION 'Unexpected image RPC definition; review the migration before applying';
  END IF;
  EXECUTE replace(definition, previous_query, corrected_query);
END;
$migration$;
