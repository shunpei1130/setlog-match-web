ALTER TABLE "event_registrations" ADD COLUMN "nickname" text;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD COLUMN "faculty" text;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD COLUMN "academic_year" text;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD COLUMN "gender" text;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_nickname_length" CHECK ("nickname" IS NULL OR char_length(btrim("nickname")) BETWEEN 1 AND 20);--> statement-breakpoint
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_faculty_length" CHECK ("faculty" IS NULL OR char_length(btrim("faculty")) BETWEEN 1 AND 40);--> statement-breakpoint
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_academic_year_value" CHECK ("academic_year" IS NULL OR "academic_year" IN ('1年', '2年', '3年', '4年', '修士1年', '修士2年', 'その他'));--> statement-breakpoint
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_gender_value" CHECK ("gender" IS NULL OR "gender" IN ('male', 'female', 'other'));--> statement-breakpoint
DROP FUNCTION IF EXISTS "public"."register_event_waiting"(uuid, uuid);--> statement-breakpoint
CREATE OR REPLACE FUNCTION "public"."register_event_waiting"(
	p_event_id uuid,
	p_session_id uuid,
	p_nickname text,
	p_faculty text,
	p_academic_year text,
	p_gender text
)
RETURNS TABLE(registered boolean, waiting_count integer, capacity integer)
LANGUAGE plpgsql
AS $function$
DECLARE
	event_capacity integer;
	event_waiting_count integer;
	existing_status registration_status;
	existing_line_status line_status;
BEGIN
	SELECT e."capacity", e."waiting_count"
	INTO event_capacity, event_waiting_count
	FROM "events" AS e
	WHERE e."id" = p_event_id
	FOR UPDATE;

	IF NOT FOUND THEN
		RAISE EXCEPTION 'EVENT_NOT_FOUND';
	END IF;

	SELECT r."status", r."line_status"
	INTO existing_status, existing_line_status
	FROM "event_registrations" AS r
	WHERE r."event_id" = p_event_id AND r."session_id" = p_session_id;

	IF existing_status = 'waiting'::registration_status
		AND existing_line_status = 'registered'::line_status THEN
		UPDATE "event_registrations"
		SET "nickname" = p_nickname,
			"faculty" = p_faculty,
			"academic_year" = p_academic_year,
			"gender" = p_gender,
			"updated_at" = now()
		WHERE "event_id" = p_event_id AND "session_id" = p_session_id;
		RETURN QUERY SELECT true, event_waiting_count, event_capacity;
		RETURN;
	END IF;

	IF event_waiting_count >= event_capacity THEN
		RETURN QUERY SELECT false, event_waiting_count, event_capacity;
		RETURN;
	END IF;

	INSERT INTO "event_registrations" (
		"event_id", "session_id", "status", "line_status",
		"nickname", "faculty", "academic_year", "gender", "updated_at"
	)
	VALUES (p_event_id, p_session_id, 'waiting', 'registered', p_nickname, p_faculty, p_academic_year, p_gender, now())
	ON CONFLICT ("event_id", "session_id") DO UPDATE SET
		"status" = 'waiting',
		"line_status" = 'registered',
		"nickname" = EXCLUDED."nickname",
		"faculty" = EXCLUDED."faculty",
		"academic_year" = EXCLUDED."academic_year",
		"gender" = EXCLUDED."gender",
		"updated_at" = now();

	UPDATE "events" AS e
	SET "waiting_count" = e."waiting_count" + 1
	WHERE e."id" = p_event_id;

	RETURN QUERY SELECT true, event_waiting_count + 1, event_capacity;
END;
$function$;--> statement-breakpoint
