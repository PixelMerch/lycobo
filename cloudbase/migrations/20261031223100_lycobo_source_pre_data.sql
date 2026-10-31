-- Business snapshot only; source public/drizzle schema. No CloudBase system objects.
SET LOCAL check_function_bodies = false;





CREATE SCHEMA drizzle;









CREATE TYPE public.item_status AS ENUM (
    'queued',
    'running',
    'succeeded',
    'failed',
    'cancelled'
);



CREATE TYPE public.task_status AS ENUM (
    'queued',
    'running',
    'succeeded',
    'partially_failed',
    'failed',
    'cancelled'
);



CREATE FUNCTION public.allocate_public_identifier(identifier_kind text) RETURNS text
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
DECLARE
  alphabet text;
  prefix text;
  body_length integer;
  candidate text;
  entropy bytea;
  byte_index integer;
  byte_value integer;
  alphabet_length integer;
  attempt integer;
BEGIN
  CASE identifier_kind
    WHEN 'user' THEN alphabet := '0123456789'; prefix := ''; body_length := 10;
    WHEN 'task' THEN alphabet := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'; prefix := 'W'; body_length := 8;
    WHEN 'image' THEN alphabet := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'; prefix := 'P'; body_length := 8;
    ELSE RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_IDENTIFIER_KIND';
  END CASE;
  alphabet_length := length(alphabet);
  FOR attempt IN 1..32 LOOP
    candidate := prefix;
    WHILE length(candidate) < length(prefix) + body_length LOOP
      -- gen_random_uuid() is already available to UUID defaults. Use only its
      -- uniformly random bytes, skipping the UUID version and variant bytes.
      entropy := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
      FOR byte_index IN 0..15 LOOP
        CONTINUE WHEN byte_index IN (6, 8);
        byte_value := get_byte(entropy, byte_index);
        -- Rejection sampling avoids modulo bias for alphabets of length 10/36.
        IF byte_value < 256 - (256 % alphabet_length) THEN
          candidate := candidate || substr(alphabet, (byte_value % alphabet_length) + 1, 1);
        END IF;
        EXIT WHEN length(candidate) = length(prefix) + body_length;
      END LOOP;
    END LOOP;
    INSERT INTO public.public_identifiers (value) VALUES (candidate)
      ON CONFLICT (value) DO NOTHING;
    IF FOUND THEN RETURN candidate; END IF;
  END LOOP;
  RAISE EXCEPTION USING ERRCODE = '54000', MESSAGE = 'PUBLIC_IDENTIFIER_ALLOCATION_FAILED';
END;
$$;



CREATE FUNCTION public.prevent_wallet_entry_mutation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN RAISE EXCEPTION 'WALLET_LEDGER_IMMUTABLE'; END $$;



CREATE FUNCTION public.validate_wallet_entry_scope() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE org uuid;
BEGIN
 SELECT organization_id INTO org FROM organization_wallets WHERE id=NEW.wallet_id;
 IF NEW.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM organization_members WHERE organization_id=org AND user_id=NEW.user_id)
 THEN RAISE EXCEPTION 'WALLET_MEMBER_MISMATCH'; END IF;
 IF NEW.kind IN ('consume','refund') AND NOT EXISTS (
  SELECT 1 FROM generation_jobs j JOIN generation_job_items i ON i.job_id=j.id
  WHERE j.id=NEW.job_id AND i.id=NEW.item_id AND j.organization_id=org AND j.user_id=NEW.user_id)
 THEN RAISE EXCEPTION 'WALLET_TASK_MISMATCH'; END IF;
 IF NEW.kind='recharge' AND NOT EXISTS (SELECT 1 FROM recharge_orders r WHERE r.id=NEW.recharge_id AND r.wallet_id=NEW.wallet_id AND r.user_id=NEW.user_id AND r.status='paid' AND r.credits=NEW.amount)
 THEN RAISE EXCEPTION 'WALLET_RECHARGE_MISMATCH'; END IF;
 RETURN NEW;
