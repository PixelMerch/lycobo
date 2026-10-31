





ALTER TABLE ONLY drizzle.__drizzle_migrations
    ADD CONSTRAINT __drizzle_migrations_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.admin_login_limits
    ADD CONSTRAINT admin_login_limits_pkey PRIMARY KEY (subject_hash);



ALTER TABLE ONLY public.admin_menu_entries
    ADD CONSTRAINT admin_menu_entries_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.admin_roles
    ADD CONSTRAINT admin_roles_name_unique UNIQUE (name);



ALTER TABLE ONLY public.admin_roles
    ADD CONSTRAINT admin_roles_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.admin_sessions
    ADD CONSTRAINT admin_sessions_pkey PRIMARY KEY (token_hash);



ALTER TABLE ONLY public.admin_user_roles
    ADD CONSTRAINT admin_user_roles_unique UNIQUE (administrator_id, role_id);



ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_account_unique UNIQUE (account);



ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.enterprise_accounts
    ADD CONSTRAINT enterprise_accounts_account_unique UNIQUE (account);



ALTER TABLE ONLY public.enterprise_accounts
    ADD CONSTRAINT enterprise_accounts_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.enterprise_sessions
    ADD CONSTRAINT enterprise_sessions_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.enterprise_sessions
    ADD CONSTRAINT enterprise_sessions_refresh_token_hash_unique UNIQUE (refresh_token_hash);



ALTER TABLE ONLY public.generation_api_keys
    ADD CONSTRAINT generation_api_keys_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.generation_api_keys
    ADD CONSTRAINT generation_api_keys_token_hash_unique UNIQUE (token_hash);



ALTER TABLE ONLY public.generation_credit_ledger
    ADD CONSTRAINT generation_credit_ledger_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.generation_events
    ADD CONSTRAINT generation_events_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.generation_job_items
    ADD CONSTRAINT generation_job_items_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.generation_jobs
    ADD CONSTRAINT generation_jobs_display_number_unique UNIQUE (display_number);



ALTER TABLE ONLY public.generation_jobs
    ADD CONSTRAINT generation_jobs_id_org_unique UNIQUE (id, organization_id);



ALTER TABLE ONLY public.generation_jobs
    ADD CONSTRAINT generation_jobs_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.generation_jobs
    ADD CONSTRAINT generation_jobs_public_id_unique UNIQUE (public_id);



ALTER TABLE ONLY public.generation_jobs
    ADD CONSTRAINT generation_jobs_scope_key_unique UNIQUE (organization_id, user_id, idempotency_key);



ALTER TABLE ONLY public.generation_outbox
    ADD CONSTRAINT generation_outbox_item_id_unique UNIQUE (item_id);



ALTER TABLE ONLY public.generation_outbox
    ADD CONSTRAINT generation_outbox_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.generation_retries
    ADD CONSTRAINT generation_retries_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.generation_retries
    ADD CONSTRAINT generation_retries_scope_key_unique UNIQUE (organization_id, user_id, idempotency_key);



ALTER TABLE ONLY public.image_local_edits
    ADD CONSTRAINT image_local_edits_pkey PRIMARY KEY (job_id);



ALTER TABLE ONLY public.login_rate_limits
    ADD CONSTRAINT login_rate_limits_pkey PRIMARY KEY (key);



ALTER TABLE ONLY public.media_assets
    ADD CONSTRAINT media_assets_display_number_unique UNIQUE (display_number);



ALTER TABLE ONLY public.media_assets
    ADD CONSTRAINT media_assets_id_org_unique UNIQUE (id, organization_id);



ALTER TABLE ONLY public.media_assets
    ADD CONSTRAINT media_assets_object_key_unique UNIQUE (object_key);



ALTER TABLE ONLY public.media_assets
    ADD CONSTRAINT media_assets_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.media_assets
    ADD CONSTRAINT media_assets_public_id_unique UNIQUE (public_id);



ALTER TABLE ONLY public.model_audit_events
    ADD CONSTRAINT model_audit_events_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.model_catalog
    ADD CONSTRAINT model_catalog_id_unique UNIQUE (id);



ALTER TABLE ONLY public.model_catalog
    ADD CONSTRAINT model_catalog_pkey PRIMARY KEY (code);



ALTER TABLE ONLY public.model_channels
    ADD CONSTRAINT model_channels_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.model_credentials
    ADD CONSTRAINT model_credentials_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.model_planners
    ADD CONSTRAINT model_planners_pkey PRIMARY KEY (tool);



