"use server";

import { eq } from "drizzle-orm";

import { getDb, schema } from "@/db/client";
import { requireSession } from "@/lib/auth/session";
import { buyerFeePence } from "@/lib/pricing";
import { requireStripe } from "@/lib/stripe/client";

// Buyer-side checkout intent creation. Per D012: PaymentIntent uses
// `capture_method = manual`. Authorisation happens at confirm; capture
// fires later from the release-payout Inngest job.
//
// Returns the client_secret so the buyer's Stripe Elements iframe can
// confirm the PaymentIntent. We DON'T create the Transaction row here —
// that happens in the Stripe webhook on payment_intent.requires_capture
// (or .succeeded if auto-captured by mistake), to keep it idempotent against
// browser-side abandonment.

type Result =
  | { ok: true; clientSecret: string; publishableKey: string; total: number }
  | { ok: false; error: string };

export async function createCheckoutIntentAction(
  listingId: string
): Promise<Result> {
  if (!process.env.STRIPE_SECRET_KEY) {
    return { ok: false, error: "Stripe isn't set up yet." };
  }
  if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
    return {
      ok: false,
      error: "Stripe publishable key missing — can't render checkout.",
    };
  }

  const user = await requireSession();
  const db = getDb();
  if (!db) return { ok: false, error: "Server unavailable." };

  const rows = await db
    .select()
    .from(schema.listings)
    .where(eq(schema.listings.id, listingId))
    .limit(1);
  const listing = rows[0];
  if (!listing) return { ok: false, error: "Listing not found." };
  if (listing.status !== "live")
    return { ok: false, error: "This listing isn't available." };
  if (listing.sellerId === user.id)
    return { ok: false, error: "You can't buy your own ticket." };

  const fee = buyerFeePence(listing.currentPricePence);
  const total = listing.currentPricePence + fee;

  const stripe = requireStripe();

  // Idempotency: a user reloading checkout shouldn't spawn N PaymentIntents.
  // Stripe's idempotency_key on the request side handles this — keyed by
  // (buyer, listing). Re-quoting at the current price each time still works
  // because Stripe will return the existing PI if the key matches and the
  // params haven't materially changed.
  const idempotencyKey = `pi_${user.id}_${listing.id}`;

  try {
    const intent = await stripe.paymentIntents.create(
      {
        amount: total,
        currency: "gbp",
        capture_method: "manual",
        automatic_payment_methods: { enabled: true },
        metadata: {
          listingId: listing.id,
          buyerId: user.id,
          sellerId: listing.sellerId,
          pricePence: String(listing.currentPricePence),
          buyerFeePence: String(fee),
          sellerPayoutPence: String(listing.currentPricePence),
        },
      },
      { idempotencyKey }
    );
    if (!intent.client_secret) {
      return { ok: false, error: "Stripe returned no client secret." };
    }
    return {
      ok: true,
      clientSecret: intent.client_secret,
      publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
      total,
    };
  } catch (err) {
    console.error("[checkout] intent create failed", err);
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "Couldn't start checkout. Try again.",
    };
  }
}
