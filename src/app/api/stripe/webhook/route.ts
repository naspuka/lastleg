import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { getDb, schema } from "@/db/client";
import { inngest } from "@/lib/inngest/client";
import { getStripe } from "@/lib/stripe/client";
import { syncConnectAccount } from "@/lib/stripe/connect";

// Stripe webhook handler.
// - Signature verification is mandatory (rejects requests without a valid
//   stripe-signature header).
// - Idempotent: each event_id is recorded in audit_log; if we've seen it
//   before we 200 and skip the body. Stripe is at-least-once.
// - Handles:
//     payment_intent.requires_capture   (manual capture authorized: create
//                                        Transaction, mark Listing sold,
//                                        schedule release jobs)
//     payment_intent.succeeded          (fallback if PI auto-captured —
//                                        treat same as requires_capture)
//     payment_intent.payment_failed     (cleanup if half-created)
//     transfer.created / transfer.failed (payout traceability)
//     account.updated                   (Connect seller state sync)

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return NextResponse.json(
      { ok: false, error: "stripe webhook not configured" },
      { status: 503 }
    );
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json(
      { ok: false, error: "missing signature" },
      { status: 400 }
    );
  }

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    console.error("[stripe-webhook] signature verification failed", err);
    return NextResponse.json(
      { ok: false, error: "invalid signature" },
      { status: 401 }
    );
  }

  const db = getDb();
  if (!db) {
    return NextResponse.json({ ok: true, skipped: "no-db" });
  }

  // Idempotency check via audit_log.
  const seen = await db
    .select({ id: schema.auditLog.id })
    .from(schema.auditLog)
    .where(eq(schema.auditLog.entityId, event.id))
    .limit(1);
  if (seen.length > 0) {
    return NextResponse.json({ ok: true, deduplicated: true });
  }

  try {
    switch (event.type) {
      case "payment_intent.requires_capture":
      case "payment_intent.succeeded": {
        await handlePaymentAuthorized(event.data.object as Stripe.PaymentIntent);
        break;
      }
      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        await db.insert(schema.auditLog).values({
          actorUserId: null,
          action: "stripe.payment_failed",
          entityType: "stripe_event",
          entityId: event.id,
          payload: {
            paymentIntentId: pi.id,
            lastError: pi.last_payment_error?.message ?? null,
          },
        });
        break;
      }
      case "account.updated": {
        const acct = event.data.object as Stripe.Account;
        await syncConnectAccount({ accountId: acct.id });
        await db.insert(schema.auditLog).values({
          actorUserId: null,
          action: "stripe.account_updated",
          entityType: "stripe_event",
          entityId: event.id,
          payload: {
            accountId: acct.id,
            chargesEnabled: acct.charges_enabled,
            payoutsEnabled: acct.payouts_enabled,
            detailsSubmitted: acct.details_submitted,
          },
        });
        break;
      }
      case "transfer.created":
      case "transfer.failed": {
        const transfer = event.data.object as Stripe.Transfer;
        await db.insert(schema.auditLog).values({
          actorUserId: null,
          action: `stripe.${event.type.replace(".", "_")}`,
          entityType: "stripe_event",
          entityId: event.id,
          payload: {
            transferId: transfer.id,
            amount: transfer.amount,
            destination: transfer.destination,
            metadata: transfer.metadata,
          },
        });
        break;
      }
      default:
        // Unhandled — but record it so the audit shows we received it.
        await db.insert(schema.auditLog).values({
          actorUserId: null,
          action: `stripe.${event.type}`,
          entityType: "stripe_event",
          entityId: event.id,
          payload: { received: true },
        });
        break;
    }
  } catch (err) {
    console.error("[stripe-webhook] handler failed", event.type, err);
    // 500 → Stripe will retry. That's what we want.
    return NextResponse.json(
      { ok: false, error: "handler failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

async function handlePaymentAuthorized(pi: Stripe.PaymentIntent) {
  const db = getDb();
  if (!db) return;

  const listingId = pi.metadata.listingId;
  const buyerId = pi.metadata.buyerId;
  const sellerId = pi.metadata.sellerId;
  const pricePence = pi.metadata.pricePence
    ? parseInt(pi.metadata.pricePence, 10)
    : null;
  const buyerFeePence = pi.metadata.buyerFeePence
    ? parseInt(pi.metadata.buyerFeePence, 10)
    : null;
  const sellerPayoutPence = pi.metadata.sellerPayoutPence
    ? parseInt(pi.metadata.sellerPayoutPence, 10)
    : null;

  if (!listingId || !buyerId || !sellerId || pricePence == null) {
    await db.insert(schema.auditLog).values({
      actorUserId: null,
      action: "stripe.payment_metadata_missing",
      entityType: "stripe_event",
      entityId: pi.id,
      payload: { metadata: pi.metadata },
    });
    return;
  }

  // Load listing for departure_at scheduling.
  const listingRows = await db
    .select()
    .from(schema.listings)
    .where(eq(schema.listings.id, listingId))
    .limit(1);
  const listing = listingRows[0];
  if (!listing) return;

  if (listing.status === "sold") {
    // Already processed. Idempotency safety net beyond the audit-log dedup
    // above (handles the case where two webhook deliveries arrive close
    // enough to race the dedup query).
    return;
  }

  const departureMs = new Date(listing.departureAt).getTime();
  const escrowReleaseAt = new Date(departureMs + 60 * 60 * 1000); // departure + 1h

  // Insert Transaction. Listing → sold. Set operator_ticket.sold_in_transaction_id.
  const txRows = await db
    .insert(schema.transactions)
    .values({
      listingId,
      buyerId,
      sellerId,
      status: "paid",
      pricePence,
      buyerFeePence: buyerFeePence ?? 0,
      sellerPayoutPence: sellerPayoutPence ?? pricePence,
      stripePaymentIntent: pi.id,
      escrowReleaseAt,
    })
    .returning({ id: schema.transactions.id });
  const transactionId = txRows[0]!.id;

  await db
    .update(schema.listings)
    .set({ status: "sold", updatedAt: new Date() })
    .where(eq(schema.listings.id, listingId));

  // Find the corresponding operator_ticket (created by verify-listing) and
  // mark it sold + link to the transaction.
  if (listing.bookingReference) {
    await db
      .update(schema.operatorTickets)
      .set({ status: "sold", soldInTransactionId: transactionId })
      .where(eq(schema.operatorTickets.bookingReference, listing.bookingReference));
  }

  await db.insert(schema.auditLog).values({
    actorUserId: null,
    action: "transaction.created",
    entityType: "transaction",
    entityId: transactionId,
    payload: { paymentIntentId: pi.id, listingId, escrowReleaseAt },
  });

  // Schedule the release jobs per D014 adaptive timing.
  const now = Date.now();
  const earlySale = departureMs - now > 60 * 60 * 1000;
  const ticketReleaseAt = earlySale
    ? new Date(departureMs - 30 * 60 * 1000) // T-30min
    : new Date(now + 1000); // immediate (1s buffer)

  await inngest.send([
    {
      name: "transaction/release-ticket-requested",
      data: { transactionId, releaseAt: ticketReleaseAt.toISOString() },
    },
    {
      name: "transaction/release-payout-requested",
      data: { transactionId, releaseAt: escrowReleaseAt.toISOString() },
    },
  ]);
}
