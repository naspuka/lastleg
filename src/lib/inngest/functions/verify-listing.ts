import { and, eq } from "drizzle-orm";

import { getDb, schema } from "@/db/client";
import { parseTicket } from "@/lib/pdf-parsers/registry";

import { inngest } from "../client";

// Phase 2 verify-listing job per IMPLEMENTATION_PLAN §Phase 2.
//
// Triggered when /sell/new creates a Listing in `pending_verification`.
// Stages:
//   1. Load the listing row + its seller-entered hints.
//   2. Parse the PDF via the registry. Real parsers (Distribusion etc.)
//      return an ARRAY of tickets — multi-passenger PDFs carry one entry
//      per passenger.
//   3. Find the "primary" parsed ticket whose ticket number matches the
//      seller's form-entered booking_reference. That ticket drives this
//      Listing.
//   4. Auto-split: for every OTHER parsed ticket above confidence, create a
//      sibling Listing under the same seller with the same prices but its
//      own ticket number + passenger name. Each sibling gets its own
//      operator_ticket row, dup-check, and audit trail.
//   5. DB dup check on (operator, booking_reference) per ticket. Unique
//      index is the ultimate safety net.
//   6. Status transitions + audit log for the primary + every sibling.
//
// Confidence < 0.5 on the primary → listing stays `pending_verification`
// for manual review. Siblings with confidence < 0.5 are silently skipped.

const AUTO_PUBLISH_THRESHOLD = 0.5;

type ParsedTicketSerialised = Omit<
  Awaited<ReturnType<typeof parseTicket>>[number],
  "departureAt"
> & {
  departureAt: string | null;
};

