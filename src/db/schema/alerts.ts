import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./users";

// Buyer-side saved alerts. Per D010, both push notifications and the
// browseable feed exist; this table powers the push side.
//
// Matching semantics (§3.7):
//   route_origin + route_destination       — case-insensitive exact match
//                                             against Listing.route_*
//   window_start ≤ Listing.departure_at ≤ window_end
//   max_price_pence ≥ Listing.current_price_pence
//
// Notification fan-out is best-effort: throttle at most one per
// (alert, listing) pair per 15 minutes — the decay-price job can re-match.
//
// We DON'T store an `enabled` flag — disabled = deleted at MVP. Saves a
// status column we never query against.
export const routeAlerts = pgTable(
  "route_alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // Normalised upper-case station names. Same shape as Listing.route_*.
    routeOrigin: text("route_origin").notNull(),
    routeDestination: text("route_destination").notNull(),

    // Optional bound — null max means "any price up to the seller's cap".
    maxPricePence: integer("max_price_pence"),

    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    windowEnd: timestamp("window_end", { withTimezone: true }).notNull(),

    // Notification channels. Email is always on (it's the cheapest); SMS is
    // opt-in per D017 and only available when the user has a verified phone.
    notifyEmail: boolean("notify_email").notNull().default(true),
    notifySms: boolean("notify_sms").notNull().default(false),
    notifyPush: boolean("notify_push").notNull().default(false),

    // Used for throttling — match-alerts job won't fire twice within 15 min.
    lastMatchAt: timestamp("last_match_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Window has to be a forward-going interval.
    check(
      "route_alerts_window_ordered",
      sql`${table.windowEnd} > ${table.windowStart}`
    ),
    check(
      "route_alerts_max_price_positive",
      sql`${table.maxPricePence} IS NULL OR ${table.maxPricePence} > 0`
    ),
    // The hot query for match-alerts: by route + window-overlap.
    index("route_alerts_route_idx").on(
      table.routeOrigin,
      table.routeDestination,
      table.windowStart,
      table.windowEnd
    ),
    // User's "my alerts" view.
    index("route_alerts_user_idx").on(table.userId, table.createdAt),
  ]
);

export type RouteAlertRow = typeof routeAlerts.$inferSelect;
export type RouteAlertInsert = typeof routeAlerts.$inferInsert;
