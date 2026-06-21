import { eq } from "drizzle-orm";

import { getDb, schema } from "@/db/client";

import { requireStripe } from "./client";

// Stripe Connect Express helpers. Sellers don't go through onboarding at
// signup (D013) — only when they hit "set up payouts" from the seller
// dashboard, or implicitly before their first payout fires.

/**
 * Create or fetch a Stripe Connect Express account for the user, then mint a
 * single-use AccountLink onboarding URL. Caller redirects the seller there.
 */
export async function createConnectOnboardingUrl(args: {
  userId: string;
  email: string;
  returnUrl: string;
  refreshUrl: string;
}): Promise<string> {
  const stripe = requireStripe();
  const db = getDb();
  if (!db) throw new Error("DB not configured");

  // If we already have a Connect account, use it; otherwise create one.
  const userRows = await db
    .select({ stripeConnectAccountId: schema.users.stripeConnectAccountId })
    .from(schema.users)
    .where(eq(schema.users.id, args.userId))
    .limit(1);
  const existingAcct = userRows[0]?.stripeConnectAccountId;

  let accountId = existingAcct ?? null;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      country: "GB",
      email: args.email,
      capabilities: {
        transfers: { requested: true },
        card_payments: { requested: true },
      },
      // Disable Stripe-hosted dashboard for Express; we surface what they
      // need ourselves and the operator-tier UI is cleaner anyway.
      settings: {
        payouts: { schedule: { interval: "manual" } },
      },
    });
    accountId = account.id;
    await db
      .update(schema.users)
      .set({
        stripeConnectAccountId: accountId,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, args.userId));
  }

  const link = await stripe.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    return_url: args.returnUrl,
    refresh_url: args.refreshUrl,
  });
  return link.url;
}

/**
 * Refresh local state from Stripe — used after onboarding return or in the
 * account.updated webhook handler. Sets stripe_identity_verified_at when the
 * account is fully verified.
 */
export async function syncConnectAccount(args: {
  accountId: string;
}): Promise<void> {
  const stripe = requireStripe();
  const db = getDb();
  if (!db) return;

  const account = await stripe.accounts.retrieve(args.accountId);

  // Mark identity verified when both detail submission AND charges enabled
  // are true. That's the strongest signal Stripe gives without a separate
  // Identity session.
  const verified =
    account.details_submitted && account.charges_enabled && account.payouts_enabled;

  await db
    .update(schema.users)
    .set({
      stripeIdentityVerifiedAt: verified ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(schema.users.stripeConnectAccountId, args.accountId));
}
