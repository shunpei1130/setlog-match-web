import { relations } from "drizzle-orm";
import {
  boolean,
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
export const pairStatus = pgEnum("pair_status", ["draft", "published", "closed", "blocked"]);
export const safetyReportStatus = pgEnum("safety_report_status", ["open", "reviewed", "resolved"]);
export const disclosureChannel = pgEnum("disclosure_channel", ["instagram", "line"]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull().unique(),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true, mode: "date" }).notNull(),
    lineUserId: text("line_user_id").unique(),
    lineDisplayName: text("line_display_name"),
    lineFollowed: boolean("line_followed").notNull().default(false),
    lineLinkedAt: timestamp("line_linked_at", { withTimezone: true, mode: "date" }),
    instagramHandle: text("instagram_handle"),
    lineContact: text("line_contact"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    lineFollowerIndex: index("users_line_followed_idx").on(table.lineFollowed),
  }),
);

export const authenticationCodes = pgTable(
  "authentication_codes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    codeHash: text("code_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    consumedAt: timestamp("consumed_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    emailCreatedIndex: index("authentication_codes_email_created_idx").on(table.email, table.createdAt),
  }),
);

export const authSessions = pgTable(
  "auth_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    userExpiryIndex: index("auth_sessions_user_expiry_idx").on(table.userId, table.expiresAt),
  }),
);

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
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    sessionId: uuid("session_id").notNull(),
    status: registrationStatus("status").notNull().default("waiting"),
    lineStatus: lineStatus("line_status").notNull().default("not_registered"),
    nickname: text("nickname"),
    faculty: text("faculty"),
    academicYear: text("academic_year"),
    gender: text("gender"),
    ageConfirmedAt: timestamp("age_confirmed_at", { withTimezone: true, mode: "date" }),
    rulesAcceptedAt: timestamp("rules_accepted_at", { withTimezone: true, mode: "date" }),
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
    eventUserIndex: uniqueIndex("event_registrations_event_user_idx").on(table.eventId, table.userId),
  }),
);

export const eventPairs = pgTable(
  "event_pairs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    participantAId: uuid("participant_a_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    participantBId: uuid("participant_b_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: pairStatus("status").notNull().default("draft"),
    setlogUrl: text("setlog_url"),
    setlogCode: text("setlog_code"),
    publishedAt: timestamp("published_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    eventStatusIndex: index("event_pairs_event_status_idx").on(table.eventId, table.status),
    participantAIndex: index("event_pairs_participant_a_idx").on(table.participantAId),
    participantBIndex: index("event_pairs_participant_b_idx").on(table.participantBId),
  }),
);

export const pairDecisions = pgTable(
  "pair_decisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    pairId: uuid("pair_id")
      .notNull()
      .references(() => eventPairs.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    instagram: boolean("instagram").notNull().default(false),
    line: boolean("line").notNull().default(false),
    continueChoice: boolean("continue_choice").notNull().default(false),
    none: boolean("none").notNull().default(false),
    answered: boolean("answered").notNull().default(false),
    answeredAt: timestamp("answered_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    pairUserUnique: uniqueIndex("pair_decisions_pair_user_idx").on(table.pairId, table.userId),
  }),
);

export const contactDisclosures = pgTable(
  "contact_disclosures",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    pairId: uuid("pair_id")
      .notNull()
      .references(() => eventPairs.id, { onDelete: "cascade" }),
    sourceUserId: uuid("source_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetUserId: uuid("target_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    channel: disclosureChannel("channel").notNull(),
    disclosedAt: timestamp("disclosed_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    disclosureUnique: uniqueIndex("contact_disclosures_pair_source_target_channel_idx").on(
      table.pairId,
      table.sourceUserId,
      table.targetUserId,
      table.channel,
    ),
  }),
);

export const blocks = pgTable(
  "blocks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    pairId: uuid("pair_id")
      .notNull()
      .references(() => eventPairs.id, { onDelete: "cascade" }),
    blockerUserId: uuid("blocker_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blockedUserId: uuid("blocked_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    blockUnique: uniqueIndex("blocks_pair_blocker_blocked_idx").on(table.pairId, table.blockerUserId, table.blockedUserId),
  }),
);

