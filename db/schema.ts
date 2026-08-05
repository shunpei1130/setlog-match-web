import { relations } from "drizzle-orm";
import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const eventStatus = pgEnum("event_status", ["open", "closed"]);
export const registrationStatus = pgEnum("registration_status", ["waiting", "cancelled"]);
export const lineStatus = pgEnum("line_status", ["not_registered", "registered"]);

export const events = pgTable("events", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventKey: text("event_key").notNull().unique(),
  startsAt: timestamp("starts_at", { withTimezone: true, mode: "date" }).notNull(),
  status: eventStatus("status").notNull().default("open"),
  capacity: integer("capacity").notNull().default(100),
  waitingCount: integer("waiting_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const eventRegistrations = pgTable(
  "event_registrations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").notNull(),
    status: registrationStatus("status").notNull().default("waiting"),
    lineStatus: lineStatus("line_status").notNull().default("not_registered"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    eventSessionUnique: uniqueIndex("event_registrations_event_session_idx").on(
      table.eventId,
      table.sessionId,
    ),
    waitingCountIndex: index("event_registrations_waiting_count_idx").on(
      table.eventId,
      table.status,
      table.lineStatus,
    ),
  }),
);

export const eventsRelations = relations(events, ({ many }) => ({
  registrations: many(eventRegistrations),
}));

export const eventRegistrationsRelations = relations(eventRegistrations, ({ one }) => ({
  event: one(events, {
    fields: [eventRegistrations.eventId],
    references: [events.id],
  }),
}));
