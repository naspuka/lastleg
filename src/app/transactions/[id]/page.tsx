import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";

import { AppNav } from "@/components/app/app-nav";
import { ClaimForm } from "@/components/claims/claim-form";
import { Badge } from "@/components/ui/badge";
import { getDb, schema } from "@/db/client";
import { getSessionUser } from "@/lib/auth/session";
import { CLAIM_REASON_LABEL } from "@/app/_actions/claim-types";
import { OPERATOR_LABEL } from "@/lib/operators";
import { formatGBP } from "@/lib/pricing";
import { formatUkDateTime } from "@/lib/time";

export const metadata = { title: "Trip" };
export const dynamic = "force-dynamic";

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!process.env.CLERK_SECRET_KEY) notFound();
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");

  const { id } = await params;
  const db = getDb();
  if (!db) notFound();
  const txRows = await db
    .select()
    .from(schema.transactions)
    .where(eq(schema.transactions.id, id))
    .limit(1);
  const tx = txRows[0];
  if (!tx) notFound();
  // Buyer + seller can both see this page.
  if (tx.buyerId !== user.id && tx.sellerId !== user.id) notFound();

  const listingRows = await db
    .select()
    .from(schema.listings)
    .where(eq(schema.listings.id, tx.listingId))
    .limit(1);
  const listing = listingRows[0];

  const claimRows = await db
    .select()
    .from(schema.guaranteeClaims)
    .where(eq(schema.guaranteeClaims.transactionId, tx.id))
    .limit(1);
  const claim = claimRows[0];

  const isBuyer = tx.buyerId === user.id;
  const canFileClaim =
    isBuyer && !claim && (tx.status === "ticket_revealed" || tx.status === "paid");

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-2xl px-6 py-10 sm:py-14">
        <p className="text-muted-foreground text-sm font-medium tracking-wider uppercase">
          Trip
        </p>
        {listing && (
          <h1 className="font-heading mt-2 text-3xl font-semibold sm:text-4xl">
            {listing.routeOrigin} → {listing.routeDestination}
          </h1>
        )}
        {listing && (
          <p className="text-muted-foreground mt-2">
            {OPERATOR_LABEL[listing.operator]} ·{" "}
            {formatUkDateTime(listing.departureAt)}
          </p>
        )}

        <section className="mt-6 rounded-2xl border bg-card p-5">
          <dl className="text-muted-foreground space-y-2 text-sm">
            <Row label="Status">
              <Badge variant={tx.status === "completed" ? "default" : "secondary"}>
                {tx.status}
              </Badge>
            </Row>
            <Row label="Paid">{formatGBP(tx.pricePence + tx.buyerFeePence)}</Row>
            {tx.payoutReleasedAt && (
              <Row label="Seller paid">
                {formatUkDateTime(tx.payoutReleasedAt)}
              </Row>
            )}
            {tx.ticketReleasedAt && (
              <Row label="Ticket sent">
                {formatUkDateTime(tx.ticketReleasedAt)}
              </Row>
            )}
          </dl>
        </section>

        {claim && (
          <section className="border-destructive/30 bg-destructive/5 mt-6 rounded-2xl border p-5">
            <p className="text-destructive text-sm font-semibold">
              Claim filed: {CLAIM_REASON_LABEL[claim.reason]}
            </p>
            <p className="text-muted-foreground mt-2 text-sm">
              Status: <strong>{claim.status}</strong>
              {claim.refundAmountPence > 0 && (
                <> · refund {formatGBP(claim.refundAmountPence)}</>
              )}
            </p>
          </section>
        )}

        {canFileClaim && (
          <section className="mt-10">
            <h2 className="font-heading text-lg font-semibold">
              Report a problem
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              If the trip didn&rsquo;t happen for you, file a claim. Most
              go through automatically and we refund within minutes.
            </p>
            <div className="mt-4">
              <ClaimForm transactionId={tx.id} />
            </div>
          </section>
        )}
      </main>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <dt>{label}</dt>
      <dd className="text-foreground font-medium">{children}</dd>
    </div>
  );
}
