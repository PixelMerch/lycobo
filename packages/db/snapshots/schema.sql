--
-- PostgreSQL database dump
--

\restrict QTUg4HTdXRScFdsLjJHDmnayQlQliGQQTGYV3B82LRuP5wyqh1mlDxSFLh9rb2W

-- Dumped from database version 17.11
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: drizzle; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA drizzle;


--
-- Name: item_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.item_status AS ENUM (
    'queued',
    'running',
    'succeeded',
    'failed',
    'cancelled'
);


--
-- Name: task_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.task_status AS ENUM (
    'queued',
    'running',
    'succeeded',
    'partially_failed',
    'failed',
    'cancelled'
);


--
-- Name: allocate_public_identifier(text); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: prevent_wallet_entry_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_wallet_entry_mutation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN RAISE EXCEPTION 'WALLET_LEDGER_IMMUTABLE'; END $$;


--
-- Name: validate_wallet_entry_scope(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_wallet_entry_scope() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE org uuid;
BEGIN
 SELECT organization_id INTO org FROM organization_wallets WHERE id=NEW.wallet_id;
 IF NEW.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM organization_members WHERE organization_id=org AND user_id=NEW.user_id)
 THEN RAISE EXCEPTION 'WALLET_MEMBER_MISMATCH'; END IF;
 IF NEW.kind IN ('consume','refund') AND NOT EXISTS (
  SELECT 1 FROM image_jobs j JOIN image_job_items i ON i.job_id=j.id
  WHERE j.id=NEW.job_id AND i.id=NEW.item_id AND j.organization_id=org AND j.user_id=NEW.user_id)
 THEN RAISE EXCEPTION 'WALLET_TASK_MISMATCH'; END IF;
 IF NEW.kind='recharge' AND NOT EXISTS (SELECT 1 FROM recharge_orders r WHERE r.id=NEW.recharge_id AND r.wallet_id=NEW.wallet_id AND r.user_id=NEW.user_id AND r.status='paid' AND r.credits=NEW.amount)
 THEN RAISE EXCEPTION 'WALLET_RECHARGE_MISMATCH'; END IF;
 RETURN NEW;
END $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: __drizzle_migrations; Type: TABLE; Schema: drizzle; Owner: -
--

CREATE TABLE drizzle.__drizzle_migrations (
    id integer NOT NULL,
    hash text NOT NULL,
    created_at bigint
);


--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE; Schema: drizzle; Owner: -
--

CREATE SEQUENCE drizzle.__drizzle_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: drizzle; Owner: -
--

ALTER SEQUENCE drizzle.__drizzle_migrations_id_seq OWNED BY drizzle.__drizzle_migrations.id;


--
-- Name: enterprise_accounts; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: enterprise_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.enterprise_sessions (
    id uuid NOT NULL,
    account_id uuid NOT NULL,
    credential_version uuid NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    refresh_token_hash text
);


--
-- Name: image_api_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.image_api_keys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: image_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.image_assets (
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
    CONSTRAINT image_assets_dimensions_check CHECK (((width > 0) AND (height > 0) AND (bytes > 0))),
    CONSTRAINT image_assets_kind_check CHECK ((kind = ANY (ARRAY['reference'::text, 'output'::text])))
);


--
-- Name: image_assets_display_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.image_assets ALTER COLUMN display_number ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.image_assets_display_number_seq
    START WITH 100000000
    INCREMENT BY 1
    MINVALUE 100000000
    NO MAXVALUE
    CACHE 1
);


--
-- Name: image_credit_ledger; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.image_credit_ledger (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    job_id uuid NOT NULL,
    item_id uuid,
    event_type text NOT NULL,
    amount integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT image_ledger_amount_check CHECK ((((event_type = 'reserve'::text) AND (amount < 0)) OR ((event_type = 'refund'::text) AND (amount > 0))))
);


--
-- Name: image_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.image_events (
    id bigint NOT NULL,
    organization_id uuid NOT NULL,
    kind text NOT NULL,
    resource_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT image_events_kind_check CHECK ((kind = ANY (ARRAY['task'::text, 'asset'::text])))
);


