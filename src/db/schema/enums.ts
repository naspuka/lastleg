import { pgEnum } from "drizzle-orm/pg-core";

// Centralised pgEnums so we don't risk redefining the same name from two
// tables — Postgres would error on the duplicate type. Source of truth for
// every status surface in the app data model (mirrored from
// ARCHITECTURE.md §2.4).

// Operator catalogue. Locked to the four UK coach operators per D002 + D004.
// Add via migration when we expand; never add a value without also updating
// the PDF parser registry (P2-05).
export const operatorEnum = pgEnum("operator", [
  "megabus",
  "national_express",
  "flixbus",
  "stagecoach",
]);

// User intent declared at signup. `both` is its own value rather than
// (`buyer`, `seller`) array so an index on the column stays cheap.
export const userRoleEnum = pgEnum("user_role", ["buyer", "seller", "both"]);

// --- Listing lifecycle -------------------------------------------------------

// Top-level listing status. Lifecycle:
//   draft → pending_verification → live → (sold | expired | withdrawn)
//                                ↘ rejected
export const listingStatusEnum = pgEnum("listing_status", [
  "draft",
  "pending_verification",
  "live",
  "sold",
  "expired",
  "withdrawn",
  "rejected",
]);

// Verification sub-state, orthogonal to listing_status while in
// pending_verification.
export const listingVerificationStatusEnum = pgEnum(
  "listing_verification_status",
  ["pending", "pdf_parsed", "receipt_matched", "failed"]
);

// --- Transaction lifecycle ---------------------------------------------------

// Buy-side state machine. Lifecycle:
//   pending_payment → paid → ticket_revealed → completed
//                  ↘ refunded
//                  ↘ disputed (terminal until resolved)
export const transactionStatusEnum = pgEnum("transaction_status", [
  "pending_payment",
  "paid",
  "ticket_revealed",
  "completed",
  "refunded",
  "disputed",
]);

// Orthogonal dispute flag — a transaction can be `paid` and `dispute_status =
// open` at the same time. Keeps the main status easy to read.
export const transactionDisputeStatusEnum = pgEnum(
  "transaction_dispute_status",
  ["none", "open", "resolved_buyer", "resolved_seller"]
);

// --- OperatorTicket lifecycle ------------------------------------------------

// Lifetime of a single underlying ticket asset. Distinct from listing_status
// because the same ticket can be re-listed (e.g. after withdrawal) without
// ever changing operator_ticket state.
export const operatorTicketStatusEnum = pgEnum("operator_ticket_status", [
  "live",
  "sold",
  "expired",
]);

// --- Guarantee claims --------------------------------------------------------

// Reason codes per D016 + the denied-boarding sub-flow in §3.5. Open-ended
// `other` is intentional — caught in manual review.
export const guaranteeClaimReasonEnum = pgEnum("guarantee_claim_reason", [
  "denied_boarding_name_check",
  "denied_boarding_already_scanned",
  "operator_cancellation",
  "ticket_invalid",
  "seller_misconduct",
  "other",
]);

// Claim workflow. `pending` → (`auto_approved` | `under_review`) →
// (`approved` | `rejected`).
export const guaranteeClaimStatusEnum = pgEnum("guarantee_claim_status", [
  "pending",
  "auto_approved",
  "under_review",
  "approved",
  "rejected",
]);