export const safetyReports = pgTable(
  "safety_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    pairId: uuid("pair_id")
      .notNull()
      .references(() => eventPairs.id, { onDelete: "cascade" }),
    reporterUserId: uuid("reporter_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    detail: text("detail"),
    status: safetyReportStatus("status").notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    reportStatusIndex: index("safety_reports_status_created_idx").on(table.status, table.createdAt),
  }),
);

export const lineReminderDeliveries = pgTable(
  "line_reminder_deliveries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sentAt: timestamp("sent_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    deliveryUnique: uniqueIndex("line_reminder_deliveries_event_user_idx").on(table.eventId, table.userId),
  }),
);

export const eventsRelations = relations(events, ({ many }) => ({
  registrations: many(eventRegistrations),
  pairs: many(eventPairs),
  lineReminderDeliveries: many(lineReminderDeliveries),
}));

export const usersRelations = relations(users, ({ many }) => ({
  authSessions: many(authSessions),
  registrations: many(eventRegistrations),
  pairDecisions: many(pairDecisions),
  disclosuresFrom: many(contactDisclosures, { relationName: "disclosureSource" }),
  disclosuresTo: many(contactDisclosures, { relationName: "disclosureTarget" }),
  blocksMade: many(blocks, { relationName: "blocker" }),
  blocksReceived: many(blocks, { relationName: "blocked" }),
  reports: many(safetyReports),
  reminderDeliveries: many(lineReminderDeliveries),
}));

export const authSessionsRelations = relations(authSessions, ({ one }) => ({
  user: one(users, { fields: [authSessions.userId], references: [users.id] }),
}));

export const eventRegistrationsRelations = relations(eventRegistrations, ({ one }) => ({
  event: one(events, {
    fields: [eventRegistrations.eventId],
    references: [events.id],
  }),
  user: one(users, {
    fields: [eventRegistrations.userId],
    references: [users.id],
  }),
}));

export const eventPairsRelations = relations(eventPairs, ({ one, many }) => ({
  event: one(events, { fields: [eventPairs.eventId], references: [events.id] }),
  participantA: one(users, { fields: [eventPairs.participantAId], references: [users.id], relationName: "participantA" }),
  participantB: one(users, { fields: [eventPairs.participantBId], references: [users.id], relationName: "participantB" }),
  decisions: many(pairDecisions),
  disclosures: many(contactDisclosures),
  blocks: many(blocks),
  reports: many(safetyReports),
}));

export const pairDecisionsRelations = relations(pairDecisions, ({ one }) => ({
  pair: one(eventPairs, { fields: [pairDecisions.pairId], references: [eventPairs.id] }),
  user: one(users, { fields: [pairDecisions.userId], references: [users.id] }),
}));

export const contactDisclosuresRelations = relations(contactDisclosures, ({ one }) => ({
  pair: one(eventPairs, { fields: [contactDisclosures.pairId], references: [eventPairs.id] }),
  sourceUser: one(users, { fields: [contactDisclosures.sourceUserId], references: [users.id], relationName: "disclosureSource" }),
  targetUser: one(users, { fields: [contactDisclosures.targetUserId], references: [users.id], relationName: "disclosureTarget" }),
}));

export const blocksRelations = relations(blocks, ({ one }) => ({
  pair: one(eventPairs, { fields: [blocks.pairId], references: [eventPairs.id] }),
  blocker: one(users, { fields: [blocks.blockerUserId], references: [users.id], relationName: "blocker" }),
  blocked: one(users, { fields: [blocks.blockedUserId], references: [users.id], relationName: "blocked" }),
}));

export const safetyReportsRelations = relations(safetyReports, ({ one }) => ({
  pair: one(eventPairs, { fields: [safetyReports.pairId], references: [eventPairs.id] }),
  reporter: one(users, { fields: [safetyReports.reporterUserId], references: [users.id] }),
}));

export const lineReminderDeliveriesRelations = relations(lineReminderDeliveries, ({ one }) => ({
  event: one(events, { fields: [lineReminderDeliveries.eventId], references: [events.id] }),
  user: one(users, { fields: [lineReminderDeliveries.userId], references: [users.id] }),
}));