--
-- Name: image_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.image_events ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.image_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: image_job_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.image_job_items (
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
    CONSTRAINT image_items_output_check CHECK (((status <> 'succeeded'::text) OR (output_asset_id IS NOT NULL))),
    CONSTRAINT image_items_position_check CHECK (((("position" >= 0) AND ("position" <= 3)) AND (attempts >= 0))),
    CONSTRAINT image_items_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'running'::text, 'succeeded'::text, 'failed'::text, 'needs_reconciliation'::text])))
);


--
-- Name: image_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.image_jobs (
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
    CONSTRAINT image_jobs_count_check CHECK ((((requested_count >= 1) AND (requested_count <= 4)) AND (unit_credits > 0))),
    CONSTRAINT image_jobs_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'running'::text, 'succeeded'::text, 'partially_failed'::text, 'failed'::text, 'needs_reconciliation'::text])))
);


--
-- Name: image_jobs_display_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.image_jobs ALTER COLUMN display_number ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.image_jobs_display_number_seq
    START WITH 1000000000
    INCREMENT BY 1
    MINVALUE 1000000000
    NO MAXVALUE
    CACHE 1
);


--
-- Name: image_local_edits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.image_local_edits (
    job_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    source_asset_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: image_outbox; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.image_outbox (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    item_id uuid NOT NULL,
    next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    lease_token uuid,
    lease_expires_at timestamp with time zone,
    dispatched_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: image_retries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.image_retries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    job_id uuid NOT NULL,
    idempotency_key uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: login_rate_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.login_rate_limits (
    key text NOT NULL,
    window_start timestamp with time zone NOT NULL,
    attempts integer NOT NULL,
    CONSTRAINT login_rate_limits_attempts_check CHECK ((attempts > 0))
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    task_id uuid NOT NULL,
    event_key text NOT NULL,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: organization_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_members (
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text DEFAULT 'member'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT organization_members_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'member'::text])))
);


--
-- Name: organization_wallets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_wallets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    balance integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT wallet_balance_check CHECK ((balance >= 0))
);


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    available_credits integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT organizations_credits_nonnegative CHECK ((available_credits >= 0))
);


--
-- Name: outbox_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.outbox_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    event_type text NOT NULL,
    payload jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    dispatched_at timestamp with time zone
);


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: public_identifiers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.public_identifiers (
    value text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: recharge_orders; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: task_items; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_subject text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    uid text DEFAULT public.allocate_public_identifier('user'::text) NOT NULL
);


--
-- Name: wallet_checkins; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: wallet_entries; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: wallet_entries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.wallet_entries ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.wallet_entries_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: __drizzle_migrations id; Type: DEFAULT; Schema: drizzle; Owner: -
--

ALTER TABLE ONLY drizzle.__drizzle_migrations ALTER COLUMN id SET DEFAULT nextval('drizzle.__drizzle_migrations_id_seq'::regclass);


--
-- Name: __drizzle_migrations __drizzle_migrations_pkey; Type: CONSTRAINT; Schema: drizzle; Owner: -
--

ALTER TABLE ONLY drizzle.__drizzle_migrations
    ADD CONSTRAINT __drizzle_migrations_pkey PRIMARY KEY (id);


--
-- Name: enterprise_accounts enterprise_accounts_account_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enterprise_accounts
    ADD CONSTRAINT enterprise_accounts_account_unique UNIQUE (account);


--
-- Name: enterprise_accounts enterprise_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enterprise_accounts
    ADD CONSTRAINT enterprise_accounts_pkey PRIMARY KEY (id);


--
-- Name: enterprise_sessions enterprise_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enterprise_sessions
    ADD CONSTRAINT enterprise_sessions_pkey PRIMARY KEY (id);


--
-- Name: enterprise_sessions enterprise_sessions_refresh_token_hash_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enterprise_sessions
    ADD CONSTRAINT enterprise_sessions_refresh_token_hash_unique UNIQUE (refresh_token_hash);


--
-- Name: image_api_keys image_api_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.image_api_keys
    ADD CONSTRAINT image_api_keys_pkey PRIMARY KEY (id);


