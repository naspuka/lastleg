import { desc, eq, inArray } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";

import { resolveClaimAction } from "@/app/_actions/claims";
import { CLAIM_REASON_LABEL } from "@/app/_actions/claim-types";
import { AppNav } from "@/components/app/app-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getDb, schema } from "@/db/client";
import { getSessionUser } from "@/lib/auth/session";
import { formatGBP } from "@/lib/pricing";
import { formatUkDateTime } from "@/lib/time";

export const metadata = { title: "Admin · Claims" };
export const dynamic = "force-dynamic";

export default async function AdminClaimsPage() {
  if (!process.env.CLERK_SECRET_KEY) notFound();
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");
  if (!user.isAdmin) notFound();

  const db = getDb();
  if (!db) notFound();

  const rows = await db
    .select({
      claim: schema.guaranteeClaims,
      tx: schema.transactions,
      buyer: { email: schema.users.email, claimsUsed: schema.users.guaranteeClaimsUsed },
    })
    .from(schema.guaranteeClaims)
    .innerJoin(
      schema.transactions,
      eq(schema.transactions.id, schema.guaranteeClaims.transactionId)
    )
    .innerJoin(schema.users, eq(schema.users.id, schema.transactions.buyerId))
    .where(inArray(schema.guaranteeClaims.status, ["pending", "under_review"]))
    .orderBy(desc(schema.guaranteeClaims.createdAt))
    .limit(100);

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-4xl px-6 py-12">
        <p className="text-muted-foreground text-sm font-medium tracking-wider uppercase">
          Admin
        </p>
        <h1 className="font-heading mt-2 text-3xl font-semibold sm:text-4xl">
          Open claims
        </h1>

        {rows.length === 0 ? (
          <p className="text-muted-foreground mt-10">
            No claims awaiting review.
          </p>
        ) : (
          <ul className="mt-8 space-y-6">
            {rows.map((r) => (
              <li
                key={r.claim.id}
                className="rounded-2xl border bg-card p-5 sm:p-6"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-heading text-lg font-semibold">
                      {CLAIM_REASON_LABEL[r.claim.reason]}
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {r.buyer.email} · prior claims:{" "}
                      <strong>{r.buyer.claimsUsed}</strong> · filed{" "}
                      {formatUkDateTime(r.claim.createdAt)}
                    </p>
                  </div>
                  <Badge variant="secondary">{r.claim.status}</Badge>
                </div>
                <p className="text-muted-foreground mt-3 text-sm">
                  Transaction <span className="font-mono">{r.tx.id.slice(0,8)}</span>{" "}
                  · Paid {formatGBP(r.tx.pricePence + r.tx.buyerFeePence)}
                </p>
                {r.claim.evidenceText && (
                  <blockquote className="border-muted-foreground/20 mt-4 border-l-2 pl-4 text-sm italic">
                    {r.claim.evidenceText}
                  </blockquote>
                )}

                <form action={resolveClaimAction} className="mt-5 space-y-3">
                  <input type="hidden" name="claimId" value={r.claim.id} />
                  <Textarea
                    name="notes"
                    rows={2}
                    placeholder="Notes (optional, internal)"
                    maxLength={1000}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      name="decision"
                      value="approve"
                      size="sm"
                    >
                      Approve refund
                    </Button>
                    <Button
                      type="submit"
                      name="decision"
                      value="reject"
                      variant="outline"
                      size="sm"
                    >
                      Reject
                    </Button>
                  </div>
                </form>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
