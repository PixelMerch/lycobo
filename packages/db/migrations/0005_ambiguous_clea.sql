CREATE TABLE "public_identifiers" (
	"value" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Reserve each published code once across all API/Worker processes. Reservations are
-- intentionally retained after a business row is removed, so codes are not recycled.
CREATE FUNCTION public.allocate_public_identifier(identifier_kind text) RETURNS text
LANGUAGE plpgsql VOLATILE SET search_path = pg_catalog, public AS $$
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
--> statement-breakpoint
-- Retire previously displayed numeric/L codes without making them available to a new user.
INSERT INTO public.public_identifiers (value) SELECT display_number::text FROM public.image_jobs ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO public.public_identifiers (value) SELECT 'L' || display_number::text FROM public.image_assets ON CONFLICT DO NOTHING;
--> statement-breakpoint

ALTER TABLE "image_assets" ALTER COLUMN "display_number" SET MAXVALUE 9223372036854775807;--> statement-breakpoint
ALTER TABLE "image_jobs" ALTER COLUMN "display_number" SET MAXVALUE 9223372036854775807;--> statement-breakpoint
ALTER TABLE "image_assets" ADD COLUMN "public_id" text DEFAULT public.allocate_public_identifier('image') NOT NULL;--> statement-breakpoint
ALTER TABLE "image_jobs" ADD COLUMN "public_id" text DEFAULT public.allocate_public_identifier('task') NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "uid" text DEFAULT public.allocate_public_identifier('user') NOT NULL;--> statement-breakpoint
ALTER TABLE "image_assets" ADD CONSTRAINT "image_assets_public_id_public_identifiers_value_fk" FOREIGN KEY ("public_id") REFERENCES "public"."public_identifiers"("value") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_jobs" ADD CONSTRAINT "image_jobs_public_id_public_identifiers_value_fk" FOREIGN KEY ("public_id") REFERENCES "public"."public_identifiers"("value") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_uid_public_identifiers_value_fk" FOREIGN KEY ("uid") REFERENCES "public"."public_identifiers"("value") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_assets" ADD CONSTRAINT "image_assets_public_id_unique" UNIQUE("public_id");--> statement-breakpoint
ALTER TABLE "image_jobs" ADD CONSTRAINT "image_jobs_public_id_unique" UNIQUE("public_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_uid_unique" UNIQUE("uid");