ALTER TABLE ONLY public.model_provider_keys
    ADD CONSTRAINT model_provider_keys_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.model_provider_keys
    ADD CONSTRAINT model_provider_keys_provider_name_unique UNIQUE (provider_id, name);



ALTER TABLE ONLY public.model_providers
    ADD CONSTRAINT model_providers_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.model_routes
    ADD CONSTRAINT model_routes_tool_model_unique UNIQUE (tool, model);



ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_org_user_unique UNIQUE (organization_id, user_id);



ALTER TABLE ONLY public.organization_wallets
    ADD CONSTRAINT organization_wallets_organization_id_unique UNIQUE (organization_id);



ALTER TABLE ONLY public.organization_wallets
    ADD CONSTRAINT organization_wallets_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.outbox_events
    ADD CONSTRAINT outbox_events_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.platform_administrators
    ADD CONSTRAINT platform_administrators_pkey PRIMARY KEY (user_id);



ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_id_owner_unique UNIQUE (id, owner_id);



ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.provider_executions
    ADD CONSTRAINT provider_executions_pkey PRIMARY KEY (item_id);



ALTER TABLE ONLY public.public_identifiers
    ADD CONSTRAINT public_identifiers_pkey PRIMARY KEY (value);



ALTER TABLE ONLY public.recharge_orders
    ADD CONSTRAINT recharge_orders_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.recharge_orders
    ADD CONSTRAINT recharge_provider_unique UNIQUE (channel, provider_transaction_id);



ALTER TABLE ONLY public.recharge_orders
    ADD CONSTRAINT recharge_wallet_key_unique UNIQUE (wallet_id, idempotency_key);



ALTER TABLE ONLY public.task_items
    ADD CONSTRAINT task_items_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.task_items
    ADD CONSTRAINT task_items_task_position_unique UNIQUE (task_id, "position");



ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_id_owner_unique UNIQUE (id, owner_id);



ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_auth_subject_unique UNIQUE (auth_subject);



ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_uid_unique UNIQUE (uid);



ALTER TABLE ONLY public.variation_plans
    ADD CONSTRAINT variation_plan_idempotency UNIQUE (organization_id, user_id, idempotency_key);



ALTER TABLE ONLY public.variation_plans
    ADD CONSTRAINT variation_plans_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.wallet_checkins
    ADD CONSTRAINT wallet_checkin_day_unique UNIQUE (wallet_id, business_date);



ALTER TABLE ONLY public.wallet_checkins
    ADD CONSTRAINT wallet_checkins_ledger_id_unique UNIQUE (ledger_id);



ALTER TABLE ONLY public.wallet_checkins
    ADD CONSTRAINT wallet_checkins_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.wallet_entries
    ADD CONSTRAINT wallet_entries_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.wallet_entries
    ADD CONSTRAINT wallet_event_unique UNIQUE (wallet_id, event_key);



CREATE INDEX admin_login_limits_reset_idx ON public.admin_login_limits USING btree (reset_at);



CREATE UNIQUE INDEX admin_menu_page_unique ON public.admin_menu_entries USING btree (page_id);



CREATE INDEX admin_menu_parent_order_idx ON public.admin_menu_entries USING btree (parent_id, sort_order);



CREATE INDEX admin_sessions_expiry_idx ON public.admin_sessions USING btree (expires_at);



CREATE INDEX admin_sessions_user_idx ON public.admin_sessions USING btree (administrator_id);



CREATE INDEX admin_user_roles_role_idx ON public.admin_user_roles USING btree (role_id);



CREATE INDEX enterprise_accounts_member_idx ON public.enterprise_accounts USING btree (organization_id, user_id);



CREATE INDEX enterprise_sessions_account_idx ON public.enterprise_sessions USING btree (account_id);



CREATE INDEX enterprise_sessions_expiry_idx ON public.enterprise_sessions USING btree (expires_at);



CREATE INDEX generation_api_keys_member_idx ON public.generation_api_keys USING btree (organization_id, user_id);



CREATE INDEX generation_credit_ledger_job_idx ON public.generation_credit_ledger USING btree (job_id, organization_id);



CREATE INDEX generation_credit_ledger_org_created_idx ON public.generation_credit_ledger USING btree (organization_id, created_at);