--
-- Name: image_api_keys image_api_keys_token_hash_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.image_api_keys
    ADD CONSTRAINT image_api_keys_token_hash_unique UNIQUE (token_hash);


--
-- Name: image_assets image_assets_display_number_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.image_assets
    ADD CONSTRAINT image_assets_display_number_unique UNIQUE (display_number);


--
-- Name: image_assets image_assets_id_org_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.image_assets
    ADD CONSTRAINT image_assets_id_org_unique UNIQUE (id, organization_id);


--
-- Name: image_assets image_assets_object_key_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.image_assets
    ADD CONSTRAINT image_assets_object_key_unique UNIQUE (object_key);


--
-- Name: image_assets image_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.image_assets
    ADD CONSTRAINT image_assets_pkey PRIMARY KEY (id);


--
-- Name: image_assets image_assets_public_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.image_assets
    ADD CONSTRAINT image_assets_public_id_unique UNIQUE (public_id);


--
-- Name: image_credit_ledger image_credit_ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.image_credit_ledger
    ADD CONSTRAINT image_credit_ledger_pkey PRIMARY KEY (id);


--
-- Name: image_events image_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.image_events
    ADD CONSTRAINT image_events_pkey PRIMARY KEY (id);


--
-- Name: image_job_items image_job_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.image_job_items
    ADD CONSTRAINT image_job_items_pkey PRIMARY KEY (id);


--
-- Name: image_jobs image_jobs_display_number_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.image_jobs
    ADD CONSTRAINT image_jobs_display_number_unique UNIQUE (display_number);


--
-- Name: image_jobs image_jobs_id_org_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.image_jobs
    ADD CONSTRAINT image_jobs_id_org_unique UNIQUE (id, organization_id);


--
-- Name: image_jobs image_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.image_jobs
    ADD CONSTRAINT image_jobs_pkey PRIMARY KEY (id);


--
-- Name: image_jobs image_jobs_public_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.image_jobs
    ADD CONSTRAINT image_jobs_public_id_unique UNIQUE (public_id);


--
-- Name: image_jobs image_jobs_scope_key_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.image_jobs
    ADD CONSTRAINT image_jobs_scope_key_unique UNIQUE (organization_id, user_id, idempotency_key);


--
-- Name: image_local_edits image_local_edits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.image_local_edits
    ADD CONSTRAINT image_local_edits_pkey PRIMARY KEY (job_id);


--
-- Name: image_outbox image_outbox_item_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.image_outbox
    ADD CONSTRAINT image_outbox_item_id_unique UNIQUE (item_id);


--
-- Name: image_outbox image_outbox_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.image_outbox
    ADD CONSTRAINT image_outbox_pkey PRIMARY KEY (id);


--
-- Name: image_retries image_retries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.image_retries
    ADD CONSTRAINT image_retries_pkey PRIMARY KEY (id);


--
-- Name: image_retries image_retries_scope_key_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.image_retries
    ADD CONSTRAINT image_retries_scope_key_unique UNIQUE (organization_id, user_id, idempotency_key);


--
-- Name: login_rate_limits login_rate_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.login_rate_limits
    ADD CONSTRAINT login_rate_limits_pkey PRIMARY KEY (key);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: organization_members organization_members_org_user_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_org_user_unique UNIQUE (organization_id, user_id);


--
-- Name: organization_wallets organization_wallets_organization_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_wallets
    ADD CONSTRAINT organization_wallets_organization_id_unique UNIQUE (organization_id);


--
-- Name: organization_wallets organization_wallets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_wallets
    ADD CONSTRAINT organization_wallets_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: outbox_events outbox_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outbox_events
    ADD CONSTRAINT outbox_events_pkey PRIMARY KEY (id);


