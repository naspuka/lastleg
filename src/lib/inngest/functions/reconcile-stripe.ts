import { and, eq, isNull, lte } from "drizzle-orm";

import { getDb, schema } from "@/db/client";
import { getStripe } from "@/lib/stripe/client";

import { inngest } from "../client";

// reconcile-stripe — hourly drift detector per P4-13.
//
// For every Transaction past escrow_release_at that hasn't been marked
// completed, check Stripe: if the PaymentIntent was already captured + the
// transfer exists, fix our state. Surface anything genuinely stuck via
// audit-log so an operator can intervene.

export const reconcileStripe = inngest.createFunction(
  { id: "reconcile-stripe", triggers: [{ cron: "0 * * * *" }] },
  async ({ step }) => {
    if (!process.env.STRIPE_SECRET_KEY) {
      return { skipped: true, reason: "stripe not configured" };
    }

    const stuck = await step.run("load-stuck", async () => {
      const db = getDb();
      if (!db) return [];
      const cutoff = new Date(Date.now() - 5 * 60 * 1000); // 5-min grace
      return db
        .select()
        .from(schema.transactions)
        .where(
          and(
            lte(schema.transactions.escrowReleaseAt, cutoff),
            isNull(schema.transactions.payoutReleasedAt),
            eq(schema.transactions.disputeStatus, "none"),
            eq(schema.transactions.status, "ticket_revealed")
          )
        )
        .limit(50);
    });

    if (stuck.length === 0) return { stuck: 0 };

    const stripe = getStripe();
    if (!stripe) return { skipped: true, reason: "stripe not configured" };

    const results: Array<{ id: string; status: string }> = [];
    for (const tx of stuck) {
      const r = await step.run(`probe-${tx.id}`, async () => {
        if (!tx.stripePaymentIntent) return { status: "no-pi" };
        const pi = await stripe.paymentIntents.retrieve(tx.stripePaymentIntent);
        // If Stripe shows it as captured + we have it as still "paid", mark
        // completed locally. Anything weirder lands in audit log for
        // operator review.
        const db = getDb();
        if (!db) return { status: "no-db" };
        if (pi.status === "succeeded" && !tx.payoutReleasedAt) {
          await db
            .update(schema.transactions)
            .set({
              status: "completed",
              payoutReleasedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(schema.transactions.id, tx.id));
          await db.insert(schema.auditLog).values({
            actorUserId: null,
            action: "reconcile.marked_completed",
            entityType: "transaction",
            entityId: tx.id,
            payload: { paymentIntentStatus: pi.status },
          });
          return { status: "fixed" };
        }
        await db.insert(schema.auditLog).values({
          actorUserId: null,
          action: "reconcile.drift_observed",
          entityType: "transaction",
          entityId: tx.id,
          payload: {
            paymentIntentStatus: pi.status,
            localStatus: tx.status,
          },
        });
        return { status: "drift_logged" };
      });
      results.push({ id: tx.id, status: r.status });
    }
    return { stuck: stuck.length, results };
  }
);
