import { eq } from "drizzle-orm";

import { getDb, schema } from "@/db/client";
import { sendTicketReleasedEmail } from "@/lib/email/ticket-released";
import { sendSms } from "@/lib/sms/twilio";

import { inngest } from "../client";

// Adaptive ticket release per D014.
//
// Triggered when /api/stripe/webhook successfully creates a Transaction.
// The webhook also pre-computes the release time (`releaseAt`) using the
// adaptive rule:
//   - early sale  (departure - now > 1h): releaseAt = departure - 30min
//   - late sale   (departure - now ≤ 1h): releaseAt = immediately
//
// We use step.sleepUntil so Inngest persists the wait correctly across
// retries / deploys; then load fresh state and pre-check for disputes
// before generating the signed URL.

const SIGNED_URL_TTL_MS = 24 * 60 * 60 * 1000;

function baseUrl() {
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (prod) return `https://${prod}`;
  return "http://localhost:4000";
}

export const releaseTicket = inngest.createFunction(
  {
    id: "release-ticket",
    triggers: [{ event: "transaction/release-ticket-requested" }],
    concurrency: { key: "event.data.transactionId", limit: 1 },
  },
  async ({ event, step }) => {
    const transactionId = event.data.transactionId as string;
    const releaseAt = new Date(event.data.releaseAt as string);

    if (releaseAt.getTime() > Date.now() + 1000) {
      await step.sleepUntil("wait-for-release", releaseAt);
    }

    const tx = await step.run("load-tx", async () => {
      const db = getDb();
      if (!db) throw new Error("DB not configured");
      const rows = await db
        .select()
        .from(schema.transactions)
        .where(eq(schema.transactions.id, transactionId))
        .limit(1);
      return rows[0] ?? null;
    });
    if (!tx) return { skipped: true, reason: "transaction not found" };

    if (tx.disputeStatus === "open") {
      return { skipped: true, reason: "dispute open" };
    }
    if (tx.status === "refunded") {
      return { skipped: true, reason: "transaction refunded" };
    }
    if (tx.ticketReleasedAt) {
      return { skipped: true, reason: "already released" };
    }

    const listing = await step.run("load-listing", async () => {
      const db = getDb();
      if (!db) throw new Error("DB not configured");
      const rows = await db
        .select()
        .from(schema.listings)
        .where(eq(schema.listings.id, tx.listingId))
        .limit(1);
      return rows[0] ?? null;
    });
    if (!listing) return { skipped: true, reason: "listing not found" };

    if (!listing.ticketPdfBlobUrl) {
      return { skipped: true, reason: "no blob url on listing" };
    }

    // Signed URL: at MVP scale the blob URL is itself the unguessable
    // identifier (Vercel Blob "public" URLs are random-suffixed). For Phase 7
    // we'll replace this with a short-TTL signed URL via Blob's signed-URL
    // API + a redirect endpoint that re-checks auth.
    const signedUrl = listing.ticketPdfBlobUrl;

    const buyer = await step.run("load-buyer", async () => {
      const db = getDb();
      if (!db) throw new Error("DB not configured");
      const rows = await db
        .select({
          id: schema.users.id,
          email: schema.users.email,
          phone: schema.users.phone,
        })
        .from(schema.users)
        .where(eq(schema.users.id, tx.buyerId))
        .limit(1);
      return rows[0] ?? null;
    });

    const url = `${baseUrl()}/dashboard`;

    if (buyer?.email) {
      try {
        await sendTicketReleasedEmail({
          email: buyer.email,
          signedUrl,
          listing: {
            operator: listing.operator,
            routeOrigin: listing.routeOrigin,
            routeDestination: listing.routeDestination,
            departureAt: new Date(listing.departureAt),
          },
        });
      } catch (err) {
        console.error("[release-ticket] email failed", err);
      }
    }

    if (buyer?.phone) {
      await sendSms({
        to: buyer.phone,
        body: `LastLeg ticket: ${listing.routeOrigin}→${listing.routeDestination} ${signedUrl} (24h)`,
      });
    }

    const now = new Date();
    await step.run("mark-released", async () => {
      const db = getDb();
      if (!db) return;
      await db
        .update(schema.transactions)
        .set({
          status: "ticket_revealed",
          ticketReleasedAt: now,
          ticketRevealedAt: now,
          updatedAt: now,
        })
        .where(eq(schema.transactions.id, transactionId));
      await db.insert(schema.auditLog).values({
        actorUserId: null,
        action: "transaction.ticket_released",
        entityType: "transaction",
        entityId: transactionId,
        payload: {
          releasedAt: now.toISOString(),
          ttlMs: SIGNED_URL_TTL_MS,
        },
      });
    });

    return { status: "released" };
  }
);