END $$;





CREATE TABLE drizzle.__drizzle_migrations (
    id integer NOT NULL,
    hash text NOT NULL,
    created_at bigint
);



CREATE SEQUENCE drizzle.__drizzle_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



ALTER SEQUENCE drizzle.__drizzle_migrations_id_seq OWNED BY drizzle.__drizzle_migrations.id;



CREATE TABLE public.admin_login_limits (
    subject_hash text NOT NULL,
    attempts integer DEFAULT 1 NOT NULL,
    reset_at timestamp with time zone NOT NULL
);



CREATE TABLE public.admin_menu_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    parent_id uuid,
    title text NOT NULL,
    type text NOT NULL,
    page_id text,
    permission text DEFAULT ''::text NOT NULL,
    icon text DEFAULT 'menu'::text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    visible integer DEFAULT 1 NOT NULL,
    protected integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT admin_menu_flags_check CHECK (((visible = ANY (ARRAY[0, 1])) AND (protected = ANY (ARRAY[0, 1])))),
    CONSTRAINT admin_menu_parent_check CHECK (((parent_id IS NULL) OR (parent_id <> id))),
    CONSTRAINT admin_menu_type_check CHECK ((type = ANY (ARRAY['directory'::text, 'menu'::text, 'button'::text])))
);



CREATE TABLE public.admin_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    permissions jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



CREATE TABLE public.admin_sessions (
    token_hash text NOT NULL,
    administrator_id uuid NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



CREATE TABLE public.admin_user_roles (
    administrator_id uuid NOT NULL,
    role_id uuid NOT NULL
);



CREATE TABLE public.admin_users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account text NOT NULL,
    password_hash text NOT NULL,
    is_super_admin integer DEFAULT 0 NOT NULL,
    disabled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT admin_users_super_admin_check CHECK ((is_super_admin = ANY (ARRAY[0, 1])))
);



CREATE TABLE public.enterprise_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account text NOT NULL,
    user_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    password_hash text NOT NULL,
    credential_version uuid DEFAULT gen_random_uuid() NOT NULL,
    disabled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT enterprise_account_normalized CHECK (((account = lower(TRIM(BOTH FROM account))) AND ((length(account) >= 3) AND (length(account) <= 128))))
);



CREATE TABLE public.enterprise_sessions (
    id uuid NOT NULL,
    account_id uuid NOT NULL,
    credential_version uuid NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    refresh_token_hash text
);



CREATE TABLE public.generation_api_keys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



CREATE TABLE public.generation_credit_ledger (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    job_id uuid NOT NULL,
    item_id uuid,
    event_type text NOT NULL,
    amount integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT generation_credit_ledger_amount_check CHECK ((((event_type = 'reserve'::text) AND (amount < 0)) OR ((event_type = 'refund'::text) AND (amount > 0))))
);



CREATE TABLE public.generation_events (
    id bigint NOT NULL,
    organization_id uuid NOT NULL,
    kind text NOT NULL,
    resource_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT generation_events_kind_check CHECK ((kind = ANY (ARRAY['task'::text, 'asset'::text])))
);



ALTER TABLE public.generation_events ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.generation_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE public.generation_job_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    "position" integer NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    worker_id text,
    execution_token uuid,
    provider text DEFAULT 'vakv'::text NOT NULL,
    provider_request_id text,
    attempts integer DEFAULT 0 NOT NULL,
    output_asset_id uuid,
    error_code text,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    lease_expires_at timestamp with time zone,
    reconciled_by uuid,
    reconciliation_evidence text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    superseded_at timestamp with time zone,
    CONSTRAINT generation_job_items_output_check CHECK (((status <> 'succeeded'::text) OR (output_asset_id IS NOT NULL))),
    CONSTRAINT generation_job_items_position_check CHECK (((("position" >= 0) AND ("position" <= 19)) AND (attempts >= 0))),
    CONSTRAINT generation_job_items_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'running'::text, 'succeeded'::text, 'failed'::text, 'needs_reconciliation'::text])))
);



