CREATE TYPE "public"."event_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TYPE "public"."line_status" AS ENUM('not_registered', 'registered');--> statement-breakpoint
CREATE TYPE "public"."registration_status" AS ENUM('waiting', 'cancelled');--> statement-breakpoint
CREATE TABLE "event_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"status" "registration_status" DEFAULT 'waiting' NOT NULL,
	"line_status" "line_status" DEFAULT 'not_registered' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_key" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"status" "event_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_event_key_unique" UNIQUE("event_key")
);
--> statement-breakpoint
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "event_registrations_event_session_idx" ON "event_registrations" USING btree ("event_id","session_id");--> statement-breakpoint
CREATE INDEX "event_registrations_waiting_count_idx" ON "event_registrations" USING btree ("event_id","status","line_status");