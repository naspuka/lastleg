import { sql } from "drizzle-orm";
import {
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
  guaranteeClaimReasonEnum,
  guaranteeClaimStatusEnum,
  transactionDisputeStatusEnum,
  transactionStatusEnum,
} from "./enums";
import { listings } from "./listings";
import { users } from "./users";

// ─── Transaction ─────────────────────────────────────────────────────────────
//
// Buyer ↔ seller money + delivery record. One Transaction per `paid` listing.
//
// Money columns (all in pence per D007 + conventions):
//   price_pence          — what the buyer paid for the ticket itself
//   buyer_fee_pence      — LastLeg fee component (£1 + 8%, cap £4)
//   seller_payout_pence  — usually = price_pence (sellers pay no fee)
//
// Time anchors driving Inngest jobs (§3.2):
//   escrow_release_at    = departure_at + 1h, when release-payout runs
//   ticket_revealed_at   = when adaptive-release computes the reveal time
//   ticket_released_at   = actual moment the buyer was served the signed URL
//   scan_confirmed_at    = operator scan API confirms a boarding scan
//   payout_released_at   = Stripe transfer fired
//
// Stripe linkage:
//   stripe_payment_intent — captures both authorisation + manual capture
//
// Dispute flag is kept orthogonal to status (§2.4 — a `paid` transaction
// can be `dispute_status = open` simultaneously without changing the
// payment side).
export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "restrict" }),
    buyerId: uuid("buyer_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    sellerId: uuid("seller_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),

    status: transactionStatusEnum("status")
      .notNull()
      .default("pending_payment"),
    disputeStatus: transactionDisputeStatusEnum("dispute_status")
      .notNull()
      .default("none"),

    pricePence: integer("price_pence").notNull(),
    buyerFeePence: integer("buyer_fee_pence").notNull(),
    sellerPayoutPence: integer("seller_payout_pence").notNull(),

    // The single PaymentIntent that gets authorised at purchase + captured at
    // payout. Stored as text because Stripe IDs are typed strings.
    stripePaymentIntent: text("stripe_payment_intent"),

    // Time anchors. All UTC; UI handles tz conversion.
    escrowReleaseAt: timestamp("escrow_release_at", {
      withTimezone: true,
    }).notNull(),
    ticketRevealedAt: timestamp("ticket_revealed_at", { withTimezone: true }),
    ticketReleasedAt: timestamp("ticket_released_at", { withTimezone: true }),
    scanConfirmedAt: timestamp("scan_confirmed_at", { withTimezone: true }),
    payoutReleasedAt: timestamp("payout_released_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // One completed sale per listing (the anti-double-sell invariant from
    // §2.4). The `OperatorTicket.sold_in_transaction_id` carries the same
    // guarantee a layer up; this is the belt-and-braces.
    uniqueIndex("transactions_listing_unique_idx").on(table.listingId),
    // Sanity: every money field non-negative.
    check(
      "transactions_money_nonneg",
      sql`${table.pricePence} >= 0 AND ${table.buyerFeePence} >= 0 AND ${table.sellerPayoutPence} >= 0`
    ),
    // Status board queries (admin + dashboards).
    index("transactions_status_idx").on(table.status, table.createdAt),
    index("transactions_buyer_idx").on(table.buyerId, table.createdAt),
    index("transactions_seller_idx").on(table.sellerId, table.createdAt),
    // Released-payout scheduling job query.
    index("transactions_escrow_release_idx").on(table.escrowReleaseAt),
  ]
);

export type TransactionRow = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;

// ─── GuaranteeClaim ──────────────────────────────────────────────────────────
//
// Buyer-filed dispute record per D008 + D009 + §3.5. One claim per
// transaction at most (enforced by unique index). Workflow:
//
//   created (status=pending) → process-claim job decides:
//     - guarantee_claims_used < 2 → auto_approved + payout halted
//     - guarantee_claims_used ≥ 2 → under_review (Linear webhook)
//   under_review → admin resolves → approved | rejected
//
// Evidence supports manual review and is store-then-discard at MVP:
//   evidence_blob_url: optional photo upload (driver receipt, denial)
//   evidence_text:     buyer's free-form explanation
export const guaranteeClaims = pgTable(
  "guarantee_claims",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "restrict" }),

    reason: guaranteeClaimReasonEnum("reason").notNull(),
    status: guaranteeClaimStatusEnum("status").notNull().default("pending"),

    evidenceText: text("evidence_text"),
    evidenceBlobUrl: text("evidence_blob_url"),

    // User id of the admin who closed the claim (null until resolved).
    resolvedByUserId: uuid("resolved_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),

    // Amount actually paid out from the guarantee fund. Zero for operator
    // cancellations (refund comes from the uncaptured PaymentIntent, not the
    // fund) and for `rejected` claims.
    refundAmountPence: integer("refund_amount_pence").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => [
    // One open claim per transaction at a time. We allow a second row after
    // rejection (see app-level check) but never two concurrent.
    uniqueIndex("guarantee_claims_transaction_idx").on(table.transactionId),
    index("guarantee_claims_status_idx").on(table.status, table.createdAt),
    check(
      "guarantee_claims_refund_nonneg",
      sql`${table.refundAmountPence} >= 0`
    ),
  ]
);

export type GuaranteeClaimRow = typeof guaranteeClaims.$inferSelect;
export type GuaranteeClaimInsert = typeof guaranteeClaims.$inferInsert;