CREATE TABLE public.generation_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    idempotency_key uuid NOT NULL,
    input_hash text NOT NULL,
    input jsonb NOT NULL,
    model text NOT NULL,
    prompt text NOT NULL,
    resolution text NOT NULL,
    aspect_ratio text NOT NULL,
    requested_count integer NOT NULL,
    unit_credits integer NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    display_number bigint NOT NULL,
    public_id text DEFAULT public.allocate_public_identifier('task'::text) NOT NULL,
    provider_model text,
    provider_snapshot jsonb,
    archived_at timestamp with time zone,
    CONSTRAINT generation_jobs_count_check CHECK ((((requested_count >= 1) AND (requested_count <= 20)) AND (unit_credits > 0) AND ((requested_count <= 4) OR ((requested_count <= 10) AND (input ? 'textileSet'::text)) OR (input ? 'variation'::text)))),
    CONSTRAINT generation_jobs_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'running'::text, 'succeeded'::text, 'partially_failed'::text, 'failed'::text, 'needs_reconciliation'::text])))
);



ALTER TABLE public.generation_jobs ALTER COLUMN display_number ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.generation_jobs_display_number_seq
    START WITH 1000000000
    INCREMENT BY 1
    MINVALUE 1000000000
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE public.generation_outbox (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    item_id uuid NOT NULL,
    next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    lease_token uuid,
    lease_expires_at timestamp with time zone,
    dispatched_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



CREATE TABLE public.generation_retries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    job_id uuid NOT NULL,
    idempotency_key uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    target_item_id uuid
);



CREATE TABLE public.image_local_edits (
    job_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    source_asset_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



CREATE TABLE public.login_rate_limits (
    key text NOT NULL,
    window_start timestamp with time zone NOT NULL,
    attempts integer NOT NULL,
    CONSTRAINT login_rate_limits_attempts_check CHECK ((attempts > 0))
);



CREATE TABLE public.media_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    kind text NOT NULL,
    object_key text NOT NULL,
    mime_type text NOT NULL,
    width integer NOT NULL,
    height integer NOT NULL,
    bytes integer NOT NULL,
    sha256 text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    display_number bigint NOT NULL,
    public_id text DEFAULT public.allocate_public_identifier('image'::text) NOT NULL,
    media_type text DEFAULT 'image'::text NOT NULL,
    expires_at timestamp with time zone,
    cleanup_started_at timestamp with time zone,
    storage_deleted_at timestamp with time zone,
    CONSTRAINT media_assets_dimensions_check CHECK (((width > 0) AND (height > 0) AND (bytes > 0))),
    CONSTRAINT media_assets_kind_check CHECK ((kind = ANY (ARRAY['reference'::text, 'output'::text]))),
    CONSTRAINT media_assets_media_type_check CHECK ((media_type = ANY (ARRAY['image'::text, 'video'::text, 'audio'::text])))
);



ALTER TABLE public.media_assets ALTER COLUMN display_number ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.media_assets_display_number_seq
    START WITH 100000000
    INCREMENT BY 1
    MINVALUE 100000000
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE public.model_audit_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_id uuid,
    action text NOT NULL,
    resource_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    administrator_id uuid
);



CREATE TABLE public.model_catalog (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    category text NOT NULL,
    enabled integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    logo_url text,
    upstream_model text,
    provider_id uuid,
    description text DEFAULT ''::text NOT NULL,
    capability_summary text DEFAULT ''::text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    CONSTRAINT model_catalog_category_check CHECK ((category = ANY (ARRAY['image'::text, 'music'::text, 'video'::text])))
);



CREATE TABLE public.model_channels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_id uuid NOT NULL,
    name text NOT NULL,
    model text NOT NULL,
    settings jsonb NOT NULL,
    enabled integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    key_id uuid
);



CREATE TABLE public.model_credentials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ciphertext text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



