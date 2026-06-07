import { and, eq } from "drizzle-orm";

import { getDb, schema } from "@/db/client";
import { parseTicket } from "@/lib/pdf-parsers/registry";

import { inngest } from "../client";

// Phase 2 verify-listing job per IMPLEMENTATION_PLAN §Phase 2.
//
// Triggered when /sell/new creates a Listing in `pending_verification`.
// Stages:
//   1. Load the listing row + its seller-entered hints.
//   2. Dispatch to the operator parser via the registry (P2-05). Today
//      that's always the stub; real per-operator parsers slot in once we
//      have sample PDFs (P2-04/06/07/08).
//   3. DB dup check on (operator, booking_reference) against
//      operator_tickets. The unique index catches it too — we check first
//      so we can fail with a friendly reason instead of a DB exception.
//   4. Insert OperatorTicket, flip listing → live, copy
//      current_price_pence = list_price_pence, set expires_at =
//      departure_at.
//   5. Audit log everything.
//
// Confidence < 0.5 → listing stays `pending_verification` and the seller
// sees a "we couldn't auto-verify this — manual review queued" message.
// Confidence >= 0.5 → auto-publish to `live`.
//
// Idempotency: each step.run() is keyed so re-runs (Inngest retries) don't
// double-write. The operator_tickets unique index is the ultimate safety
// net.

const AUTO_PUBLISH_THRESHOLD = 0.5;

export const verifyListing = inngest.createFunction(
  {
    id: "verify-listing",
    triggers: [{ event: "listing/verify-requested" }],
    // Concurrency: keep one verification per listing in flight. A second
    // trigger for the same listing waits, preventing dup OperatorTicket
    // inserts under retry storms.
    concurrency: {
      key: "event.data.listingId",
      limit: 1,
    },
  },
  async ({ event, step }) => {
    const listingId = event.data.listingId as string;

    const listing = await step.run("load-listing", async () => {
      const db = getDb();
      if (!db) throw new Error("DB not configured");
      const rows = await db
        .select()
        .from(schema.listings)
        .where(eq(schema.listings.id, listingId))
        .limit(1);
      const row = rows[0];
      if (!row) throw new Error(`listing ${listingId} not found`);
      return row;
    });

    // Skip if someone already moved this listing past pending_verification.
    if (listing.status !== "pending_verification") {
      return {
        skipped: true,
        reason: `listing already in status=${listing.status}`,
      };
    }

    // Inngest serializes step return values via JSON, so Date fields come
    // back as ISO strings. We work with strings on the listing's
    // departure-time and re-hydrate to a Date only when the parser API
    // requires it.
    const departureAtMs = new Date(listing.departureAt).getTime();

    const parsed = await step.run("parse-pdf", async () => {
      const result = await parseTicket({
        blobUrl: listing.ticketPdfBlobUrl ?? "",
        hints: {
          operator: listing.operator,
          bookingReference: listing.bookingReference ?? undefined,
          routeOrigin: listing.routeOrigin,
          routeDestination: listing.routeDestination,
          departureAt: new Date(departureAtMs),
          originalPricePence: listing.originalPricePence,
          hasPassengerName: listing.hasPassengerName,
          passengerNameFirst: listing.passengerNameFirst ?? undefined,
        },
      });
      return {
        ...result,
        // Pre-serialise Date so the downstream Jsonify type is stable.
        departureAt: result.departureAt
          ? result.departureAt.toISOString()
          : null,
      };
    });

    // Low confidence — leave in pending_verification for manual review.
    if (parsed.confidence < AUTO_PUBLISH_THRESHOLD) {
      await step.run("audit-low-confidence", async () => {
        const db = getDb();
        if (!db) return;
        await db.insert(schema.auditLog).values({
          actorUserId: null,
          action: "listing.parse_low_confidence",
          entityType: "listing",
          entityId: listing.id,
          payload: {
            confidence: parsed.confidence,
            warnings: parsed.warnings ?? [],
          },
        });
      });
      return { status: "manual_review_queued", confidence: parsed.confidence };
    }

    if (!parsed.bookingReference) {
      // We cannot enforce dup-detection without a booking reference. Park
      // for manual review.
      await step.run("audit-missing-booking-ref", async () => {
        const db = getDb();
        if (!db) return;
        await db.insert(schema.auditLog).values({
          actorUserId: null,
          action: "listing.missing_booking_reference",
          entityType: "listing",
          entityId: listing.id,
          payload: { parsed },
        });
      });
      return { status: "manual_review_queued", reason: "no booking ref" };
    }

    // Dup-check + insert OperatorTicket + transition listing in a single
    // logical step. The (operator, booking_ref) unique index is the
    // safety net if a race slips through.
    const result = await step.run("publish-or-reject", async () => {
      const db = getDb();
      if (!db) throw new Error("DB not configured");

      const existing = await db
        .select({ id: schema.operatorTickets.id })
        .from(schema.operatorTickets)
        .where(
          and(
            eq(schema.operatorTickets.operator, parsed.operator),
            eq(
              schema.operatorTickets.bookingReference,
              parsed.bookingReference!
            )
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(schema.listings)
          .set({
            status: "rejected",
            verificationStatus: "failed",
            updatedAt: new Date(),
          })
          .where(eq(schema.listings.id, listing.id));

        await db.insert(schema.auditLog).values({
          actorUserId: null,
          action: "listing.duplicate_rejected",
          entityType: "listing",
          entityId: listing.id,
          payload: {
            operator: parsed.operator,
            bookingReference: parsed.bookingReference,
            collisionOperatorTicketId: existing[0]!.id,
          },
        });

        return { status: "duplicate_rejected" as const };
      }

      const operatorTicketRows = await db
        .insert(schema.operatorTickets)
        .values({
          operator: parsed.operator,
          bookingReference: parsed.bookingReference!,
          firstSeenListingId: listing.id,
          status: "live",
        })
        .returning({ id: schema.operatorTickets.id });
      const operatorTicketId = operatorTicketRows[0]?.id;

      await db
        .update(schema.listings)
        .set({
          status: "live",
          verificationStatus: "pdf_parsed",
          currentPricePence: listing.listPricePence,
          expiresAt: new Date(departureAtMs),
          updatedAt: new Date(),
        })
        .where(eq(schema.listings.id, listing.id));

      await db.insert(schema.auditLog).values({
        actorUserId: null,
        action: "listing.published",
        entityType: "listing",
        entityId: listing.id,
        payload: {
          operatorTicketId,
          confidence: parsed.confidence,
          parsed,
        },
      });

      return { status: "live" as const, operatorTicketId };
    });

    return result;
  }
);
