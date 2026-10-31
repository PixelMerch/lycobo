CREATE TABLE "model_planners" (
	"tool" text PRIMARY KEY NOT NULL,
	"provider_id" uuid NOT NULL,
	"origin" text NOT NULL,
	"upstream_model" text NOT NULL,
	"enabled" integer DEFAULT 0 NOT NULL,
	"timeout_ms" integer DEFAULT 25000 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "model_planner_enabled" CHECK ("model_planners"."enabled" in (0,1)),
	CONSTRAINT "model_planner_timeout" CHECK ("model_planners"."timeout_ms" between 5000 and 60000)
);
--> statement-breakpoint
ALTER TABLE "model_planners" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "variation_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"input_hash" text NOT NULL,
	"input" jsonb NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "variation_plan_idempotency" UNIQUE("organization_id","user_id","idempotency_key"),
	CONSTRAINT "variation_plan_status" CHECK ("variation_plans"."status" in ('running','ready','failed','uncertain'))
);
--> statement-breakpoint
ALTER TABLE "variation_plans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "generation_jobs" DROP CONSTRAINT "generation_jobs_count_check";--> statement-breakpoint
ALTER TABLE "model_planners" ADD CONSTRAINT "model_planners_provider_id_model_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."model_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variation_plans" ADD CONSTRAINT "variation_plans_organization_id_user_id_organization_members_organization_id_user_id_fk" FOREIGN KEY ("organization_id","user_id") REFERENCES "public"."organization_members"("organization_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "variation_plan_owner_created" ON "variation_plans" USING btree ("organization_id","user_id","created_at");--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_count_check" CHECK ("generation_jobs"."requested_count" between 1 and 10 and "generation_jobs"."unit_credits" > 0 and ("generation_jobs"."requested_count" <= 4 or "generation_jobs"."input" ? 'textileSet' or "generation_jobs"."input" ? 'variation'));