CREATE TABLE public.model_planners (
    tool text NOT NULL,
    provider_id uuid NOT NULL,
    origin text NOT NULL,
    upstream_model text NOT NULL,
    enabled integer DEFAULT 0 NOT NULL,
    timeout_ms integer DEFAULT 25000 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    protocol text DEFAULT 'openai-chat'::text NOT NULL,
    CONSTRAINT model_planner_enabled CHECK ((enabled = ANY (ARRAY[0, 1]))),
    CONSTRAINT model_planner_protocol CHECK ((protocol = ANY (ARRAY['openai-chat'::text, 'anthropic-messages'::text]))),
    CONSTRAINT model_planner_timeout CHECK (((timeout_ms >= 5000) AND (timeout_ms <= 60000)))
);



CREATE TABLE public.model_provider_keys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_id uuid NOT NULL,
    credential_id uuid NOT NULL,
    name text NOT NULL,
    enabled integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



CREATE TABLE public.model_providers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    origin text NOT NULL,
    adapter text NOT NULL,
    credential_id uuid NOT NULL,
    enabled integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    website_url text
);



CREATE TABLE public.model_routes (
    tool text NOT NULL,
    model text NOT NULL,
    channel_id uuid NOT NULL
);



CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    task_id uuid NOT NULL,
    event_key text NOT NULL,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



CREATE TABLE public.organization_members (
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text DEFAULT 'member'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT organization_members_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'member'::text])))
);



CREATE TABLE public.organization_wallets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    balance integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT wallet_balance_check CHECK ((balance >= 0))
);



CREATE TABLE public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    available_credits integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT organizations_credits_nonnegative CHECK ((available_credits >= 0))
);



CREATE TABLE public.outbox_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    event_type text NOT NULL,
    payload jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    dispatched_at timestamp with time zone
);



CREATE TABLE public.platform_administrators (
    user_id uuid NOT NULL,
    enabled integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



CREATE TABLE public.projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    name text NOT NULL,
    sku text,
    canvas jsonb DEFAULT '{}'::jsonb NOT NULL,
    canvas_version integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



CREATE TABLE public.provider_executions (
    item_id uuid NOT NULL,
    phase text NOT NULL,
    task_id text,
    status_path text,
    next_poll_at timestamp with time zone,
    lease_until timestamp with time zone,
    deadline_at timestamp with time zone NOT NULL,
    poll_count integer DEFAULT 0 NOT NULL,
    poll_failures integer DEFAULT 0 NOT NULL
);



CREATE TABLE public.public_identifiers (
    value text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



CREATE TABLE public.recharge_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    wallet_id uuid NOT NULL,
    user_id uuid NOT NULL,
    idempotency_key uuid NOT NULL,
    credits integer NOT NULL,
    amount_minor integer NOT NULL,
    currency text DEFAULT 'CNY'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    channel text NOT NULL,
    provider_transaction_id text,
    paid_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT recharge_amount_check CHECK (((credits > 0) AND (amount_minor > 0) AND (currency = 'CNY'::text))),
    CONSTRAINT recharge_paid_check CHECK (((status = 'paid'::text) = ((paid_at IS NOT NULL) AND (provider_transaction_id IS NOT NULL)))),
    CONSTRAINT recharge_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'paid'::text, 'closed'::text])))
);



CREATE TABLE public.task_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    "position" integer NOT NULL,
    status public.item_status DEFAULT 'queued'::public.item_status NOT NULL,
    provider text,
    provider_task_id text,
    output_object_key text,
    error_code text,
    attempts integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT task_items_attempts_check CHECK ((attempts >= 0)),
    CONSTRAINT task_items_position_check CHECK ((("position" >= 0) AND ("position" <= 3))),
    CONSTRAINT task_items_success_output_check CHECK (((status <> 'succeeded'::public.item_status) OR (output_object_key IS NOT NULL)))
);



