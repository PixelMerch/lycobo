CREATE TABLE "image_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "image_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"organization_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"resource_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "image_events_kind_check" CHECK ("image_events"."kind" in ('task','asset'))
);
--> statement-breakpoint
ALTER TABLE "image_events" ADD CONSTRAINT "image_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "image_events_org_cursor_idx" ON "image_events" USING btree ("organization_id","id");--> statement-breakpoint
CREATE INDEX "image_events_created_idx" ON "image_events" USING btree ("created_at");