CREATE OR REPLACE FUNCTION "public"."__setlog_create_funnel_event_name"() RETURNS void
LANGUAGE sql
AS $body$ CREATE TYPE "public"."funnel_event_name" AS ENUM('qualified_visit', 'auth_code_requested', 'email_verified', 'line_linked', 'line_followed', 'registration_completed', 'event_activated', 'decision_submitted') $body$;--> statement-breakpoint
SELECT "public"."__setlog_create_funnel_event_name"()
WHERE NOT EXISTS (
	SELECT 1 FROM pg_type
	WHERE typname = 'funnel_event_name' AND typnamespace = 'public'::regnamespace
);--> statement-breakpoint
DROP FUNCTION "public"."__setlog_create_funnel_event_name"();--> statement-breakpoint
CREATE OR REPLACE FUNCTION "public"."__setlog_create_gender_preference"() RETURNS void
LANGUAGE sql
AS $body$ CREATE TYPE "public"."gender_preference" AS ENUM('any', 'male', 'female', 'other') $body$;--> statement-breakpoint
SELECT "public"."__setlog_create_gender_preference"()
WHERE NOT EXISTS (
	SELECT 1 FROM pg_type
	WHERE typname = 'gender_preference' AND typnamespace = 'public'::regnamespace
);--> statement-breakpoint
DROP FUNCTION "public"."__setlog_create_gender_preference"();--> statement-breakpoint
CREATE OR REPLACE FUNCTION "public"."__setlog_create_match_purpose"() RETURNS void
LANGUAGE sql
AS $body$ CREATE TYPE "public"."match_purpose" AS ENUM('friend', 'romance', 'either') $body$;--> statement-breakpoint
SELECT "public"."__setlog_create_match_purpose"()
WHERE NOT EXISTS (
	SELECT 1 FROM pg_type
	WHERE typname = 'match_purpose' AND typnamespace = 'public'::regnamespace
);--> statement-breakpoint
DROP FUNCTION "public"."__setlog_create_match_purpose"();--> statement-breakpoint
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
CREATE OR REPLACE FUNCTION "public"."__setlog_add_funnel_events_user_fk"() RETURNS void
LANGUAGE sql
AS $body$ ALTER TABLE "funnel_events" ADD CONSTRAINT "funnel_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action $body$;--> statement-breakpoint
SELECT "public"."__setlog_add_funnel_events_user_fk"()
WHERE NOT EXISTS (
	SELECT 1 FROM pg_constraint
	WHERE conname = 'funnel_events_user_id_users_id_fk'
		AND conrelid = 'public.funnel_events'::regclass
);--> statement-breakpoint
DROP FUNCTION "public"."__setlog_add_funnel_events_user_fk"();--> statement-breakpoint
CREATE OR REPLACE FUNCTION "public"."__setlog_add_funnel_events_event_fk"() RETURNS void
LANGUAGE sql
AS $body$ ALTER TABLE "funnel_events" ADD CONSTRAINT "funnel_events_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action $body$;--> statement-breakpoint
SELECT "public"."__setlog_add_funnel_events_event_fk"()
WHERE NOT EXISTS (
	SELECT 1 FROM pg_constraint
	WHERE conname = 'funnel_events_event_id_events_id_fk'
		AND conrelid = 'public.funnel_events'::regclass
);--> statement-breakpoint
DROP FUNCTION "public"."__setlog_add_funnel_events_event_fk"();--> statement-breakpoint
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
LANGUAGE sql
AS $function$
WITH event_lock AS (
	SELECT e."id", e."capacity", e."waiting_count"
	FROM "events" AS e
	WHERE e."id" = p_event_id
	FOR UPDATE
), existing AS (
	SELECT r."id", r."status", r."line_status"
	FROM "event_registrations" AS r
	JOIN event_lock AS e ON e."id" = r."event_id"
	WHERE r."user_id" = p_user_id OR r."session_id" = p_session_id
	ORDER BY (r."user_id" = p_user_id) DESC
	LIMIT 1
), active_existing AS (
	SELECT x."id"
	FROM existing AS x
	WHERE x."status" = 'waiting'::registration_status
	  AND x."line_status" = 'registered'::line_status
), existing_update AS (
	UPDATE "event_registrations" AS r
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
	FROM event_lock AS e
	CROSS JOIN existing AS x
	WHERE ((x."status" = 'waiting'::registration_status AND x."line_status" = 'registered'::line_status)
	   OR e."waiting_count" < e."capacity")
	  AND r."id" = x."id"
	RETURNING r."id"
), inserted AS (
	INSERT INTO "event_registrations" (
		"event_id", "user_id", "session_id", "status", "line_status",
		"nickname", "faculty", "academic_year", "gender", "purpose", "preferred_gender", "updated_at"
	)
	SELECT p_event_id, p_user_id, p_session_id, 'waiting', 'registered',
		p_nickname, p_faculty, p_academic_year, p_gender, p_purpose, p_preferred_gender, now()
	FROM event_lock AS e
	WHERE e."waiting_count" < e."capacity"
	  AND NOT EXISTS (SELECT 1 FROM existing)
	ON CONFLICT ("event_id", "session_id") DO UPDATE SET
		"user_id" = EXCLUDED."user_id",
		"status" = 'waiting',
		"line_status" = 'registered',
		"nickname" = EXCLUDED."nickname",
		"faculty" = EXCLUDED."faculty",
		"academic_year" = EXCLUDED."academic_year",
		"gender" = EXCLUDED."gender",
		"purpose" = EXCLUDED."purpose",
		"preferred_gender" = EXCLUDED."preferred_gender",
		"updated_at" = now()
	RETURNING "id"
), changed AS (
	SELECT u."id" FROM existing_update AS u
	WHERE NOT EXISTS (SELECT 1 FROM active_existing)
	UNION ALL
	SELECT i."id" FROM inserted AS i
), bumped AS (
	UPDATE "events" AS e
	SET "waiting_count" = e."waiting_count" + 1
	FROM event_lock AS locked
	WHERE e."id" = locked."id"
	  AND EXISTS (SELECT 1 FROM changed)
	RETURNING e."waiting_count"
)
SELECT
	(EXISTS (SELECT 1 FROM active_existing) OR EXISTS (SELECT 1 FROM changed)) AS registered,
	CASE
		WHEN EXISTS (SELECT 1 FROM active_existing) THEN locked."waiting_count"
		WHEN EXISTS (SELECT 1 FROM changed) THEN locked."waiting_count" + 1
		ELSE locked."waiting_count"
	END AS waiting_count,
	locked."capacity" AS capacity
FROM event_lock AS locked
CROSS JOIN (SELECT count(*) FROM bumped) AS _bumped
$function$;
