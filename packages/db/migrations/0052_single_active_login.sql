-- 在旧应用仍可登录时，先阻止新会话写入，再清理历史并建立约束。
SET LOCAL lock_timeout = '3s';--> statement-breakpoint
LOCK TABLE public.enterprise_sessions IN SHARE ROW EXCLUSIVE MODE;--> statement-breakpoint

WITH ranked_sessions AS (
  SELECT id, row_number() OVER (
    PARTITION BY account_id, social_account_id
    ORDER BY expires_at > now() DESC, created_at DESC, id DESC
  ) AS position
  FROM public.enterprise_sessions
  WHERE revoked_at IS NULL
)
UPDATE public.enterprise_sessions AS session
SET revoked_at = now()
FROM ranked_sessions AS ranked
WHERE session.id = ranked.id AND ranked.position > 1;--> statement-breakpoint

-- 在签发事务内锁定登录账号，再撤销旧会话。刷新只更新原会话，不触发替换。
CREATE FUNCTION public.replace_active_login_session() RETURNS trigger
LANGUAGE plpgsql VOLATILE SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF NEW.account_id IS NOT NULL THEN
    PERFORM 1 FROM public.enterprise_accounts WHERE id = NEW.account_id FOR NO KEY UPDATE;
    UPDATE public.enterprise_sessions SET revoked_at = clock_timestamp()
      WHERE account_id = NEW.account_id AND revoked_at IS NULL;
  ELSE
    PERFORM 1 FROM public.social_accounts WHERE id = NEW.social_account_id FOR NO KEY UPDATE;
    UPDATE public.enterprise_sessions SET revoked_at = clock_timestamp()
      WHERE social_account_id = NEW.social_account_id AND revoked_at IS NULL;
  END IF;
  RETURN NEW;
END $$;--> statement-breakpoint

CREATE TRIGGER enterprise_sessions_replace_active BEFORE INSERT ON public.enterprise_sessions
FOR EACH ROW WHEN (NEW.revoked_at IS NULL)
EXECUTE FUNCTION public.replace_active_login_session();--> statement-breakpoint
REVOKE ALL ON FUNCTION public.replace_active_login_session() FROM PUBLIC;--> statement-breakpoint

CREATE UNIQUE INDEX "enterprise_sessions_active_account_uidx" ON "enterprise_sessions" USING btree ("account_id") WHERE "enterprise_sessions"."account_id" is not null and "enterprise_sessions"."revoked_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "enterprise_sessions_active_social_uidx" ON "enterprise_sessions" USING btree ("social_account_id") WHERE "enterprise_sessions"."social_account_id" is not null and "enterprise_sessions"."revoked_at" is null;