--
-- Name: projects projects_id_owner_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_id_owner_unique UNIQUE (id, owner_id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: public_identifiers public_identifiers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_identifiers
    ADD CONSTRAINT public_identifiers_pkey PRIMARY KEY (value);


--
-- Name: recharge_orders recharge_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recharge_orders
    ADD CONSTRAINT recharge_orders_pkey PRIMARY KEY (id);


--
-- Name: recharge_orders recharge_provider_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recharge_orders
    ADD CONSTRAINT recharge_provider_unique UNIQUE (channel, provider_transaction_id);


--
-- Name: recharge_orders recharge_wallet_key_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recharge_orders
    ADD CONSTRAINT recharge_wallet_key_unique UNIQUE (wallet_id, idempotency_key);


--
-- Name: task_items task_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_items
    ADD CONSTRAINT task_items_pkey PRIMARY KEY (id);


--
-- Name: task_items task_items_task_position_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_items
    ADD CONSTRAINT task_items_task_position_unique UNIQUE (task_id, "position");


--
-- Name: tasks tasks_id_owner_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_id_owner_unique UNIQUE (id, owner_id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: users users_auth_subject_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_auth_subject_unique UNIQUE (auth_subject);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_uid_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_uid_unique UNIQUE (uid);


--
-- Name: wallet_checkins wallet_checkin_day_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_checkins
    ADD CONSTRAINT wallet_checkin_day_unique UNIQUE (wallet_id, business_date);


--
-- Name: wallet_checkins wallet_checkins_ledger_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_checkins
    ADD CONSTRAINT wallet_checkins_ledger_id_unique UNIQUE (ledger_id);


--
-- Name: wallet_checkins wallet_checkins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_checkins
    ADD CONSTRAINT wallet_checkins_pkey PRIMARY KEY (id);


--
-- Name: wallet_entries wallet_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_entries
    ADD CONSTRAINT wallet_entries_pkey PRIMARY KEY (id);


--
-- Name: wallet_entries wallet_event_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_entries
    ADD CONSTRAINT wallet_event_unique UNIQUE (wallet_id, event_key);


--
-- Name: enterprise_accounts_member_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX enterprise_accounts_member_idx ON public.enterprise_accounts USING btree (organization_id, user_id);


--
-- Name: enterprise_sessions_account_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX enterprise_sessions_account_idx ON public.enterprise_sessions USING btree (account_id);


--
-- Name: enterprise_sessions_expiry_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX enterprise_sessions_expiry_idx ON public.enterprise_sessions USING btree (expires_at);


--
-- Name: image_assets_member_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX image_assets_member_idx ON public.image_assets USING btree (organization_id, user_id);


--
-- Name: image_assets_org_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX image_assets_org_created_idx ON public.image_assets USING btree (organization_id, created_at);


--
-- Name: image_events_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX image_events_created_idx ON public.image_events USING btree (created_at);


--
-- Name: image_events_org_cursor_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX image_events_org_cursor_idx ON public.image_events USING btree (organization_id, id);


--
-- Name: image_items_current_position_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX image_items_current_position_unique ON public.image_job_items USING btree (job_id, "position") WHERE (superseded_at IS NULL);


--
-- Name: image_items_lease_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX image_items_lease_idx ON public.image_job_items USING btree (lease_expires_at) WHERE (status = 'running'::text);


--
-- Name: image_items_output_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX image_items_output_idx ON public.image_job_items USING btree (output_asset_id, organization_id);


--
-- Name: image_items_reconciler_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX image_items_reconciler_idx ON public.image_job_items USING btree (reconciled_by);


--
-- Name: image_jobs_member_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX image_jobs_member_idx ON public.image_jobs USING btree (organization_id, user_id);


--
-- Name: image_jobs_org_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX image_jobs_org_created_idx ON public.image_jobs USING btree (organization_id, created_at, id);


--
-- Name: image_keys_member_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX image_keys_member_idx ON public.image_api_keys USING btree (organization_id, user_id);


--
-- Name: image_ledger_job_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX image_ledger_job_idx ON public.image_credit_ledger USING btree (job_id, organization_id);


--
-- Name: image_ledger_org_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX image_ledger_org_created_idx ON public.image_credit_ledger USING btree (organization_id, created_at);


--
-- Name: image_ledger_refund_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX image_ledger_refund_unique ON public.image_credit_ledger USING btree (item_id) WHERE (event_type = 'refund'::text);


--
-- Name: image_ledger_reserve_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX image_ledger_reserve_unique ON public.image_credit_ledger USING btree (job_id) WHERE (event_type = 'reserve'::text);


--
-- Name: image_local_edits_latest_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX image_local_edits_latest_idx ON public.image_local_edits USING btree (organization_id, user_id, source_asset_id, created_at DESC NULLS LAST, job_id DESC NULLS LAST);


--
-- Name: image_outbox_due_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX image_outbox_due_idx ON public.image_outbox USING btree (next_attempt_at);


--
-- Name: image_retries_job_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX image_retries_job_idx ON public.image_retries USING btree (job_id, organization_id);


--
-- Name: image_retries_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX image_retries_user_idx ON public.image_retries USING btree (user_id);


--
-- Name: login_rate_limits_window_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX login_rate_limits_window_idx ON public.login_rate_limits USING btree (window_start);


--
-- Name: notifications_owner_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_owner_created_idx ON public.notifications USING btree (owner_id, created_at);


--
-- Name: notifications_owner_event_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX notifications_owner_event_idx ON public.notifications USING btree (owner_id, event_key);


--
-- Name: notifications_task_owner_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_task_owner_idx ON public.notifications USING btree (task_id, owner_id);


--
-- Name: organization_members_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX organization_members_user_idx ON public.organization_members USING btree (user_id);


--
-- Name: outbox_pending_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX outbox_pending_idx ON public.outbox_events USING btree (created_at) WHERE (dispatched_at IS NULL);


--
-- Name: outbox_task_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX outbox_task_idx ON public.outbox_events USING btree (task_id);


--
-- Name: projects_owner_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX projects_owner_created_idx ON public.projects USING btree (owner_id, created_at);


--
-- Name: recharge_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recharge_user_idx ON public.recharge_orders USING btree (user_id);


--
-- Name: recharge_wallet_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recharge_wallet_created_idx ON public.recharge_orders USING btree (wallet_id, created_at, id);


--
-- Name: task_items_provider_task_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX task_items_provider_task_idx ON public.task_items USING btree (provider, provider_task_id);


--
-- Name: tasks_owner_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tasks_owner_created_idx ON public.tasks USING btree (owner_id, created_at);


--
-- Name: tasks_owner_idempotency_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX tasks_owner_idempotency_idx ON public.tasks USING btree (owner_id, idempotency_key);


--
-- Name: tasks_project_owner_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tasks_project_owner_idx ON public.tasks USING btree (project_id, owner_id);


--
-- Name: wallet_checkin_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX wallet_checkin_user_idx ON public.wallet_checkins USING btree (user_id);


--
-- Name: wallet_entries_cursor_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX wallet_entries_cursor_idx ON public.wallet_entries USING btree (wallet_id, id);


--
-- Name: wallet_entries_item_kind_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX wallet_entries_item_kind_unique ON public.wallet_entries USING btree (item_id, kind);


--
-- Name: wallet_entries_job_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX wallet_entries_job_idx ON public.wallet_entries USING btree (job_id);


--
-- Name: wallet_entries_recharge_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX wallet_entries_recharge_unique ON public.wallet_entries USING btree (recharge_id);


--
-- Name: wallet_entries_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX wallet_entries_user_idx ON public.wallet_entries USING btree (user_id);


--
-- Name: wallet_entries wallet_entries_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER wallet_entries_immutable BEFORE DELETE OR UPDATE ON public.wallet_entries FOR EACH ROW EXECUTE FUNCTION public.prevent_wallet_entry_mutation();


--
-- Name: wallet_entries wallet_entries_scope; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER wallet_entries_scope BEFORE INSERT ON public.wallet_entries FOR EACH ROW EXECUTE FUNCTION public.validate_wallet_entry_scope();


--
-- Name: enterprise_accounts enterprise_account_member_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enterprise_accounts
    ADD CONSTRAINT enterprise_account_member_fk FOREIGN KEY (organization_id, user_id) REFERENCES public.organization_members(organization_id, user_id) ON DELETE CASCADE;


--
-- Name: enterprise_sessions enterprise_sessions_account_id_enterprise_accounts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enterprise_sessions
    ADD CONSTRAINT enterprise_sessions_account_id_enterprise_accounts_id_fk FOREIGN KEY (account_id) REFERENCES public.enterprise_accounts(id) ON DELETE CASCADE;


--
-- Name: image_assets image_assets_membership_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.image_assets
    ADD CONSTRAINT image_assets_membership_fk FOREIGN KEY (organization_id, user_id) REFERENCES public.organization_members(organization_id, user_id);


--
-- Name: image_assets image_assets_public_id_public_identifiers_value_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.image_assets
    ADD CONSTRAINT image_assets_public_id_public_identifiers_value_fk FOREIGN KEY (public_id) REFERENCES public.public_identifiers(value);


--
-- Name: image_credit_ledger image_credit_ledger_item_id_image_job_items_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.image_credit_ledger
    ADD CONSTRAINT image_credit_ledger_item_id_image_job_items_id_fk FOREIGN KEY (item_id) REFERENCES public.image_job_items(id);


--
-- Name: image_credit_ledger image_credit_ledger_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.image_credit_ledger
    ADD CONSTRAINT image_credit_ledger_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: image_events image_events_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.image_events
    ADD CONSTRAINT image_events_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: image_job_items image_items_job_org_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.image_job_items
    ADD CONSTRAINT image_items_job_org_fk FOREIGN KEY (job_id, organization_id) REFERENCES public.image_jobs(id, organization_id);


--
-- Name: image_job_items image_items_output_org_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.image_job_items
    ADD CONSTRAINT image_items_output_org_fk FOREIGN KEY (output_asset_id, organization_id) REFERENCES public.image_assets(id, organization_id);


--
-- Name: image_job_items image_job_items_reconciled_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.image_job_items
    ADD CONSTRAINT image_job_items_reconciled_by_users_id_fk FOREIGN KEY (reconciled_by) REFERENCES public.users(id);


--
-- Name: image_jobs image_jobs_membership_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.image_jobs
    ADD CONSTRAINT image_jobs_membership_fk FOREIGN KEY (organization_id, user_id) REFERENCES public.organization_members(organization_id, user_id);


--
-- Name: image_jobs image_jobs_public_id_public_identifiers_value_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.image_jobs
    ADD CONSTRAINT image_jobs_public_id_public_identifiers_value_fk FOREIGN KEY (public_id) REFERENCES public.public_identifiers(value);


--
-- Name: image_api_keys image_keys_membership_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.image_api_keys
    ADD CONSTRAINT image_keys_membership_fk FOREIGN KEY (organization_id, user_id) REFERENCES public.organization_members(organization_id, user_id);


--
-- Name: image_credit_ledger image_ledger_job_org_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.image_credit_ledger
    ADD CONSTRAINT image_ledger_job_org_fk FOREIGN KEY (job_id, organization_id) REFERENCES public.image_jobs(id, organization_id);


--
-- Name: image_local_edits image_local_edits_job_org_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.image_local_edits
    ADD CONSTRAINT image_local_edits_job_org_fk FOREIGN KEY (job_id, organization_id) REFERENCES public.image_jobs(id, organization_id);


--
-- Name: image_local_edits image_local_edits_member_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.image_local_edits
    ADD CONSTRAINT image_local_edits_member_fk FOREIGN KEY (organization_id, user_id) REFERENCES public.organization_members(organization_id, user_id);


--
-- Name: image_local_edits image_local_edits_source_org_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.image_local_edits
    ADD CONSTRAINT image_local_edits_source_org_fk FOREIGN KEY (source_asset_id, organization_id) REFERENCES public.image_assets(id, organization_id);


--
-- Name: image_outbox image_outbox_item_id_image_job_items_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.image_outbox
    ADD CONSTRAINT image_outbox_item_id_image_job_items_id_fk FOREIGN KEY (item_id) REFERENCES public.image_job_items(id);


--
-- Name: image_retries image_retries_job_org_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.image_retries
    ADD CONSTRAINT image_retries_job_org_fk FOREIGN KEY (job_id, organization_id) REFERENCES public.image_jobs(id, organization_id);


--
-- Name: image_retries image_retries_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.image_retries
    ADD CONSTRAINT image_retries_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: notifications notifications_owner_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_owner_id_users_id_fk FOREIGN KEY (owner_id) REFERENCES public.users(id);


--
-- Name: notifications notifications_task_owner_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_task_owner_fk FOREIGN KEY (task_id, owner_id) REFERENCES public.tasks(id, owner_id);


--
-- Name: organization_members organization_members_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: organization_members organization_members_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: organization_wallets organization_wallets_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_wallets
    ADD CONSTRAINT organization_wallets_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: outbox_events outbox_events_task_id_tasks_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outbox_events
    ADD CONSTRAINT outbox_events_task_id_tasks_id_fk FOREIGN KEY (task_id) REFERENCES public.tasks(id);


--
-- Name: projects projects_owner_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_owner_id_users_id_fk FOREIGN KEY (owner_id) REFERENCES public.users(id);


--
-- Name: recharge_orders recharge_orders_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recharge_orders
    ADD CONSTRAINT recharge_orders_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: recharge_orders recharge_orders_wallet_id_organization_wallets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recharge_orders
    ADD CONSTRAINT recharge_orders_wallet_id_organization_wallets_id_fk FOREIGN KEY (wallet_id) REFERENCES public.organization_wallets(id);


--
-- Name: task_items task_items_task_id_tasks_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_items
    ADD CONSTRAINT task_items_task_id_tasks_id_fk FOREIGN KEY (task_id) REFERENCES public.tasks(id);


--
-- Name: tasks tasks_owner_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_owner_id_users_id_fk FOREIGN KEY (owner_id) REFERENCES public.users(id);


--
-- Name: tasks tasks_project_owner_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_project_owner_fk FOREIGN KEY (project_id, owner_id) REFERENCES public.projects(id, owner_id);


--
-- Name: users users_uid_public_identifiers_value_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_uid_public_identifiers_value_fk FOREIGN KEY (uid) REFERENCES public.public_identifiers(value);


--
-- Name: wallet_checkins wallet_checkins_ledger_id_wallet_entries_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_checkins
    ADD CONSTRAINT wallet_checkins_ledger_id_wallet_entries_id_fk FOREIGN KEY (ledger_id) REFERENCES public.wallet_entries(id);


--
-- Name: wallet_checkins wallet_checkins_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_checkins
    ADD CONSTRAINT wallet_checkins_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: wallet_checkins wallet_checkins_wallet_id_organization_wallets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_checkins
    ADD CONSTRAINT wallet_checkins_wallet_id_organization_wallets_id_fk FOREIGN KEY (wallet_id) REFERENCES public.organization_wallets(id);


--
-- Name: wallet_entries wallet_entries_item_id_image_job_items_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_entries
    ADD CONSTRAINT wallet_entries_item_id_image_job_items_id_fk FOREIGN KEY (item_id) REFERENCES public.image_job_items(id);


--
-- Name: wallet_entries wallet_entries_job_id_image_jobs_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_entries
    ADD CONSTRAINT wallet_entries_job_id_image_jobs_id_fk FOREIGN KEY (job_id) REFERENCES public.image_jobs(id);


--
-- Name: wallet_entries wallet_entries_recharge_id_recharge_orders_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_entries
    ADD CONSTRAINT wallet_entries_recharge_id_recharge_orders_id_fk FOREIGN KEY (recharge_id) REFERENCES public.recharge_orders(id);


--
-- Name: wallet_entries wallet_entries_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_entries
    ADD CONSTRAINT wallet_entries_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: wallet_entries wallet_entries_wallet_id_organization_wallets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_entries
    ADD CONSTRAINT wallet_entries_wallet_id_organization_wallets_id_fk FOREIGN KEY (wallet_id) REFERENCES public.organization_wallets(id);


--
-- PostgreSQL database dump complete
--

\unrestrict QTUg4HTdXRScFdsLjJHDmnayQlQliGQQTGYV3B82LRuP5wyqh1mlDxSFLh9rb2W

