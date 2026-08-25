CREATE TYPE IF NOT EXISTS "public"."funnel_event_name" AS ENUM('qualified_visit', 'auth_code_requested', 'email_verified', 'line_linked', 'line_followed', 'registration_completed', 'event_activated', 'decision_submitted');--> statement-breakpoint
CREATE TYPE IF NOT EXISTS "public"."gender_preference" AS ENUM('any', 'male', 'female', 'other');--> statement-breakpoint
CREATE TYPE IF NOT EXISTS "public"."match_purpose" AS ENUM('friend', 'romance', 'either');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "funnel_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visitor_id" uuid NOT NULL,
	"user_id" uuid,
	"event_id" uuid,
	"event_name" "funnel_event_name" NOT NULL,
	"ref_code" text,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"landing_path" text,
	"dedupe_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "funnel_events_dedupe_key_unique" UNIQUE("dedupe_key")
);
--> statement-breakpoint
ALTER TABLE "event_registrations" ADD COLUMN IF NOT EXISTS "purpose" "match_purpose" DEFAULT 'either' NOT NULL;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD COLUMN IF NOT EXISTS "preferred_gender" "gender_preference" DEFAULT 'any' NOT NULL;--> statement-breakpoint
ALTER TABLE "safety_reports" ADD COLUMN IF NOT EXISTS "admin_note" text;--> statement-breakpoint
ALTER TABLE "safety_reports" ADD COLUMN IF NOT EXISTS "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "safety_reports" ADD COLUMN IF NOT EXISTS "resolved_at" timestamp with time zone;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'funnel_events_user_id_users_id_fk'
      AND conrelid = 'public.funnel_events'::regclass
  ) THEN
    ALTER TABLE "funnel_events" ADD CONSTRAINT "funnel_events_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END
$$;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'funnel_events_event_id_events_id_fk'
      AND conrelid = 'public.funnel_events'::regclass
  ) THEN
    ALTER TABLE "funnel_events" ADD CONSTRAINT "funnel_events_event_id_events_id_fk"
      FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END
$$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "funnel_events_visitor_created_idx" ON "funnel_events" USING btree ("visitor_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "funnel_events_user_created_idx" ON "funnel_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "funnel_events_name_created_idx" ON "funnel_events" USING btree ("event_name","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "funnel_events_ref_created_idx" ON "funnel_events" USING btree ("ref_code","created_at");
--> statement-breakpoint
DROP FUNCTION IF EXISTS "public"."register_event_waiting"(uuid, uuid, uuid, text, text, text, text);
--> statement-breakpoint
DROP FUNCTION IF EXISTS "public"."register_event_waiting"(uuid, uuid);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "public"."register_event_waiting"(
	p_event_id uuid,
	p_session_id uuid,
	p_user_id uuid,
	p_nickname text,
	p_faculty text,
	p_academic_year text,
	p_gender text,
	p_purpose match_purpose,
	p_preferred_gender gender_preference
)
RETURNS TABLE(registered boolean, waiting_count integer, capacity integer)
LANGUAGE plpgsql
AS $$
DECLARE
	event_capacity integer;
	event_waiting_count integer;
	existing_status registration_status;
	existing_line_status line_status;
	existing_id uuid;
BEGIN
	SELECT e."capacity", e."waiting_count"
	INTO event_capacity, event_waiting_count
	FROM "events" AS e
	WHERE e."id" = p_event_id
	FOR UPDATE;

	IF NOT FOUND THEN
		RAISE EXCEPTION 'EVENT_NOT_FOUND';
	END IF;

	SELECT r."id", r."status", r."line_status"
	INTO existing_id, existing_status, existing_line_status
	FROM "event_registrations" AS r
	WHERE r."event_id" = p_event_id
		AND (r."user_id" = p_user_id OR r."session_id" = p_session_id)
	ORDER BY (r."user_id" = p_user_id) DESC
	LIMIT 1;

	IF existing_status = 'waiting'::registration_status
		AND existing_line_status = 'registered'::line_status THEN
		UPDATE "event_registrations"
		SET "user_id" = p_user_id,
			"session_id" = p_session_id,
			"nickname" = p_nickname,
			"faculty" = p_faculty,
			"academic_year" = p_academic_year,
			"gender" = p_gender,
			"purpose" = p_purpose,
			"preferred_gender" = p_preferred_gender,
			"updated_at" = now()
		WHERE "id" = existing_id;
		RETURN QUERY SELECT true, event_waiting_count, event_capacity;
		RETURN;
	END IF;

	IF event_waiting_count >= event_capacity THEN
		RETURN QUERY SELECT false, event_waiting_count, event_capacity;
		RETURN;
	END IF;

	IF existing_id IS NOT NULL THEN
		UPDATE "event_registrations"
		SET "user_id" = p_user_id,
			"session_id" = p_session_id,
			"status" = 'waiting',
			"line_status" = 'registered',
			"nickname" = p_nickname,
			"faculty" = p_faculty,
			"academic_year" = p_academic_year,
			"gender" = p_gender,
			"purpose" = p_purpose,
			"preferred_gender" = p_preferred_gender,
			"updated_at" = now()
		WHERE "id" = existing_id;
	ELSE
		INSERT INTO "event_registrations" (
			"event_id", "user_id", "session_id", "status", "line_status",
			"nickname", "faculty", "academic_year", "gender", "purpose", "preferred_gender", "updated_at"
		)
		VALUES (
			p_event_id, p_user_id, p_session_id, 'waiting', 'registered',
			p_nickname, p_faculty, p_academic_year, p_gender, p_purpose, p_preferred_gender, now()
		);
	END IF;

	UPDATE "events" AS e
	SET "waiting_count" = e."waiting_count" + 1
	WHERE e."id" = p_event_id;

	RETURN QUERY SELECT true, event_waiting_count + 1, event_capacity;
END;
$$;