CREATE TABLE public.tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    project_id uuid NOT NULL,
    idempotency_key uuid NOT NULL,
    input_hash text NOT NULL,
    input jsonb NOT NULL,
    status public.task_status DEFAULT 'queued'::public.task_status NOT NULL,
    requested_count integer NOT NULL,
    viewed_at timestamp with time zone,
    archived_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tasks_count_check CHECK (((requested_count >= 1) AND (requested_count <= 4)))
);



CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_subject text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    uid text DEFAULT public.allocate_public_identifier('user'::text) NOT NULL
);



CREATE TABLE public.variation_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    idempotency_key uuid NOT NULL,
    input_hash text NOT NULL,
    input jsonb NOT NULL,
    status text DEFAULT 'running'::text NOT NULL,
    items jsonb DEFAULT '[]'::jsonb NOT NULL,
    error_code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT variation_plan_status CHECK ((status = ANY (ARRAY['running'::text, 'ready'::text, 'failed'::text, 'uncertain'::text])))
);



CREATE TABLE public.wallet_checkins (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    wallet_id uuid NOT NULL,
    user_id uuid NOT NULL,
    business_date text NOT NULL,
    rule_version text NOT NULL,
    credits integer NOT NULL,
    ledger_id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT wallet_checkin_credits_check CHECK ((credits > 0)),
    CONSTRAINT wallet_checkin_date_check CHECK ((business_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'::text))
);



CREATE TABLE public.wallet_entries (
    id bigint NOT NULL,
    wallet_id uuid NOT NULL,
    user_id uuid,
    event_key text NOT NULL,
    kind text NOT NULL,
    amount integer NOT NULL,
    balance_after integer NOT NULL,
    job_id uuid,
    item_id uuid,
    recharge_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT wallet_entry_amount_check CHECK (((balance_after >= 0) AND (((kind = 'consume'::text) AND (amount < 0)) OR ((kind = ANY (ARRAY['opening'::text, 'recharge'::text, 'refund'::text, 'checkin'::text])) AND (amount > 0))))),
    CONSTRAINT wallet_entry_source_check CHECK ((((kind = ANY (ARRAY['consume'::text, 'refund'::text])) AND (job_id IS NOT NULL) AND (item_id IS NOT NULL) AND (recharge_id IS NULL)) OR ((kind = 'recharge'::text) AND (recharge_id IS NOT NULL) AND (job_id IS NULL) AND (item_id IS NULL)) OR ((kind = ANY (ARRAY['opening'::text, 'checkin'::text])) AND (job_id IS NULL) AND (item_id IS NULL) AND (recharge_id IS NULL))))
);



ALTER TABLE public.wallet_entries ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.wallet_entries_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE ONLY drizzle.__drizzle_migrations ALTER COLUMN id SET DEFAULT nextval('drizzle.__drizzle_migrations_id_seq'::regclass);





ALTER TABLE "drizzle"."__drizzle_migrations" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "drizzle"."__drizzle_migrations" FROM PUBLIC, anon, authenticated;

ALTER TABLE "public"."admin_login_limits" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "public"."admin_login_limits" FROM PUBLIC, anon, authenticated;

ALTER TABLE "public"."admin_menu_entries" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "public"."admin_menu_entries" FROM PUBLIC, anon, authenticated;

ALTER TABLE "public"."admin_roles" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "public"."admin_roles" FROM PUBLIC, anon, authenticated;

ALTER TABLE "public"."admin_sessions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "public"."admin_sessions" FROM PUBLIC, anon, authenticated;

ALTER TABLE "public"."admin_user_roles" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "public"."admin_user_roles" FROM PUBLIC, anon, authenticated;

ALTER TABLE "public"."admin_users" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "public"."admin_users" FROM PUBLIC, anon, authenticated;

ALTER TABLE "public"."enterprise_accounts" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "public"."enterprise_accounts" FROM PUBLIC, anon, authenticated;

ALTER TABLE "public"."enterprise_sessions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "public"."enterprise_sessions" FROM PUBLIC, anon, authenticated;

ALTER TABLE "public"."generation_api_keys" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "public"."generation_api_keys" FROM PUBLIC, anon, authenticated;

ALTER TABLE "public"."generation_credit_ledger" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "public"."generation_credit_ledger" FROM PUBLIC, anon, authenticated;

ALTER TABLE "public"."generation_events" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "public"."generation_events" FROM PUBLIC, anon, authenticated;

ALTER TABLE "public"."generation_job_items" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "public"."generation_job_items" FROM PUBLIC, anon, authenticated;

ALTER TABLE "public"."generation_jobs" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "public"."generation_jobs" FROM PUBLIC, anon, authenticated;

ALTER TABLE "public"."generation_outbox" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "public"."generation_outbox" FROM PUBLIC, anon, authenticated;

ALTER TABLE "public"."generation_retries" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "public"."generation_retries" FROM PUBLIC, anon, authenticated;

ALTER TABLE "public"."image_local_edits" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "public"."image_local_edits" FROM PUBLIC, anon, authenticated;

ALTER TABLE "public"."login_rate_limits" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "public"."login_rate_limits" FROM PUBLIC, anon, authenticated;

ALTER TABLE "public"."media_assets" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "public"."media_assets" FROM PUBLIC, anon, authenticated;

ALTER TABLE "public"."model_audit_events" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "public"."model_audit_events" FROM PUBLIC, anon, authenticated;

ALTER TABLE "public"."model_catalog" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "public"."model_catalog" FROM PUBLIC, anon, authenticated;

ALTER TABLE "public"."model_channels" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "public"."model_channels" FROM PUBLIC, anon, authenticated;

ALTER TABLE "public"."model_credentials" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "public"."model_credentials" FROM PUBLIC, anon, authenticated;

ALTER TABLE "public"."model_planners" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "public"."model_planners" FROM PUBLIC, anon, authenticated;

ALTER TABLE "public"."model_provider_keys" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "public"."model_provider_keys" FROM PUBLIC, anon, authenticated;

ALTER TABLE "public"."model_providers" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "public"."model_providers" FROM PUBLIC, anon, authenticated;

ALTER TABLE "public"."model_routes" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "public"."model_routes" FROM PUBLIC, anon, authenticated;

ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "public"."notifications" FROM PUBLIC, anon, authenticated;

ALTER TABLE "public"."organization_members" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "public"."organization_members" FROM PUBLIC, anon, authenticated;

ALTER TABLE "public"."organization_wallets" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "public"."organization_wallets" FROM PUBLIC, anon, authenticated;

ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "public"."organizations" FROM PUBLIC, anon, authenticated;

ALTER TABLE "public"."outbox_events" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "public"."outbox_events" FROM PUBLIC, anon, authenticated;

ALTER TABLE "public"."platform_administrators" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "public"."platform_administrators" FROM PUBLIC, anon, authenticated;

ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "public"."projects" FROM PUBLIC, anon, authenticated;

ALTER TABLE "public"."provider_executions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "public"."provider_executions" FROM PUBLIC, anon, authenticated;

ALTER TABLE "public"."public_identifiers" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "public"."public_identifiers" FROM PUBLIC, anon, authenticated;

ALTER TABLE "public"."recharge_orders" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "public"."recharge_orders" FROM PUBLIC, anon, authenticated;

ALTER TABLE "public"."task_items" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "public"."task_items" FROM PUBLIC, anon, authenticated;

ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "public"."tasks" FROM PUBLIC, anon, authenticated;

ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "public"."users" FROM PUBLIC, anon, authenticated;

ALTER TABLE "public"."variation_plans" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "public"."variation_plans" FROM PUBLIC, anon, authenticated;

ALTER TABLE "public"."wallet_checkins" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "public"."wallet_checkins" FROM PUBLIC, anon, authenticated;

ALTER TABLE "public"."wallet_entries" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "public"."wallet_entries" FROM PUBLIC, anon, authenticated;

REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public, drizzle FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON SCHEMA drizzle FROM PUBLIC, anon, authenticated;