CREATE UNIQUE INDEX generation_credit_ledger_refund_unique ON public.generation_credit_ledger USING btree (item_id) WHERE (event_type = 'refund'::text);



CREATE UNIQUE INDEX generation_credit_ledger_reserve_unique ON public.generation_credit_ledger USING btree (job_id) WHERE (event_type = 'reserve'::text);



CREATE INDEX generation_events_created_idx ON public.generation_events USING btree (created_at);



CREATE INDEX generation_events_org_cursor_idx ON public.generation_events USING btree (organization_id, id);



CREATE UNIQUE INDEX generation_job_items_current_position_unique ON public.generation_job_items USING btree (job_id, "position") WHERE (superseded_at IS NULL);



CREATE INDEX generation_job_items_lease_idx ON public.generation_job_items USING btree (lease_expires_at) WHERE (status = 'running'::text);



CREATE INDEX generation_job_items_output_idx ON public.generation_job_items USING btree (output_asset_id, organization_id);



CREATE INDEX generation_job_items_reconciler_idx ON public.generation_job_items USING btree (reconciled_by);



CREATE INDEX generation_job_items_running_started_idx ON public.generation_job_items USING btree (started_at, organization_id) WHERE ((status = 'running'::text) AND (superseded_at IS NULL));



CREATE INDEX generation_jobs_member_idx ON public.generation_jobs USING btree (organization_id, user_id);



CREATE INDEX generation_jobs_org_created_idx ON public.generation_jobs USING btree (organization_id, created_at, id);



CREATE INDEX generation_outbox_due_idx ON public.generation_outbox USING btree (next_attempt_at);



CREATE INDEX generation_retries_job_idx ON public.generation_retries USING btree (job_id, organization_id);



CREATE INDEX generation_retries_user_idx ON public.generation_retries USING btree (user_id);



CREATE INDEX image_local_edits_latest_idx ON public.image_local_edits USING btree (organization_id, user_id, source_asset_id, created_at DESC NULLS LAST, job_id DESC NULLS LAST);



CREATE INDEX login_rate_limits_window_idx ON public.login_rate_limits USING btree (window_start);



CREATE INDEX media_assets_expiry_idx ON public.media_assets USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (storage_deleted_at IS NULL));



CREATE INDEX media_assets_member_idx ON public.media_assets USING btree (organization_id, user_id);



CREATE INDEX media_assets_org_created_idx ON public.media_assets USING btree (organization_id, created_at);



CREATE INDEX model_audit_created_idx ON public.model_audit_events USING btree (created_at);



CREATE INDEX model_catalog_provider_idx ON public.model_catalog USING btree (provider_id);



CREATE INDEX model_channels_key_idx ON public.model_channels USING btree (key_id);



CREATE INDEX model_channels_model_idx ON public.model_channels USING btree (model);



CREATE INDEX model_channels_provider_idx ON public.model_channels USING btree (provider_id);



CREATE INDEX model_provider_keys_credential_idx ON public.model_provider_keys USING btree (credential_id);



CREATE INDEX model_routes_channel_idx ON public.model_routes USING btree (channel_id);



CREATE INDEX notifications_owner_created_idx ON public.notifications USING btree (owner_id, created_at);



CREATE UNIQUE INDEX notifications_owner_event_idx ON public.notifications USING btree (owner_id, event_key);



CREATE INDEX notifications_task_owner_idx ON public.notifications USING btree (task_id, owner_id);



CREATE INDEX organization_members_user_idx ON public.organization_members USING btree (user_id);



CREATE INDEX outbox_pending_idx ON public.outbox_events USING btree (created_at) WHERE (dispatched_at IS NULL);



CREATE INDEX outbox_task_idx ON public.outbox_events USING btree (task_id);



CREATE INDEX projects_owner_created_idx ON public.projects USING btree (owner_id, created_at);



CREATE INDEX provider_executions_due_idx ON public.provider_executions USING btree (next_poll_at);



CREATE INDEX recharge_user_idx ON public.recharge_orders USING btree (user_id);



CREATE INDEX recharge_wallet_created_idx ON public.recharge_orders USING btree (wallet_id, created_at, id);



CREATE INDEX task_items_provider_task_idx ON public.task_items USING btree (provider, provider_task_id);



CREATE INDEX tasks_owner_created_idx ON public.tasks USING btree (owner_id, created_at);



CREATE UNIQUE INDEX tasks_owner_idempotency_idx ON public.tasks USING btree (owner_id, idempotency_key);



