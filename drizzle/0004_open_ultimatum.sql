CREATE TYPE "public"."disclosure_channel" AS ENUM('instagram', 'line');--> statement-breakpoint
CREATE TYPE "public"."pair_status" AS ENUM('draft', 'published', 'closed', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."safety_report_status" AS ENUM('open', 'reviewed', 'resolved');--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "authentication_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pair_id" uuid NOT NULL,
	"blocker_user_id" uuid NOT NULL,
	"blocked_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_disclosures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pair_id" uuid NOT NULL,
	"source_user_id" uuid NOT NULL,
	"target_user_id" uuid NOT NULL,
	"channel" "disclosure_channel" NOT NULL,
	"disclosed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_pairs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"participant_a_id" uuid NOT NULL,
	"participant_b_id" uuid NOT NULL,
	"status" "pair_status" DEFAULT 'draft' NOT NULL,
	"setlog_url" text,
	"setlog_code" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "line_reminder_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pair_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pair_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"instagram" boolean DEFAULT false NOT NULL,
	"line" boolean DEFAULT false NOT NULL,
	"continue_choice" boolean DEFAULT false NOT NULL,
	"none" boolean DEFAULT false NOT NULL,
	"answered" boolean DEFAULT false NOT NULL,
	"answered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "safety_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pair_id" uuid NOT NULL,
	"reporter_user_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"detail" text,
	"status" "safety_report_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"email_verified_at" timestamp with time zone NOT NULL,
	"line_user_id" text,
	"line_display_name" text,
	"line_followed" boolean DEFAULT false NOT NULL,
	"line_linked_at" timestamp with time zone,
	"instagram_handle" text,
	"line_contact" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_line_user_id_unique" UNIQUE("line_user_id")
);
--> statement-breakpoint
ALTER TABLE "event_registrations" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD COLUMN "age_confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD COLUMN "rules_accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_pair_id_event_pairs_id_fk" FOREIGN KEY ("pair_id") REFERENCES "public"."event_pairs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocker_user_id_users_id_fk" FOREIGN KEY ("blocker_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocked_user_id_users_id_fk" FOREIGN KEY ("blocked_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_disclosures" ADD CONSTRAINT "contact_disclosures_pair_id_event_pairs_id_fk" FOREIGN KEY ("pair_id") REFERENCES "public"."event_pairs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_disclosures" ADD CONSTRAINT "contact_disclosures_source_user_id_users_id_fk" FOREIGN KEY ("source_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_disclosures" ADD CONSTRAINT "contact_disclosures_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_pairs" ADD CONSTRAINT "event_pairs_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_pairs" ADD CONSTRAINT "event_pairs_participant_a_id_users_id_fk" FOREIGN KEY ("participant_a_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_pairs" ADD CONSTRAINT "event_pairs_participant_b_id_users_id_fk" FOREIGN KEY ("participant_b_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_reminder_deliveries" ADD CONSTRAINT "line_reminder_deliveries_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_reminder_deliveries" ADD CONSTRAINT "line_reminder_deliveries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pair_decisions" ADD CONSTRAINT "pair_decisions_pair_id_event_pairs_id_fk" FOREIGN KEY ("pair_id") REFERENCES "public"."event_pairs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pair_decisions" ADD CONSTRAINT "pair_decisions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safety_reports" ADD CONSTRAINT "safety_reports_pair_id_event_pairs_id_fk" FOREIGN KEY ("pair_id") REFERENCES "public"."event_pairs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safety_reports" ADD CONSTRAINT "safety_reports_reporter_user_id_users_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auth_sessions_user_expiry_idx" ON "auth_sessions" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE INDEX "authentication_codes_email_created_idx" ON "authentication_codes" USING btree ("email","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "blocks_pair_blocker_blocked_idx" ON "blocks" USING btree ("pair_id","blocker_user_id","blocked_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contact_disclosures_pair_source_target_channel_idx" ON "contact_disclosures" USING btree ("pair_id","source_user_id","target_user_id","channel");--> statement-breakpoint
CREATE INDEX "event_pairs_event_status_idx" ON "event_pairs" USING btree ("event_id","status");--> statement-breakpoint
CREATE INDEX "event_pairs_participant_a_idx" ON "event_pairs" USING btree ("participant_a_id");--> statement-breakpoint
CREATE INDEX "event_pairs_participant_b_idx" ON "event_pairs" USING btree ("participant_b_id");--> statement-breakpoint
CREATE UNIQUE INDEX "line_reminder_deliveries_event_user_idx" ON "line_reminder_deliveries" USING btree ("event_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pair_decisions_pair_user_idx" ON "pair_decisions" USING btree ("pair_id","user_id");--> statement-breakpoint
CREATE INDEX "safety_reports_status_created_idx" ON "safety_reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "users_line_followed_idx" ON "users" USING btree ("line_followed");--> statement-breakpoint
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "event_registrations_event_user_idx" ON "event_registrations" USING btree ("event_id","user_id");
--> statement-breakpoint
DROP FUNCTION IF EXISTS "public"."register_event_waiting"(uuid, uuid, text, text, text, text);--> statement-breakpoint
CREATE OR REPLACE FUNCTION "public"."register_event_waiting"(
	p_event_id uuid,
	p_session_id uuid,
	p_user_id uuid,
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
	existing_id uuid;
	inserted_count integer;
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
		AND (r."session_id" = p_session_id OR r."user_id" = p_user_id)
	LIMIT 1;

	IF existing_status = 'waiting'::registration_status
		AND existing_line_status = 'registered'::line_status THEN
		UPDATE "event_registrations"
		SET "user_id" = p_user_id,
			"nickname" = p_nickname,
			"faculty" = p_faculty,
			"academic_year" = p_academic_year,
			"gender" = p_gender,
			"updated_at" = now()
		WHERE "id" = existing_id;
		RETURN QUERY SELECT true, event_waiting_count, event_capacity;
		RETURN;
	END IF;

	IF event_waiting_count >= event_capacity THEN
		RETURN QUERY SELECT false, event_waiting_count, event_capacity;
		RETURN;
	END IF;

	INSERT INTO "event_registrations" (
		"event_id", "user_id", "session_id", "status", "line_status",
		"nickname", "faculty", "academic_year", "gender", "updated_at"
	)
	VALUES (p_event_id, p_user_id, p_session_id, 'waiting', 'registered', p_nickname, p_faculty, p_academic_year, p_gender, now())
	ON CONFLICT ("event_id", "session_id") DO UPDATE SET
		"user_id" = EXCLUDED."user_id",
		"status" = 'waiting',
		"line_status" = 'registered',
		"nickname" = EXCLUDED."nickname",
		"faculty" = EXCLUDED."faculty",
		"academic_year" = EXCLUDED."academic_year",
		"gender" = EXCLUDED."gender",
		"updated_at" = now();

	GET DIAGNOSTICS inserted_count = ROW_COUNT;
	IF inserted_count = 0 THEN
		RETURN QUERY SELECT true, event_waiting_count, event_capacity;
		RETURN;
	END IF;

	UPDATE "events" AS e
	SET "waiting_count" = e."waiting_count" + 1
	WHERE e."id" = p_event_id;

	RETURN QUERY SELECT true, event_waiting_count + 1, event_capacity;
END;
$function$;
