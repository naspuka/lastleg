import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./users";

// Append-only audit trail. Every state-changing action writes here; the
// table is read-mostly except for inserts.
//
// What we record (§6 audit-log section):
//   actor_user_id   — null for system actions (cron jobs, webhooks)
//   action          — short verb-noun string like "listing.create",
//                     "transaction.pay", "guarantee_claim.auto_approve"
//   entity_type     — "listing" | "transaction" | "user" | "guarantee_claim"
//                     | "operator_ticket" | "stripe_event" | …
//   entity_id       — the affected row's id (uuid as text — entity_type
//                     varies so we can't have a typed FK)
//   payload_jsonb   — snapshot of relevant state, plus the Stripe event id
//                     for money-moving actions
//
// Indexing: per-entity timeline (for "show the history of this listing") is
// the dominant query. We also keep a global by-time index for incident
// investigation.
//
// The table is never UPDATE-d or DELETE-d. Compliance-grade.
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Null when the actor is the system (a cron, an Inngest job, a webhook).
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),

    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),

    // Free-form context. Keep it small — large payloads belong in the entity
    // itself, not the audit row.
    payload: jsonb("payload"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Entity timeline view ("everything that happened to listing X, newest
    // first"). Most-used query.
    index("audit_log_entity_idx").on(
      table.entityType,
      table.entityId,
      table.createdAt
    ),
    // Global activity feed for incident response.
    index("audit_log_created_at_idx").on(table.createdAt),
    // "What did user X do?" for fraud investigation.
    index("audit_log_actor_idx").on(table.actorUserId, table.createdAt),
  ]
);

export type AuditLogRow = typeof auditLog.$inferSelect;
export type AuditLogInsert = typeof auditLog.$inferInsert;
