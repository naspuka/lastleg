import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppNav } from "@/components/app/app-nav";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { getDb, schema } from "@/db/client";
import { getSessionUser } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import { OPERATOR_LABEL } from "@/lib/operators";
import { buyerFeePence, formatGBP } from "@/lib/pricing";
import { formatUkDateTime, humaniseUntil } from "@/lib/time";

export const metadata = { title: "Ticket" };
export const dynamic = "force-dynamic";

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!process.env.CLERK_SECRET_KEY) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-24">
        <h1 className="font-heading text-3xl font-semibold">Ticket</h1>
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
  if (!listing) notFound();

  if (
    listing.status !== "live" &&
    listing.status !== "sold" &&
    listing.sellerId !== user.id
  ) {
    notFound();
  }

  const isOwner = listing.sellerId === user.id;
  const fee = buyerFeePence(listing.currentPricePence);
  const total = listing.currentPricePence + fee;

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-3xl px-6 py-10 sm:py-14">
        <Link
          href="/browse"
          className="text-muted-foreground hover:text-foreground text-sm font-medium"
        >
          ← Back to browse
        </Link>

        <div className="mt-6 flex items-start justify-between gap-4">
          <div>
            <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              {OPERATOR_LABEL[listing.operator]}
            </div>
            <h1 className="font-heading mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              {listing.routeOrigin}
              <span className="text-muted-foreground mx-2">→</span>
              {listing.routeDestination}
            </h1>
            <p className="text-muted-foreground mt-2">
              {formatUkDateTime(listing.departureAt)} ·{" "}
              <span className="text-primary font-medium">
                {humaniseUntil(listing.departureAt)} away
              </span>
            </p>
          </div>
          <Badge
            variant={listing.status === "live" ? "default" : "secondary"}
            className="shrink-0"
          >
            {listing.status}
          </Badge>
        </div>

        {/* Pricing card */}
        <section className="mt-8 rounded-2xl border bg-card p-6 shadow-sm">
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                Current price
              </p>
              <p className="font-heading mt-1 text-4xl font-bold text-primary">
                {formatGBP(listing.currentPricePence)}
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                Originally{" "}
                <span className="line-through">
                  {formatGBP(listing.originalPricePence)}
                </span>
              </p>
            </div>
            {listing.status === "live" && !isOwner && (
              <Link
                href={`/checkout/${listing.id}`}
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "bg-brand-coral text-brand-coral-foreground hover:bg-brand-coral-hover border-brand-coral h-12 px-6"
                )}
              >
                Buy {formatGBP(total)}
              </Link>
            )}
          </div>

          <div className="text-muted-foreground mt-5 grid gap-1 border-t pt-4 text-sm">
            <div className="flex justify-between">
              <span>Ticket price</span>
              <span>{formatGBP(listing.currentPricePence)}</span>
            </div>
            <div className="flex justify-between">
              <span>Buyer fee</span>
              <span>{formatGBP(fee)}</span>
            </div>
            <div className="text-foreground mt-1 flex justify-between border-t pt-2 font-medium">
              <span>You pay</span>
              <span>{formatGBP(total)}</span>
            </div>
          </div>
        </section>

        {/* Named-ticket disclosure per D016 */}
        {listing.hasPassengerName && (
          <section className="border-destructive/30 bg-destructive/5 mt-6 rounded-2xl border p-5">
            <h2 className="text-destructive font-semibold">
              This ticket is named.
            </h2>
            <p className="text-foreground mt-2 text-sm leading-relaxed">
              The ticket is in the name of{" "}
              <strong>
                {listing.passengerNameFirst ?? "the original buyer"}.
              </strong>{" "}
              Drivers occasionally check ID on this route. If you&rsquo;re
              denied boarding for any reason, the LastLeg guarantee fund
              refunds you in full.
            </p>
          </section>
        )}

        {/* Trip details */}
        <section className="mt-8">
          <h2 className="font-heading text-lg font-semibold">Trip details</h2>
          <dl className="mt-3 divide-y rounded-xl border">
            <Row label="Operator" value={OPERATOR_LABEL[listing.operator]} />
            <Row label="From" value={listing.routeOrigin} />
            <Row label="To" value={listing.routeDestination} />
            <Row
              label="Departure"
              value={formatUkDateTime(listing.departureAt)}
            />
            {!isOwner && (
              <Row label="Ticket reveal" value="30 minutes before departure" />
            )}
            {isOwner && listing.bookingReference && (
              <Row label="Your ticket #" value={listing.bookingReference} />
            )}
          </dl>
        </section>

        <p className="text-muted-foreground mt-8 text-xs">
          Verified via PDF parse · listed{" "}
          {formatUkDateTime(listing.createdAt)}
        </p>
      </main>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
