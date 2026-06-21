"use server";

import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth/session";
import { createConnectOnboardingUrl } from "@/lib/stripe/connect";

// Seller clicks "Set up payouts" → this action either redirects to Stripe
// Connect onboarding OR returns a friendly error if Stripe isn't configured.

function baseUrl() {
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (prod) return `https://${prod}`;
  const preview = process.env.VERCEL_URL;
  if (preview) return `https://${preview}`;
  return "http://localhost:4000";
}

export async function startConnectOnboardingAction() {
  if (!process.env.STRIPE_SECRET_KEY) {
    return { ok: false, error: "stripe_not_configured" as const };
  }
  const user = await requireSession();
  try {
    const url = await createConnectOnboardingUrl({
      userId: user.id,
      email: user.email,
      returnUrl: `${baseUrl()}/sell?onboarding=done`,
      refreshUrl: `${baseUrl()}/sell?onboarding=refresh`,
    });
    redirect(url);
  } catch (err) {
    if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) throw err;
    console.error("[connect] onboarding failed", err);
    return { ok: false, error: "stripe_error" as const };
  }
}
