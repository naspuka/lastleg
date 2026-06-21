import Stripe from "stripe";

// Server-side Stripe client. Env-gated like every other integration.
// Throws StripeNotConfiguredError when STRIPE_SECRET_KEY is missing so call
// sites can render a sensible "set up payments" state instead of crashing.

export class StripeNotConfiguredError extends Error {
  constructor() {
    super("STRIPE_SECRET_KEY is not set");
    this.name = "StripeNotConfiguredError";
  }
}

let cached: Stripe | null = null;

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!cached) {
    cached = new Stripe(key, {
      // Pinned API version for predictable behaviour. Bump when we test
      // against a newer one.
      apiVersion: "2025-09-30.clover",
      // Typescript-only flag; doesn't affect runtime.
      typescript: true,
      // Helps Stripe trace requests back to us.
      appInfo: { name: "LastLeg", url: "https://lastleg.app" },
    });
  }
  return cached;
}

export function requireStripe(): Stripe {
  const s = getStripe();
  if (!s) throw new StripeNotConfiguredError();
  return s;
}
