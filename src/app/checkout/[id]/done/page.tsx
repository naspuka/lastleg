import Link from "next/link";

import { AppNav } from "@/components/app/app-nav";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Booked" };

// Stripe Elements redirects here on payment_intent confirmation. We don't
// re-validate against Stripe — the webhook is authoritative; this page just
// gives the buyer a friendly confirmation while the backend catches up.

export default async function CheckoutDonePage({
  searchParams,
}: {
  searchParams: Promise<{ payment_intent?: string; redirect_status?: string }>;
}) {
  const params = await searchParams;
  const ok = params.redirect_status === "succeeded";

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-xl px-6 py-20 text-center">
        {ok ? (
          <>
            <div className="bg-primary/10 text-primary mx-auto grid size-14 place-content-center rounded-full">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h1 className="font-heading mt-6 text-3xl font-semibold sm:text-4xl">
              You&rsquo;re booked.
            </h1>
            <p className="text-muted-foreground mt-3 max-w-md mx-auto leading-relaxed">
              Your payment is authorised and held in escrow. We&rsquo;ll send
              you the ticket file 30 minutes before departure (or right away
              for last-minute purchases).
            </p>
          </>
        ) : (
          <>
            <h1 className="font-heading text-3xl font-semibold sm:text-4xl">
              Payment didn&rsquo;t go through
            </h1>
            <p className="text-muted-foreground mt-3 max-w-md mx-auto">
              The card was declined or cancelled. Try again or use another
              card.
            </p>
          </>
        )}
        <Link
          href="/dashboard"
          className={cn(
            buttonVariants({ size: "lg" }),
            "mt-8 bg-brand-coral text-brand-coral-foreground hover:bg-brand-coral-hover border-brand-coral"
          )}
        >
          Go to your dashboard
        </Link>
      </main>
    </>
  );
}