CREATE INDEX tasks_project_owner_idx ON public.tasks USING btree (project_id, owner_id);



CREATE INDEX variation_plan_owner_created ON public.variation_plans USING btree (organization_id, user_id, created_at);



CREATE INDEX wallet_checkin_user_idx ON public.wallet_checkins USING btree (user_id);



CREATE INDEX wallet_entries_cursor_idx ON public.wallet_entries USING btree (wallet_id, id);



CREATE UNIQUE INDEX wallet_entries_item_kind_unique ON public.wallet_entries USING btree (item_id, kind);



CREATE INDEX wallet_entries_job_idx ON public.wallet_entries USING btree (job_id);



CREATE UNIQUE INDEX wallet_entries_recharge_unique ON public.wallet_entries USING btree (recharge_id);



CREATE INDEX wallet_entries_user_idx ON public.wallet_entries USING btree (user_id);



CREATE TRIGGER wallet_entries_immutable BEFORE DELETE OR UPDATE ON public.wallet_entries FOR EACH ROW EXECUTE FUNCTION public.prevent_wallet_entry_mutation();



CREATE TRIGGER wallet_entries_scope BEFORE INSERT ON public.wallet_entries FOR EACH ROW EXECUTE FUNCTION public.validate_wallet_entry_scope();



ALTER TABLE ONLY public.admin_menu_entries
    ADD CONSTRAINT admin_menu_entries_parent_id_admin_menu_entries_id_fk FOREIGN KEY (parent_id) REFERENCES public.admin_menu_entries(id);



