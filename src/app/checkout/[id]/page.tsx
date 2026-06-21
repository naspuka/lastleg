import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";

import { createCheckoutIntentAction } from "@/app/_actions/checkout";
import { AppNav } from "@/components/app/app-nav";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { getDb, schema } from "@/db/client";
import { getSessionUser } from "@/lib/auth/session";
import { OPERATOR_LABEL } from "@/lib/operators";
import { buyerFeePence, formatGBP } from "@/lib/pricing";
import { formatUkDateTime } from "@/lib/time";

export const metadata = { title: "Checkout" };
export const dynamic = "force-dynamic";

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!process.env.CLERK_SECRET_KEY) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-24">
        <h1 className="font-heading text-3xl font-semibold">Checkout</h1>
        <p className="text-muted-foreground mt-4">Auth isn&rsquo;t set up.</p>
      </main>
    );
  }

  const user = await getSessionUser();
  if (!user) redirect("/sign-in");

  const { id } = await params;
  const db = getDb();
  if (!db) notFound();
  const rows = await db
    .select()
    .from(schema.listings)
    .where(eq(schema.listings.id, id))
    .limit(1);
  const listing = rows[0];
  if (!listing || listing.status !== "live") notFound();
  if (listing.sellerId === user.id) {
    redirect(`/listings/${id}`);
  }

  const intent = await createCheckoutIntentAction(id);
  const fee = buyerFeePence(listing.currentPricePence);
  const total = listing.currentPricePence + fee;

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-2xl px-6 py-10 sm:py-14">
        <p className="text-muted-foreground text-sm font-medium tracking-wider uppercase">
          Confirm purchase
        </p>
        <h1 className="font-heading mt-2 text-3xl font-semibold sm:text-4xl">
          {listing.routeOrigin} → {listing.routeDestination}
        </h1>
        <p className="text-muted-foreground mt-2">
          {OPERATOR_LABEL[listing.operator]} ·{" "}
          {formatUkDateTime(listing.departureAt)}
        </p>

        {/* Pricing card */}
        <section className="mt-8 rounded-2xl border bg-card p-6">
          <dl className="text-muted-foreground space-y-2 text-sm">
            <div className="flex justify-between">
              <dt>Ticket price</dt>
              <dd>{formatGBP(listing.currentPricePence)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Buyer fee (£1 + 8% capped at £4)</dt>
              <dd>{formatGBP(fee)}</dd>
            </div>
            <div className="text-foreground border-t pt-2 flex justify-between text-base font-semibold">
              <dt>You pay</dt>
              <dd>{formatGBP(total)}</dd>
            </div>
          </dl>
        </section>

        {/* Named-ticket disclosure */}
        {listing.hasPassengerName && (
          <section className="border-destructive/30 bg-destructive/5 mt-6 rounded-2xl border p-5">
            <h2 className="text-destructive font-semibold">Named ticket</h2>
            <p className="text-foreground mt-2 text-sm leading-relaxed">
              The printed name on this ticket is{" "}
              <strong>{listing.passengerNameFirst ?? "the seller"}.</strong>{" "}
              Drivers occasionally check ID. If you&rsquo;re denied boarding
              for any reason, the LastLeg guarantee fund refunds you in full.
              By continuing you acknowledge this.
            </p>
          </section>
        )}

        <section className="mt-8">
          {intent.ok ? (
            <CheckoutForm
              listingId={listing.id}
              clientSecret={intent.clientSecret}
              publishableKey={intent.publishableKey}
              totalLabel={formatGBP(total)}
            />
          ) : (
            <div className="border-destructive/30 bg-destructive/5 rounded-xl border p-5 text-sm">
              <p className="text-destructive font-medium">
                Checkout isn&rsquo;t available right now.
              </p>
              <p className="text-muted-foreground mt-2">{intent.error}</p>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
