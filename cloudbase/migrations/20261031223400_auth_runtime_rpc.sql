-- Fixed server-only operations. Never accept SQL, identifiers, or client owner claims.
CREATE FUNCTION public.lycobo_auth_allow_login(p_account_key text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE consumed integer;
BEGIN
  IF p_account_key !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'INVALID_ACCOUNT_KEY'; END IF;
  INSERT INTO public.login_rate_limits(key,window_start,attempts) VALUES('global',now(),1)
  ON CONFLICT(key) DO UPDATE SET
    attempts=CASE WHEN login_rate_limits.window_start<now()-interval '60 seconds' THEN 1 ELSE login_rate_limits.attempts+1 END,
    window_start=CASE WHEN login_rate_limits.window_start<now()-interval '60 seconds' THEN now() ELSE login_rate_limits.window_start END
  RETURNING attempts INTO consumed;
  IF consumed>200 THEN RETURN false; END IF;
  DELETE FROM public.login_rate_limits WHERE window_start<now()-interval '1 day';
  INSERT INTO public.login_rate_limits(key,window_start,attempts) VALUES(p_account_key,now(),1)
  ON CONFLICT(key) DO UPDATE SET
    attempts=CASE WHEN login_rate_limits.window_start<now()-interval '900 seconds' THEN 1 ELSE login_rate_limits.attempts+1 END,
    window_start=CASE WHEN login_rate_limits.window_start<now()-interval '900 seconds' THEN now() ELSE login_rate_limits.window_start END
  RETURNING attempts INTO consumed;
  RETURN consumed<=10;
END $$;

CREATE FUNCTION public.lycobo_auth_credential(p_account text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT to_jsonb(a) FROM (
    SELECT id,account,user_id,organization_id,password_hash FROM public.enterprise_accounts
    WHERE account=p_account AND disabled_at IS NULL
  ) a;
$$;

CREATE FUNCTION public.lycobo_auth_create_session(p_id uuid,p_account_id uuid,p_password_hash text,p_expires_at timestamptz,p_refresh_hash text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE changed uuid;
BEGIN
  INSERT INTO public.enterprise_sessions(id,account_id,expires_at,credential_version,refresh_token_hash)
  SELECT p_id,id,p_expires_at,credential_version,p_refresh_hash FROM public.enterprise_accounts
  WHERE id=p_account_id AND disabled_at IS NULL AND password_hash=p_password_hash RETURNING id INTO changed;
  RETURN changed IS NOT NULL;
END $$;

CREATE FUNCTION public.lycobo_auth_identity(p_session_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT jsonb_build_object('account',a.account,'userId',a.user_id,'organizationId',a.organization_id,'role',m.role,'uid',u.uid)
  FROM public.enterprise_sessions s JOIN public.enterprise_accounts a ON a.id=s.account_id
  JOIN public.users u ON u.id=a.user_id
  JOIN public.organization_members m ON m.user_id=a.user_id AND m.organization_id=a.organization_id
  WHERE s.id=p_session_id AND s.revoked_at IS NULL AND s.expires_at>now()
    AND a.disabled_at IS NULL AND s.credential_version=a.credential_version;
$$;

CREATE FUNCTION public.lycobo_auth_rotate_refresh(p_current_hash text,p_next_hash text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE result jsonb;
BEGIN
  UPDATE public.enterprise_sessions s SET refresh_token_hash=p_next_hash FROM public.enterprise_accounts a
  WHERE s.refresh_token_hash=p_current_hash AND a.id=s.account_id AND s.revoked_at IS NULL AND s.expires_at>now()
    AND a.disabled_at IS NULL AND s.credential_version=a.credential_version
    AND EXISTS(SELECT 1 FROM public.organization_members m WHERE m.user_id=a.user_id AND m.organization_id=a.organization_id)
  RETURNING jsonb_build_object('id',s.id,'expires_at',s.expires_at) INTO result;
  RETURN result;
END $$;

CREATE FUNCTION public.lycobo_auth_change_password(p_account_id uuid,p_current_hash text,p_password_hash text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE changed uuid;
BEGIN
  UPDATE public.enterprise_accounts SET password_hash=p_password_hash,credential_version=gen_random_uuid()
  WHERE id=p_account_id AND password_hash=p_current_hash AND disabled_at IS NULL RETURNING id INTO changed;
  IF changed IS NULL THEN RETURN false; END IF;
  DELETE FROM public.enterprise_sessions WHERE account_id=p_account_id;
  RETURN true;
END $$;

CREATE FUNCTION public.lycobo_auth_revoke(p_session_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  UPDATE public.enterprise_sessions SET revoked_at=now() WHERE id=p_session_id AND revoked_at IS NULL;
  RETURN true;
END $$;

CREATE FUNCTION public.lycobo_auth_set_credential(p_account text,p_user_id uuid,p_organization_id uuid,p_password_hash text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE changed uuid;
BEGIN
  INSERT INTO public.enterprise_accounts(account,user_id,organization_id,password_hash)
  VALUES(p_account,p_user_id,p_organization_id,p_password_hash)
  ON CONFLICT(account) DO UPDATE SET password_hash=excluded.password_hash,credential_version=gen_random_uuid(),disabled_at=null
  WHERE enterprise_accounts.user_id=excluded.user_id AND enterprise_accounts.organization_id=excluded.organization_id
  RETURNING id INTO changed;
  IF changed IS NULL THEN RAISE EXCEPTION 'ACCOUNT_IDENTITY_CONFLICT'; END IF;
  DELETE FROM public.enterprise_sessions WHERE account_id=changed;
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.lycobo_auth_allow_login(text),public.lycobo_auth_credential(text),
  public.lycobo_auth_create_session(uuid,uuid,text,timestamptz,text),public.lycobo_auth_identity(uuid),
  public.lycobo_auth_rotate_refresh(text,text),public.lycobo_auth_change_password(uuid,text,text),
  public.lycobo_auth_revoke(uuid),public.lycobo_auth_set_credential(text,uuid,uuid,text)
FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lycobo_auth_allow_login(text),public.lycobo_auth_credential(text),
  public.lycobo_auth_create_session(uuid,uuid,text,timestamptz,text),public.lycobo_auth_identity(uuid),
  public.lycobo_auth_rotate_refresh(text,text),public.lycobo_auth_change_password(uuid,text,text),
  public.lycobo_auth_revoke(uuid),public.lycobo_auth_set_credential(text,uuid,uuid,text)
TO service_role;