ALTER TABLE ONLY public.admin_sessions
    ADD CONSTRAINT admin_sessions_administrator_id_admin_users_id_fk FOREIGN KEY (administrator_id) REFERENCES public.admin_users(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.admin_user_roles
    ADD CONSTRAINT admin_user_roles_administrator_id_admin_users_id_fk FOREIGN KEY (administrator_id) REFERENCES public.admin_users(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.admin_user_roles
    ADD CONSTRAINT admin_user_roles_role_id_admin_roles_id_fk FOREIGN KEY (role_id) REFERENCES public.admin_roles(id);



ALTER TABLE ONLY public.enterprise_accounts
    ADD CONSTRAINT enterprise_account_member_fk FOREIGN KEY (organization_id, user_id) REFERENCES public.organization_members(organization_id, user_id) ON DELETE CASCADE;



ALTER TABLE ONLY public.enterprise_sessions
    ADD CONSTRAINT enterprise_sessions_account_id_enterprise_accounts_id_fk FOREIGN KEY (account_id) REFERENCES public.enterprise_accounts(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.generation_api_keys
    ADD CONSTRAINT generation_api_keys_membership_fk FOREIGN KEY (organization_id, user_id) REFERENCES public.organization_members(organization_id, user_id);



ALTER TABLE ONLY public.generation_credit_ledger
    ADD CONSTRAINT generation_credit_ledger_item_id_generation_job_items_id_fk FOREIGN KEY (item_id) REFERENCES public.generation_job_items(id);



ALTER TABLE ONLY public.generation_credit_ledger
    ADD CONSTRAINT generation_credit_ledger_job_org_fk FOREIGN KEY (job_id, organization_id) REFERENCES public.generation_jobs(id, organization_id);



ALTER TABLE ONLY public.generation_credit_ledger
    ADD CONSTRAINT generation_credit_ledger_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);



ALTER TABLE ONLY public.generation_events
    ADD CONSTRAINT generation_events_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.generation_job_items
    ADD CONSTRAINT generation_job_items_job_org_fk FOREIGN KEY (job_id, organization_id) REFERENCES public.generation_jobs(id, organization_id);



ALTER TABLE ONLY public.generation_job_items
    ADD CONSTRAINT generation_job_items_output_org_fk FOREIGN KEY (output_asset_id, organization_id) REFERENCES public.media_assets(id, organization_id);



ALTER TABLE ONLY public.generation_job_items
    ADD CONSTRAINT generation_job_items_reconciled_by_users_id_fk FOREIGN KEY (reconciled_by) REFERENCES public.users(id);



ALTER TABLE ONLY public.generation_jobs
    ADD CONSTRAINT generation_jobs_membership_fk FOREIGN KEY (organization_id, user_id) REFERENCES public.organization_members(organization_id, user_id);



ALTER TABLE ONLY public.generation_jobs
    ADD CONSTRAINT generation_jobs_public_id_public_identifiers_value_fk FOREIGN KEY (public_id) REFERENCES public.public_identifiers(value);



ALTER TABLE ONLY public.generation_outbox
    ADD CONSTRAINT generation_outbox_item_id_generation_job_items_id_fk FOREIGN KEY (item_id) REFERENCES public.generation_job_items(id);



ALTER TABLE ONLY public.generation_retries
    ADD CONSTRAINT generation_retries_job_org_fk FOREIGN KEY (job_id, organization_id) REFERENCES public.generation_jobs(id, organization_id);



ALTER TABLE ONLY public.generation_retries
    ADD CONSTRAINT generation_retries_target_item_id_generation_job_items_id_fk FOREIGN KEY (target_item_id) REFERENCES public.generation_job_items(id);



ALTER TABLE ONLY public.generation_retries
    ADD CONSTRAINT generation_retries_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);



ALTER TABLE ONLY public.image_local_edits
    ADD CONSTRAINT image_local_edits_job_org_fk FOREIGN KEY (job_id, organization_id) REFERENCES public.generation_jobs(id, organization_id);



ALTER TABLE ONLY public.image_local_edits
    ADD CONSTRAINT image_local_edits_member_fk FOREIGN KEY (organization_id, user_id) REFERENCES public.organization_members(organization_id, user_id);



ALTER TABLE ONLY public.image_local_edits
    ADD CONSTRAINT image_local_edits_source_org_fk FOREIGN KEY (source_asset_id, organization_id) REFERENCES public.media_assets(id, organization_id);



ALTER TABLE ONLY public.media_assets
    ADD CONSTRAINT media_assets_membership_fk FOREIGN KEY (organization_id, user_id) REFERENCES public.organization_members(organization_id, user_id);



ALTER TABLE ONLY public.media_assets
    ADD CONSTRAINT media_assets_public_id_public_identifiers_value_fk FOREIGN KEY (public_id) REFERENCES public.public_identifiers(value);



ALTER TABLE ONLY public.model_audit_events
    ADD CONSTRAINT model_audit_events_actor_id_users_id_fk FOREIGN KEY (actor_id) REFERENCES public.users(id);



ALTER TABLE ONLY public.model_audit_events
    ADD CONSTRAINT model_audit_events_administrator_id_admin_users_id_fk FOREIGN KEY (administrator_id) REFERENCES public.admin_users(id);



ALTER TABLE ONLY public.model_catalog
    ADD CONSTRAINT model_catalog_provider_id_model_providers_id_fk FOREIGN KEY (provider_id) REFERENCES public.model_providers(id);



ALTER TABLE ONLY public.model_channels
    ADD CONSTRAINT model_channels_key_id_model_provider_keys_id_fk FOREIGN KEY (key_id) REFERENCES public.model_provider_keys(id);



ALTER TABLE ONLY public.model_channels
    ADD CONSTRAINT model_channels_model_model_catalog_code_fk FOREIGN KEY (model) REFERENCES public.model_catalog(code);



ALTER TABLE ONLY public.model_channels
    ADD CONSTRAINT model_channels_provider_id_model_providers_id_fk FOREIGN KEY (provider_id) REFERENCES public.model_providers(id);



ALTER TABLE ONLY public.model_planners
    ADD CONSTRAINT model_planners_provider_id_model_providers_id_fk FOREIGN KEY (provider_id) REFERENCES public.model_providers(id);



ALTER TABLE ONLY public.model_provider_keys
    ADD CONSTRAINT model_provider_keys_credential_id_model_credentials_id_fk FOREIGN KEY (credential_id) REFERENCES public.model_credentials(id);



ALTER TABLE ONLY public.model_provider_keys
    ADD CONSTRAINT model_provider_keys_provider_id_model_providers_id_fk FOREIGN KEY (provider_id) REFERENCES public.model_providers(id);



ALTER TABLE ONLY public.model_providers
    ADD CONSTRAINT model_providers_credential_id_model_credentials_id_fk FOREIGN KEY (credential_id) REFERENCES public.model_credentials(id);



ALTER TABLE ONLY public.model_routes
    ADD CONSTRAINT model_routes_channel_id_model_channels_id_fk FOREIGN KEY (channel_id) REFERENCES public.model_channels(id);



ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_owner_id_users_id_fk FOREIGN KEY (owner_id) REFERENCES public.users(id);



ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_task_owner_fk FOREIGN KEY (task_id, owner_id) REFERENCES public.tasks(id, owner_id);



ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);



ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);



