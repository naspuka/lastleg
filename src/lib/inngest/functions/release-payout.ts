import { eq } from "drizzle-orm";

import { getDb, schema } from "@/db/client";
import { requireStripe } from "@/lib/stripe/client";

import { inngest } from "../client";

// release-payout — captures the buyer's PaymentIntent and transfers the
// seller's share to their Connect account. Scheduled at departure + 1h
// when the transaction is first created (D012).
//
// Pre-checks (P4-10):
//   - dispute open  → halt; guarantee-claim flow takes over
//   - listing not in `sold` status → halt
//   - seller Stripe Identity verified → required (D015); halt if not
//   - (operator scan API check happens in Phase 5)

export const releasePayout = inngest.createFunction(
  {
    id: "release-payout",
    triggers: [{ event: "transaction/release-payout-requested" }],
    concurrency: { key: "event.data.transactionId", limit: 1 },
  },
  async ({ event, step }) => {
    const transactionId = event.data.transactionId as string;
    const releaseAt = new Date(event.data.releaseAt as string);

    if (releaseAt.getTime() > Date.now() + 1000) {
      await step.sleepUntil("wait-for-departure-plus-1h", releaseAt);
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
    if (tx.payoutReleasedAt) return { skipped: true, reason: "already paid out" };
    if (tx.disputeStatus === "open")
      return { skipped: true, reason: "dispute open — manual review" };
    if (tx.status === "refunded")
      return { skipped: true, reason: "transaction refunded" };
    if (!tx.stripePaymentIntent)
      return { skipped: true, reason: "no payment intent on transaction" };

    const seller = await step.run("load-seller", async () => {
      const db = getDb();
      if (!db) throw new Error("DB not configured");
      const rows = await db
        .select({
          id: schema.users.id,
          stripeConnectAccountId: schema.users.stripeConnectAccountId,
          stripeIdentityVerifiedAt: schema.users.stripeIdentityVerifiedAt,
        })
        .from(schema.users)
        .where(eq(schema.users.id, tx.sellerId))
        .limit(1);
      return rows[0] ?? null;
    });

    if (!seller?.stripeConnectAccountId) {
      await step.run("audit-no-connect", async () => {
        const db = getDb();
        if (!db) return;
        await db.insert(schema.auditLog).values({
          actorUserId: null,
          action: "payout.halted_no_connect",
          entityType: "transaction",
          entityId: transactionId,
          payload: {},
        });
      });
      return { skipped: true, reason: "seller has no connect account" };
    }
    if (!seller.stripeIdentityVerifiedAt) {
      await step.run("audit-no-identity", async () => {
        const db = getDb();
        if (!db) return;
        await db.insert(schema.auditLog).values({
          actorUserId: null,
          action: "payout.halted_no_identity",
          entityType: "transaction",
          entityId: transactionId,
          payload: {},
        });
      });
      return { skipped: true, reason: "seller identity not verified" };
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return { skipped: true, reason: "stripe not configured" };
    }

    // Capture the buyer's PaymentIntent — buyer's card is charged now.
    const captureResult = await step.run("capture-payment", async () => {
      const stripe = requireStripe();
      try {
        const pi = await stripe.paymentIntents.capture(tx.stripePaymentIntent!);
        return { ok: true, status: pi.status };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    });

    if (!captureResult.ok) {
      await step.run("audit-capture-failed", async () => {
        const db = getDb();
        if (!db) return;
        await db.insert(schema.auditLog).values({
          actorUserId: null,
          action: "payout.capture_failed",
          entityType: "transaction",
          entityId: transactionId,
          payload: { error: captureResult.error },
        });
      });
      throw new Error(`capture failed: ${captureResult.error}`);
    }

    // Transfer seller's share to their Connect account.
    const transferResult = await step.run("transfer-to-seller", async () => {
      const stripe = requireStripe();
      try {
        const transfer = await stripe.transfers.create(
          {
            amount: tx.sellerPayoutPence,
            currency: "gbp",
            destination: seller.stripeConnectAccountId!,
            metadata: { transactionId },
          },
          { idempotencyKey: `transfer_${transactionId}` }
        );
        return { ok: true, transferId: transfer.id };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    });

    if (!transferResult.ok) {
      // Buyer's card is captured but transfer failed. Surface to ops via
      // audit log; manual reconcile in Phase 5+ will catch it.
      await step.run("audit-transfer-failed", async () => {
        const db = getDb();
        if (!db) return;
        await db.insert(schema.auditLog).values({
          actorUserId: null,
          action: "payout.transfer_failed",
          entityType: "transaction",
          entityId: transactionId,
          payload: { error: transferResult.error },
        });
      });
      throw new Error(`transfer failed: ${transferResult.error}`);
    }

    const now = new Date();
    await step.run("mark-paid-out", async () => {
      const db = getDb();
      if (!db) return;
      await db
        .update(schema.transactions)
        .set({
          status: "completed",
          payoutReleasedAt: now,
          updatedAt: now,
        })
        .where(eq(schema.transactions.id, transactionId));
      await db.insert(schema.auditLog).values({
        actorUserId: null,
        action: "transaction.payout_released",
        entityType: "transaction",
        entityId: transactionId,
        payload: { transferId: transferResult.transferId },
      });
    });

    return { status: "paid_out", transferId: transferResult.transferId };
  }
);