export const verifyListing = inngest.createFunction(
  {
    id: "verify-listing",
    triggers: [{ event: "listing/verify-requested" }],
    // Concurrency: one verification per listing in flight. Stops retry
    // storms from double-inserting operator_tickets / sibling listings.
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

    if (listing.status !== "pending_verification") {
      return {
        skipped: true,
        reason: `listing already in status=${listing.status}`,
      };
    }

    const departureAtMs = new Date(listing.departureAt).getTime();

    const parsed = await step.run("parse-pdf", async () => {
      const result = await parseTicket({
        blobUrl: listing.ticketPdfBlobUrl ?? undefined,
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
      return result.map((t) => ({
        ...t,
        departureAt: t.departureAt ? t.departureAt.toISOString() : null,
      })) as ParsedTicketSerialised[];
    });

    // Locate the "primary" ticket: the one whose extracted ticket #
    // matches what the seller typed in the form. If the parser didn't find
    // any match, fall back to the highest-confidence parsed ticket.
    const sellerBookingRef = listing.bookingReference?.toUpperCase();
    const primary =
      parsed.find(
        (t) => t.bookingReference?.toUpperCase() === sellerBookingRef
      ) ?? parsed.toSorted((a, b) => b.confidence - a.confidence)[0];

    if (!primary || primary.confidence < AUTO_PUBLISH_THRESHOLD) {
      await step.run("audit-low-confidence", async () => {
        const db = getDb();
        if (!db) return;
        await db.insert(schema.auditLog).values({
          actorUserId: null,
          action: "listing.parse_low_confidence",
          entityType: "listing",
          entityId: listing.id,
          payload: {
            confidence: primary?.confidence ?? 0,
            warnings: primary?.warnings ?? [],
            ticketsFound: parsed.length,
          },
        });
      });
      return {
        status: "manual_review_queued",
        confidence: primary?.confidence ?? 0,
        ticketsFound: parsed.length,
      };
    }

    if (!primary.bookingReference) {
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

    // Publish the primary first — this is the listing the seller submitted.
    const primaryResult = await step.run("publish-primary", async () => {
      const db = getDb();
      if (!db) throw new Error("DB not configured");

      const existing = await db
        .select({ id: schema.operatorTickets.id })
        .from(schema.operatorTickets)
        .where(
          and(
            eq(schema.operatorTickets.operator, primary.operator),
            eq(
              schema.operatorTickets.bookingReference,
              primary.bookingReference!
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
            operator: primary.operator,
            bookingReference: primary.bookingReference,
            collisionOperatorTicketId: existing[0]!.id,
          },
        });

        return { status: "duplicate_rejected" as const };
      }

      const operatorTicketRows = await db
        .insert(schema.operatorTickets)
        .values({
          operator: primary.operator,
          bookingReference: primary.bookingReference!,
          firstSeenListingId: listing.id,
          status: "live",
        })
        .returning({ id: schema.operatorTickets.id });
      const operatorTicketId = operatorTicketRows[0]?.id;

      // The PDF is authoritative on operator-side data. Trust parsed route
      // and departure over seller-entered fields. Original price comes from
      // the parsed value too — closes the "I paid £100 actually" gap a bit
      // (real receipt-email cross-check still ships in P2-14/15).
      const parsedDeparture = primary.departureAt
        ? new Date(primary.departureAt)
        : new Date(departureAtMs);

      await db
        .update(schema.listings)
        .set({
          status: "live",
          verificationStatus: "pdf_parsed",
          operator: primary.operator,
          routeOrigin: primary.routeOrigin ?? listing.routeOrigin,
          routeDestination:
            primary.routeDestination ?? listing.routeDestination,
          departureAt: parsedDeparture,
          originalPricePence:
            primary.originalPricePence ?? listing.originalPricePence,
          currentPricePence: listing.listPricePence,
          hasPassengerName:
            primary.hasPassengerName ?? listing.hasPassengerName,
          passengerNameFirst:
            primary.passengerNameFirst ?? listing.passengerNameFirst,
          expiresAt: parsedDeparture,
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
          confidence: primary.confidence,
          parsed: primary,
        },
      });

      return { status: "live" as const, operatorTicketId };
    });

    // Auto-split: every other parsed ticket (siblings) becomes its own
    // Listing under the same seller. Each runs through the same dup-check
    // before being inserted. Failures are non-fatal to the primary — they
    // just don't create a sibling.
    const siblings = parsed.filter(
      (t) =>
        t.bookingReference &&
        t.bookingReference.toUpperCase() !==
          primary.bookingReference!.toUpperCase() &&
        t.confidence >= AUTO_PUBLISH_THRESHOLD
    );

    const siblingResults: Array<{
      bookingReference: string;
      status: "live" | "duplicate_skipped" | "error";
      listingId?: string;
      error?: string;
    }> = [];

    for (const sibling of siblings) {
      const sibResult = await step.run(
        `publish-sibling-${sibling.bookingReference}`,
        async () => {
          const db = getDb();
          if (!db) throw new Error("DB not configured");

          // Same operator-ticket dup-check as primary.
          const existing = await db
            .select({ id: schema.operatorTickets.id })
            .from(schema.operatorTickets)
            .where(
              and(
                eq(schema.operatorTickets.operator, sibling.operator),
                eq(
                  schema.operatorTickets.bookingReference,
                  sibling.bookingReference!
                )
              )
            )
            .limit(1);

          if (existing.length > 0) {
            await db.insert(schema.auditLog).values({
              actorUserId: null,
              action: "listing.sibling_duplicate_skipped",
              entityType: "listing",
              entityId: listing.id, // attach to the primary for the timeline
              payload: {
                operator: sibling.operator,
                bookingReference: sibling.bookingReference,
              },
            });
            return {
              bookingReference: sibling.bookingReference!,
              status: "duplicate_skipped" as const,
            };
          }

          const parsedDeparture = sibling.departureAt
            ? new Date(sibling.departureAt)
            : new Date(departureAtMs);

          // Mint a sibling Listing — same seller, same prices, parsed
          // route + passenger from the PDF.
          const siblingListingRows = await db
            .insert(schema.listings)
            .values({
              sellerId: listing.sellerId,
              operator: sibling.operator,
              routeOrigin: sibling.routeOrigin ?? listing.routeOrigin,
              routeDestination:
                sibling.routeDestination ?? listing.routeDestination,
              departureAt: parsedDeparture,
              originalPricePence:
                sibling.originalPricePence ?? listing.originalPricePence,
              listPricePence: listing.listPricePence,
              floorPricePence: listing.floorPricePence,
              currentPricePence: listing.listPricePence,
              bookingReference: sibling.bookingReference!,
              hasPassengerName: sibling.hasPassengerName ?? false,
              passengerNameFirst: sibling.passengerNameFirst ?? null,
              ticketPdfBlobUrl: listing.ticketPdfBlobUrl,
              status: "live",
              verificationStatus: "pdf_parsed",
              expiresAt: parsedDeparture,
            })
            .returning({ id: schema.listings.id });

          const sibListingId = siblingListingRows[0]!.id;

          const opTicketRows = await db
            .insert(schema.operatorTickets)
            .values({
              operator: sibling.operator,
              bookingReference: sibling.bookingReference!,
              firstSeenListingId: sibListingId,
              status: "live",
            })
            .returning({ id: schema.operatorTickets.id });

          await db.insert(schema.auditLog).values({
            actorUserId: null,
            action: "listing.published_sibling",
            entityType: "listing",
            entityId: sibListingId,
            payload: {
              parentListingId: listing.id,
              operatorTicketId: opTicketRows[0]?.id,
              confidence: sibling.confidence,
              parsed: sibling,
            },
          });

          return {
            bookingReference: sibling.bookingReference!,
            status: "live" as const,
            listingId: sibListingId,
          };
        }
      );
      siblingResults.push(sibResult);
    }

    // Fire listing/published for every newly-live listing so match-alerts
    // can fan out notifications. We send these as a batch after all DB
    // mutations so we never publish before the row is committed.
    const publishedIds: string[] = [];
    if (primaryResult.status === "live") publishedIds.push(listing.id);
    for (const r of siblingResults) {
      if (r.status === "live" && r.listingId) publishedIds.push(r.listingId);
    }
    if (publishedIds.length > 0) {
      await step.run("emit-published-events", async () => {
        await inngest.send(
          publishedIds.map((id) => ({
            name: "listing/published",
            data: { listingId: id },
          }))
        );
      });
    }

    return {
      ...primaryResult,
      siblings: siblingResults,
      ticketsFound: parsed.length,
    };
  }
);
