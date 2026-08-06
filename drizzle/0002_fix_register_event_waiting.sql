CREATE OR REPLACE FUNCTION "public"."register_event_waiting"(
	p_event_id uuid,
	p_session_id uuid
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
		RETURN QUERY SELECT true, event_waiting_count, event_capacity;
		RETURN;
	END IF;

	IF event_waiting_count >= event_capacity THEN
		RETURN QUERY SELECT false, event_waiting_count, event_capacity;
		RETURN;
	END IF;

	INSERT INTO "event_registrations" (
		"event_id", "session_id", "status", "line_status", "updated_at"
	)
	VALUES (p_event_id, p_session_id, 'waiting', 'registered', now())
	ON CONFLICT ("event_id", "session_id") DO UPDATE SET
		"status" = 'waiting',
		"line_status" = 'registered',
		"updated_at" = now();

	UPDATE "events" AS e
	SET "waiting_count" = e."waiting_count" + 1
	WHERE e."id" = p_event_id;

	RETURN QUERY SELECT true, event_waiting_count + 1, event_capacity;
END;
$function$;