ALTER TABLE ONLY public.organization_wallets
    ADD CONSTRAINT organization_wallets_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);



ALTER TABLE ONLY public.outbox_events
    ADD CONSTRAINT outbox_events_task_id_tasks_id_fk FOREIGN KEY (task_id) REFERENCES public.tasks(id);



ALTER TABLE ONLY public.platform_administrators
    ADD CONSTRAINT platform_administrators_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);



ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_owner_id_users_id_fk FOREIGN KEY (owner_id) REFERENCES public.users(id);



ALTER TABLE ONLY public.provider_executions
    ADD CONSTRAINT provider_executions_item_id_generation_job_items_id_fk FOREIGN KEY (item_id) REFERENCES public.generation_job_items(id);



ALTER TABLE ONLY public.recharge_orders
    ADD CONSTRAINT recharge_orders_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);



ALTER TABLE ONLY public.recharge_orders
    ADD CONSTRAINT recharge_orders_wallet_id_organization_wallets_id_fk FOREIGN KEY (wallet_id) REFERENCES public.organization_wallets(id);



ALTER TABLE ONLY public.task_items
    ADD CONSTRAINT task_items_task_id_tasks_id_fk FOREIGN KEY (task_id) REFERENCES public.tasks(id);



ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_owner_id_users_id_fk FOREIGN KEY (owner_id) REFERENCES public.users(id);



ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_project_owner_fk FOREIGN KEY (project_id, owner_id) REFERENCES public.projects(id, owner_id);



ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_uid_public_identifiers_value_fk FOREIGN KEY (uid) REFERENCES public.public_identifiers(value);



ALTER TABLE ONLY public.variation_plans
    ADD CONSTRAINT variation_plans_organization_id_user_id_organization_members_or FOREIGN KEY (organization_id, user_id) REFERENCES public.organization_members(organization_id, user_id);



ALTER TABLE ONLY public.wallet_checkins
    ADD CONSTRAINT wallet_checkins_ledger_id_wallet_entries_id_fk FOREIGN KEY (ledger_id) REFERENCES public.wallet_entries(id);



ALTER TABLE ONLY public.wallet_checkins
    ADD CONSTRAINT wallet_checkins_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);



ALTER TABLE ONLY public.wallet_checkins
    ADD CONSTRAINT wallet_checkins_wallet_id_organization_wallets_id_fk FOREIGN KEY (wallet_id) REFERENCES public.organization_wallets(id);



ALTER TABLE ONLY public.wallet_entries
    ADD CONSTRAINT wallet_entries_item_id_generation_job_items_id_fk FOREIGN KEY (item_id) REFERENCES public.generation_job_items(id);



ALTER TABLE ONLY public.wallet_entries
    ADD CONSTRAINT wallet_entries_job_id_generation_jobs_id_fk FOREIGN KEY (job_id) REFERENCES public.generation_jobs(id);



ALTER TABLE ONLY public.wallet_entries
    ADD CONSTRAINT wallet_entries_recharge_id_recharge_orders_id_fk FOREIGN KEY (recharge_id) REFERENCES public.recharge_orders(id);



ALTER TABLE ONLY public.wallet_entries
    ADD CONSTRAINT wallet_entries_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);



ALTER TABLE ONLY public.wallet_entries
    ADD CONSTRAINT wallet_entries_wallet_id_organization_wallets_id_fk FOREIGN KEY (wallet_id) REFERENCES public.organization_wallets(id);



ALTER TABLE public.admin_login_limits ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.admin_menu_entries ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.admin_user_roles ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.enterprise_accounts ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.enterprise_sessions ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.generation_api_keys ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.generation_credit_ledger ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.generation_events ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.generation_job_items ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.generation_jobs ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.generation_outbox ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.generation_retries ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.image_local_edits ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.login_rate_limits ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.model_audit_events ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.model_catalog ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.model_channels ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.model_credentials ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.model_planners ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.model_provider_keys ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.model_providers ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.model_routes ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.organization_wallets ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.outbox_events ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.platform_administrators ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.provider_executions ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.public_identifiers ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.recharge_orders ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.task_items ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.variation_plans ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.wallet_checkins ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.wallet_entries ENABLE ROW LEVEL SECURITY;
