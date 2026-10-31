CREATE TABLE "model_audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid NOT NULL,
	"action" text NOT NULL,
	"resource_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "model_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"name" text NOT NULL,
	"model" text NOT NULL,
	"settings" jsonb NOT NULL,
	"enabled" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "model_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ciphertext" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "model_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"origin" text NOT NULL,
	"adapter" text NOT NULL,
	"credential_id" uuid NOT NULL,
	"enabled" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "model_routes" (
	"tool" text NOT NULL,
	"model" text NOT NULL,
	"channel_id" uuid NOT NULL,
	CONSTRAINT "model_routes_tool_model_unique" UNIQUE("tool","model")
);
--> statement-breakpoint
CREATE TABLE "platform_administrators" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"enabled" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_executions" (
	"item_id" uuid PRIMARY KEY NOT NULL,
	"phase" text NOT NULL,
	"task_id" text,
	"status_path" text,
	"next_poll_at" timestamp with time zone,
	"lease_until" timestamp with time zone,
	"deadline_at" timestamp with time zone NOT NULL,
	"poll_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD COLUMN "provider_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "model_audit_events" ADD CONSTRAINT "model_audit_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_channels" ADD CONSTRAINT "model_channels_provider_id_model_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."model_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_providers" ADD CONSTRAINT "model_providers_credential_id_model_credentials_id_fk" FOREIGN KEY ("credential_id") REFERENCES "public"."model_credentials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_routes" ADD CONSTRAINT "model_routes_channel_id_model_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."model_channels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_administrators" ADD CONSTRAINT "platform_administrators_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_executions" ADD CONSTRAINT "provider_executions_item_id_generation_job_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."generation_job_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "model_audit_created_idx" ON "model_audit_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "model_channels_provider_idx" ON "model_channels" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "model_routes_channel_idx" ON "model_routes" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "provider_executions_due_idx" ON "provider_executions" USING btree ("next_poll_at");