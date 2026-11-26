-- Custom SQL migration file, put your code below! --
-- 先部署能识别会话退出消息的主站和图片 Worker，再执行本迁移。
CREATE OR REPLACE FUNCTION public.replace_active_login_session() RETURNS trigger
LANGUAGE plpgsql VOLATILE SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  member_id uuid;
  workspace_id uuid;
BEGIN
  IF NEW.account_id IS NOT NULL THEN
    SELECT user_id, organization_id INTO member_id, workspace_id
      FROM public.enterprise_accounts WHERE id = NEW.account_id FOR NO KEY UPDATE;
  ELSE
    SELECT user_id, organization_id INTO member_id, workspace_id
      FROM public.social_accounts WHERE id = NEW.social_account_id FOR NO KEY UPDATE;
  END IF;

  -- 先撤销原会话，同一事务记录退出通知。已过期的会话无需占用推送。
  WITH replaced AS (
    UPDATE public.enterprise_sessions
    SET revoked_at = clock_timestamp()
    WHERE revoked_at IS NULL
      AND (account_id = NEW.account_id OR social_account_id = NEW.social_account_id)
    RETURNING id, expires_at
  )
  INSERT INTO public.realtime_outbox (channel, user_id, event)
  SELECT workspace_id::text, member_id,
    jsonb_build_object('id', gen_random_uuid(), 'kind', 'session-revoked', 'resourceId', id)
  FROM replaced
  WHERE expires_at > clock_timestamp();

  RETURN NEW;
END $$;
