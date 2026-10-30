CREATE TABLE "event_pair_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"pair_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"joined_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "matching_runs" (
	"event_id" uuid PRIMARY KEY NOT NULL,
	"seed" text NOT NULL,
	"eligible_count" integer NOT NULL,
	"paired_count" integer NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pair_extensions" (
	"source_pair_id" uuid PRIMARY KEY NOT NULL,
	"target_pair_id" uuid,
	"event_id" uuid NOT NULL,
	"status" text DEFAULT 'reserved' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_pairs" ADD COLUMN "invite_submitted_by" uuid;--> statement-breakpoint
ALTER TABLE "event_pairs" ADD COLUMN "finalized_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "kind" text DEFAULT 'weekly' NOT NULL;--> statement-breakpoint
ALTER TABLE "event_pair_members" ADD CONSTRAINT "event_pair_members_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_pair_members" ADD CONSTRAINT "event_pair_members_pair_id_event_pairs_id_fk" FOREIGN KEY ("pair_id") REFERENCES "public"."event_pairs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_pair_members" ADD CONSTRAINT "event_pair_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matching_runs" ADD CONSTRAINT "matching_runs_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pair_extensions" ADD CONSTRAINT "pair_extensions_source_pair_id_event_pairs_id_fk" FOREIGN KEY ("source_pair_id") REFERENCES "public"."event_pairs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pair_extensions" ADD CONSTRAINT "pair_extensions_target_pair_id_event_pairs_id_fk" FOREIGN KEY ("target_pair_id") REFERENCES "public"."event_pairs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pair_extensions" ADD CONSTRAINT "pair_extensions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "event_pair_members_event_user_idx" ON "event_pair_members" USING btree ("event_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "event_pair_members_pair_user_idx" ON "event_pair_members" USING btree ("pair_id","user_id");--> statement-breakpoint
ALTER TABLE "event_pairs" ADD CONSTRAINT "event_pairs_invite_submitted_by_users_id_fk" FOREIGN KEY ("invite_submitted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE events ADD CONSTRAINT events_kind_check CHECK (kind IN ('weekly','extension'));
--> statement-breakpoint
ALTER TABLE event_pairs ADD CONSTRAINT event_pairs_distinct_participants CHECK (participant_a_id <> participant_b_id);
--> statement-breakpoint
CREATE FUNCTION sync_set_mob_pair_members() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.event_id=OLD.event_id
    AND NEW.participant_a_id=OLD.participant_a_id AND NEW.participant_b_id=OLD.participant_b_id THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' THEN DELETE FROM event_pair_members WHERE pair_id=NEW.id; END IF;
  INSERT INTO event_pair_members (event_id,pair_id,user_id)
    VALUES (NEW.event_id,NEW.id,NEW.participant_a_id),(NEW.event_id,NEW.id,NEW.participant_b_id);
  RETURN NEW;
END $$;
--> statement-breakpoint
INSERT INTO event_pair_members (event_id,pair_id,user_id)
SELECT event_id,id,participant_a_id FROM event_pairs
UNION ALL SELECT event_id,id,participant_b_id FROM event_pairs;
--> statement-breakpoint
CREATE TRIGGER set_mob_pair_members AFTER INSERT OR UPDATE OF event_id,participant_a_id,participant_b_id
ON event_pairs FOR EACH ROW EXECUTE FUNCTION sync_set_mob_pair_members();
--> statement-breakpoint
CREATE FUNCTION validate_set_mob_pair() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a event_registrations; b event_registrations;
BEGIN
  IF TG_OP='UPDATE' AND OLD.finalized_at IS NOT NULL AND
    (NEW.participant_a_id<>OLD.participant_a_id OR NEW.participant_b_id<>OLD.participant_b_id OR NEW.event_id<>OLD.event_id)
    THEN RAISE EXCEPTION 'PAIR_FINALIZED'; END IF;
  IF NEW.status NOT IN ('draft','published') THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' AND OLD.status='published' AND NEW.status='published'
    AND NEW.event_id=OLD.event_id AND NEW.participant_a_id=OLD.participant_a_id
    AND NEW.participant_b_id=OLD.participant_b_id THEN RETURN NEW; END IF;
  SELECT * INTO a FROM event_registrations WHERE event_id=NEW.event_id AND user_id=NEW.participant_a_id;
  SELECT * INTO b FROM event_registrations WHERE event_id=NEW.event_id AND user_id=NEW.participant_b_id;
  IF a.id IS NULL OR b.id IS NULL OR a.status<>'waiting' OR b.status<>'waiting'
    OR a.line_status<>'registered' OR b.line_status<>'registered'
    OR a.age_confirmed_at IS NULL OR b.age_confirmed_at IS NULL
    OR a.rules_accepted_at IS NULL OR b.rules_accepted_at IS NULL
    OR a.gender IS NULL OR b.gender IS NULL
    OR NOT (a.purpose='either' OR b.purpose='either' OR a.purpose=b.purpose)
    OR NOT (a.preferred_gender='any' OR a.preferred_gender::text=b.gender)
    OR NOT (b.preferred_gender='any' OR b.preferred_gender::text=a.gender)
    THEN RAISE EXCEPTION 'PAIR_PREFERENCES_MISMATCH'; END IF;
  IF (SELECT count(*) FROM users WHERE id IN (NEW.participant_a_id,NEW.participant_b_id)
    AND email_verified_at IS NOT NULL AND line_user_id IS NOT NULL AND line_followed) <> 2
    THEN RAISE EXCEPTION 'PAIR_PARTICIPANT_NOT_ELIGIBLE'; END IF;
  IF EXISTS (SELECT 1 FROM blocks WHERE
    (blocker_user_id=NEW.participant_a_id AND blocked_user_id=NEW.participant_b_id)
    OR (blocker_user_id=NEW.participant_b_id AND blocked_user_id=NEW.participant_a_id))
    THEN RAISE EXCEPTION 'PAIR_BLOCKED'; END IF;
  IF EXISTS (SELECT 1 FROM events e JOIN event_pairs p ON p.event_id<>e.id
    JOIN events previous ON previous.id=p.event_id
    WHERE e.id=NEW.event_id AND e.kind='weekly' AND previous.starts_at<e.starts_at AND p.published_at IS NOT NULL
    AND ((p.participant_a_id=NEW.participant_a_id AND p.participant_b_id=NEW.participant_b_id)
      OR (p.participant_a_id=NEW.participant_b_id AND p.participant_b_id=NEW.participant_a_id)))
    THEN RAISE EXCEPTION 'PAIR_PREVIOUSLY_MATCHED'; END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER set_mob_validate_pair BEFORE INSERT OR UPDATE ON event_pairs
FOR EACH ROW EXECUTE FUNCTION validate_set_mob_pair();
