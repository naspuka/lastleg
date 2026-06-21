import { eq, sql } from "drizzle-orm";

import { getDb, schema } from "@/db/client";
import { sendPayoutHaltedEmail } from "@/lib/email/payout-halted";
import { requireStripe } from "@/lib/stripe/client";

import { inngest } from "../client";

// process-claim per D009 + §3.5 + P6-04.
//
// On `guarantee/claim-filed`:
//   - Load the buyer's guarantee_claims_used counter.
//   - If < 2 → auto-approve path:
//       * Cancel the PaymentIntent if not yet captured (refunds the buyer
//         from the buyer's authorisation hold — no money has moved yet).
//       * If already captured → issue a refund.
//       * Update guarantee_claim.status = auto_approved + refund_amount.
//       * Increment buyer's guarantee_claims_used.
//       * Transaction → refunded.
//       * Email seller: payout halted.
//   - If ≥ 2 → manual-review path:
//       * Leave claim.status = pending; admin resolves via /admin/claims.
//       * Email seller anyway so they know payout is on hold.

function baseUrl() {
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (prod) return `https://${prod}`;
  return "http://localhost:4000";
}

export const processClaim = inngest.createFunction(
  {
    id: "process-claim",
    triggers: [{ event: "guarantee/claim-filed" }],
    concurrency: { key: "event.data.claimId", limit: 1 },
  },
  async ({ event, step }) => {
    const claimId = event.data.claimId as string;
    const transactionId = event.data.transactionId as string;

    const ctx = await step.run("load-context", async () => {
      const db = getDb();
      if (!db) throw new Error("DB not configured");
      const claim = (
        await db
          .select()
          .from(schema.guaranteeClaims)
          .where(eq(schema.guaranteeClaims.id, claimId))
          .limit(1)
      )[0];
      const tx = (
        await db
          .select()
          .from(schema.transactions)
          .where(eq(schema.transactions.id, transactionId))
          .limit(1)
      )[0];
      if (!claim || !tx) throw new Error("claim or tx missing");
      const buyer = (
        await db
          .select({
            id: schema.users.id,
            guaranteeClaimsUsed: schema.users.guaranteeClaimsUsed,
            email: schema.users.email,
          })
          .from(schema.users)
          .where(eq(schema.users.id, tx.buyerId))
          .limit(1)
      )[0];
      const seller = (
        await db
          .select({ id: schema.users.id, email: schema.users.email })
          .from(schema.users)
          .where(eq(schema.users.id, tx.sellerId))
          .limit(1)
      )[0];
      return { claim, tx, buyer, seller };
    });

    if (!ctx.buyer || !ctx.seller) {
      return { skipped: true, reason: "user lookup failed" };
    }

    // Always notify seller their payout is on hold.
    await step.run("notify-seller", async () => {
      if (!ctx.seller?.email) return;
      try {
        await sendPayoutHaltedEmail({
          email: ctx.seller.email,
          reason: ctx.claim.reason,
          reviewUrl: `${baseUrl()}/transactions/${transactionId}`,
        });
      } catch (err) {
        console.error("[process-claim] seller email failed", err);
      }
    });

    const autoApprove = ctx.buyer.guaranteeClaimsUsed < 2;
    if (!autoApprove) {
      // Manual review path. Claim stays `pending`.
      return { status: "manual_review_queued" };
    }

    // Auto-approve path: cancel/refund the PaymentIntent.
    const refundResult = await step.run("cancel-or-refund-pi", async () => {
      if (!ctx.tx.stripePaymentIntent) return { ok: true, mode: "no-pi" };
      if (!process.env.STRIPE_SECRET_KEY) return { ok: true, mode: "no-stripe" };
      try {
        const stripe = requireStripe();
        const pi = await stripe.paymentIntents.retrieve(
          ctx.tx.stripePaymentIntent
        );
        if (
          pi.status === "requires_capture" ||
          pi.status === "requires_payment_method" ||
          pi.status === "requires_confirmation" ||
          pi.status === "requires_action"
        ) {
          await stripe.paymentIntents.cancel(ctx.tx.stripePaymentIntent);
          return { ok: true, mode: "cancelled" };
        }
        if (pi.status === "succeeded") {
          await stripe.refunds.create({
            payment_intent: ctx.tx.stripePaymentIntent,
            reason: "requested_by_customer",
          });
          return { ok: true, mode: "refunded" };
        }
        return { ok: true, mode: `pi-state-${pi.status}` };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
          mode: "error",
        };
      }
    });

    await step.run("approve-claim", async () => {
      const db = getDb();
      if (!db) return;
      const refund = ctx.tx.pricePence + ctx.tx.buyerFeePence;
      await db
        .update(schema.guaranteeClaims)
        .set({
          status: "auto_approved",
          refundAmountPence: refund,
          resolvedAt: new Date(),
        })
        .where(eq(schema.guaranteeClaims.id, claimId));
      await db
        .update(schema.users)
        .set({
          guaranteeClaimsUsed: sql`${schema.users.guaranteeClaimsUsed} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(schema.users.id, ctx.buyer.id));
      await db
        .update(schema.transactions)
        .set({
          status: "refunded",
          disputeStatus: "resolved_buyer",
          updatedAt: new Date(),
        })
        .where(eq(schema.transactions.id, transactionId));
      await db.insert(schema.auditLog).values({
        actorUserId: null,
        action: "guarantee_claim.auto_approved",
        entityType: "guarantee_claim",
        entityId: claimId,
        payload: { refundMode: refundResult.mode, refundAmountPence: refund },
      });
    });

    return { status: "auto_approved", mode: refundResult.mode };
  }
);
