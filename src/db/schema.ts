import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// Per D004 + the Phase 0 wireframe: a buyer/seller can express intent in one
// of three ways. Persisted as an enum so the value space is closed at the DB
// level.
export const waitlistRoleEnum = pgEnum("waitlist_role", [
  "buyer",
  "seller",
  "both",
]);

// Phase 0 deliverable per IMPLEMENTATION_PLAN.md.
// Cold-start audience capture: same DB as the eventual app (Phase 1 will add
// the rest of the schema in the same Drizzle setup).
//
// Fields chosen for the minimum we need to (a) confirm signup via email,
// (b) batch-invite by route + role in Phase 8, (c) attribute traffic source
// once we start running paid/organic experiments.
export const waitlist = pgTable(
  "waitlist",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(),
    phone: text("phone"),
    role: waitlistRoleEnum("role").notNull(),
    // Stored as a text array of route slugs from src/lib/routes.ts. Kept as
    // free-form text rather than a separate join table because the route set
    // is tiny, mostly-stable, and we want simple SQL filtering for invites.
    routes: text("routes").array().notNull(),
    // Free-form attribution string ('landing', 'reddit', 'student-society',
    // utm_*). Defaulted to 'landing' by the server action; nullable for
    // robustness against legacy inserts.
    source: text("source"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // Set once the P0-10 Resend confirmation email has been queued. Lets us
    // resend on duplicate-submit without keeping a separate jobs table at MVP.
    confirmationSentAt: timestamp("confirmation_sent_at", {
      withTimezone: true,
    }),
    // Set when the row has been picked up by a P8-01 invite batch.
    invitedAt: timestamp("invited_at", { withTimezone: true }),
  },
  (table) => [
    // Newest-first feeds, daily-signup dashboards.
    index("waitlist_created_at_idx").on(table.createdAt),
    // Quick "who's left to invite?" filter in Phase 8.
    index("waitlist_invited_at_idx").on(table.invitedAt),
  ]
);

export type WaitlistRow = typeof waitlist.$inferSelect;
export type WaitlistInsert = typeof waitlist.$inferInsert;
