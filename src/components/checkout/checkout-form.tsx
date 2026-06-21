"use client";

import { useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import type { Stripe as StripeClient } from "@stripe/stripe-js";

import { Button } from "@/components/ui/button";

type Props = {
  listingId: string;
  clientSecret: string;
  publishableKey: string;
  totalLabel: string;
};

// Module-level cache: loadStripe must run exactly once per publishable key.
const stripePromises: Record<string, Promise<StripeClient | null>> = {};
function stripePromise(pk: string) {
  if (!stripePromises[pk]) stripePromises[pk] = loadStripe(pk);
  return stripePromises[pk]!;
}

function Inner({ totalLabel, listingId }: { totalLabel: string; listingId: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setPending(true);
    setError(null);

    const result = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/checkout/${listingId}/done`,
      },
    });

    if (result.error) {
      setError(result.error.message ?? "Payment failed.");
      setPending(false);
    }
    // On success Stripe navigates the user to return_url. We never see this
    // branch.
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <PaymentElement />
      {error && (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}
      <Button
        type="submit"
        size="lg"
        disabled={!stripe || pending}
        className="bg-brand-coral text-brand-coral-foreground hover:bg-brand-coral-hover border-brand-coral h-12 w-full text-base"
      >
        {pending ? "Confirming…" : `Pay ${totalLabel}`}
      </Button>
    </form>
  );
}

export function CheckoutForm({ listingId, clientSecret, publishableKey, totalLabel }: Props) {
  return (
    <Elements
      stripe={stripePromise(publishableKey)}
      options={{ clientSecret, appearance: { theme: "stripe" } }}
    >
      <Inner totalLabel={totalLabel} listingId={listingId} />
    </Elements>
  );
}
