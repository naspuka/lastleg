import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import {
  listingStatusEnum,
  listingVerificationStatusEnum,
  operatorEnum,
  operatorTicketStatusEnum,
} from "./enums";
import { users } from "./users";

// ─── Listing ─────────────────────────────────────────────────────────────────
//
// A seller's listing of an unused ticket. The Listing row is the marketplace
// entity; the underlying ticket asset is OperatorTicket (1:1 in steady state,
// but a withdrawn listing leaves the OperatorTicket re-listable later).
//
// Pricing is in pence (integer) per the conventions doc. Three columns:
//   - original_price_pence: what the seller paid (the D005 cap)
//   - list_price_pence: seller's starting ask (≤ original)
//   - current_price_pence: live displayed price, decayed by the decay-price
//                          job toward floor (D006)
// Invariants enforced both at app layer and via CHECK constraints below.
//
// PDF + verification flow (D011 + §3.1):
//   pending_verification → live | failed
// Parser pulls operator/booking_ref/route/time/price/passenger name from PDF.
// Receipt-email match closes the loop on original price.
//
// Departure timing drives every job:
//   - decay-price: every 5 min while live
//   - expire-listing: at departure_at if still live
//   - release-ticket: at max(now, departure_at - 30min) once sold
//   - release-payout: at departure_at + 1h once sold
//
// Soft-delete: we never DELETE listings; status transitions handle the
// lifecycle and AuditLog records every state change.
export const listings = pgTable(
  "listings",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    sellerId: uuid("seller_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),

    // Operator + route + time triplet extracted from the PDF. Stored on
    // Listing (not OperatorTicket) because we display these in the feed
    // before verification is complete (status=pending).
    operator: operatorEnum("operator").notNull(),
    // Free-form station strings as printed on the ticket. Normalised to
    // upper-case at parse time so search is case-insensitive.
    routeOrigin: text("route_origin").notNull(),
    routeDestination: text("route_destination").notNull(),
    departureAt: timestamp("departure_at", { withTimezone: true }).notNull(),

    // Money in pence (D007 + conventions).
    originalPricePence: integer("original_price_pence").notNull(),
    listPricePence: integer("list_price_pence").notNull(),
    floorPricePence: integer("floor_price_pence").notNull(),
    currentPricePence: integer("current_price_pence").notNull(),

    // Named-ticket disclosure data (D016). Stored as first name + initial,
    // never the full name, per §6 data-minimisation.
    hasPassengerName: boolean("has_passenger_name").notNull().default(false),
    passengerNameFirst: text("passenger_name_first"),

    // PDF blob stored privately in Vercel Blob; the URL here is the canonical
    // reference. Short-TTL signed URLs are minted at delivery time.
    ticketPdfBlobUrl: text("ticket_pdf_blob_url"),

    // Operator-side identifiers used both for verification (dup-detection)
    // and for the scan-API integration in Phase 5.
    bookingReference: text("booking_reference"),
    operatorPnr: text("operator_pnr"),

    // SHA-256 of the receipt-email sender + body. Set when an inbound receipt
    // matches this listing. Used for forensic audit, never PII.
    receiptEmailHash: text("receipt_email_hash"),

    status: listingStatusEnum("status").notNull().default("draft"),
    verificationStatus: listingVerificationStatusEnum("verification_status")
      .notNull()
      .default("pending"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // Listing self-expires at departure unless explicitly extended.
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // No-scalping cap (D005): list price never above original.
    check(
      "listings_list_le_original",
      sql`${table.listPricePence} <= ${table.originalPricePence}`
    ),
    // Floor is the auto-discount lower bound; can't be above the asking
    // price (D006).
    check(
      "listings_floor_le_list",
      sql`${table.floorPricePence} <= ${table.listPricePence}`
    ),
    // Sanity: prices are positive integers (in pence).
    check(
      "listings_prices_positive",
      sql`${table.originalPricePence} > 0 AND ${table.listPricePence} > 0 AND ${table.floorPricePence} >= 0 AND ${table.currentPricePence} >= 0`
    ),

    // Feed queries: list-live-by-departure, filter by route.
    index("listings_status_departure_idx").on(table.status, table.departureAt),
    index("listings_route_idx").on(
      table.routeOrigin,
      table.routeDestination,
      table.departureAt
    ),
    // Seller's own listings page.
    index("listings_seller_idx").on(table.sellerId, table.createdAt),
    // Operator+booking lookup for receipt matching.
    index("listings_op_booking_idx").on(table.operator, table.bookingReference),
  ]
);

export type ListingRow = typeof listings.$inferSelect;
export type ListingInsert = typeof listings.$inferInsert;

// ─── OperatorTicket ──────────────────────────────────────────────────────────
//
// One row per unique underlying ticket asset, keyed by (operator, booking_ref).
// Exists so the duplicate-listing invariant from §2 is enforced at the DB
// layer, not just in app code:
//
//   "A given (operator, booking_reference) pair can have at most one live
//    Listing at a time, and at most one historically-completed Transaction."
//
// The unique index on (operator, booking_reference) means any attempt to
// create a second OperatorTicket for the same physical ticket fails at the
// DB. The verify-listing job catches this before status flips to live.
export const operatorTickets = pgTable(
  "operator_tickets",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    operator: operatorEnum("operator").notNull(),
    bookingReference: text("booking_reference").notNull(),

    // The earliest listing that produced this OperatorTicket row. Helps
    // forensics when we have to investigate fraud (who first uploaded?).
    firstSeenListingId: uuid("first_seen_listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "restrict" }),

    // Set when a buyer completes purchase. Locks the ticket from being
    // re-listed even after the transaction ends.
    soldInTransactionId: uuid("sold_in_transaction_id"),

    status: operatorTicketStatusEnum("status").notNull().default("live"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // The core anti-dup invariant. Anything else is belt-and-braces.
    uniqueIndex("operator_tickets_op_booking_idx").on(
      table.operator,
      table.bookingReference
    ),
  ]
);

export type OperatorTicketRow = typeof operatorTickets.$inferSelect;
export type OperatorTicketInsert = typeof operatorTickets.$inferInsert;
