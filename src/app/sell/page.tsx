import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Plus } from "lucide-react";

import { AppNav } from "@/components/app/app-nav";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { getDb, schema } from "@/db/client";
import { getSessionUser } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import { formatGBP } from "@/lib/pricing";

export const metadata = {
  title: "Sell",
};

// P2-17 seller dashboard. Lists this user's listings newest-first with
// status, route, departure, current price. Empty-state nudges /sell/new.

const STATUS_LABEL: Record<typeof schema.listings.$inferSelect.status, string> =
  {
    draft: "Draft",
    pending_verification: "Verifying",
    live: "Live",
    sold: "Sold",
    expired: "Expired",
    withdrawn: "Withdrawn",
    rejected: "Rejected",
  };

const STATUS_TONE: Record<
  typeof schema.listings.$inferSelect.status,
  "default" | "secondary" | "destructive" | "outline"
> = {
  draft: "outline",
  pending_verification: "secondary",
  live: "default",
  sold: "default",
  expired: "outline",
  withdrawn: "outline",
  rejected: "destructive",
};

const OPERATOR_LABEL: Record<
  typeof schema.listings.$inferSelect.operator,
  string
> = {
  megabus: "Megabus",
  national_express: "National Express",
  flixbus: "FlixBus",
  stagecoach: "Stagecoach",
};

function formatDepartureAt(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  }).format(d);
}

export default async function SellDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string }>;
}) {
  if (!process.env.CLERK_SECRET_KEY) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-24">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Sell
        </h1>
        <p className="text-muted-foreground mt-4">
          Auth isn&rsquo;t configured on this deploy yet.
        </p>
      </main>
    );
  }

  const user = await getSessionUser();
  if (!user) redirect("/sign-in");

  const db = getDb();
  const listings = db
    ? await db
        .select()
        .from(schema.listings)
        .where(eq(schema.listings.sellerId, user.id))
        .orderBy(desc(schema.listings.createdAt))
        .limit(50)
    : [];

  const params = await searchParams;
  const justListedId = params.ok;
  const justListed = justListedId
    ? listings.find((l) => l.id === justListedId)
    : null;

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-4xl px-6 py-12 sm:py-16">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-muted-foreground text-sm font-medium tracking-wider uppercase">
              Your listings
            </p>
            <h1 className="font-heading mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Sell
            </h1>
          </div>
          <Link
            href="/sell/new"
            className={cn(
              buttonVariants({ size: "sm" }),
              "bg-brand-coral text-brand-coral-foreground hover:bg-brand-coral-hover border-brand-coral"
            )}
          >
            <Plus className="size-4" />
            New listing
          </Link>
        </div>

        {justListed && (
          <div className="border-primary/20 bg-primary/5 mt-8 rounded-xl border p-4">
            <p className="text-primary text-sm font-medium">
              Listing submitted — verifying now.
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              We&rsquo;re parsing the PDF and dup-checking the booking
              reference. It&rsquo;ll move to &ldquo;Live&rdquo; in a few
              seconds.
            </p>
          </div>
        )}

        {listings.length === 0 ? (
          <div className="border-border/60 mt-10 rounded-xl border border-dashed px-6 py-16 text-center">
            <h2 className="font-heading text-xl font-semibold tracking-tight">
              No listings yet
            </h2>
            <p className="text-muted-foreground mt-2 text-sm">
              Upload your first unused coach ticket and we&rsquo;ll list it
              within seconds.
            </p>
            <Link
              href="/sell/new"
              className={cn(
                buttonVariants({ size: "default" }),
                "bg-brand-coral text-brand-coral-foreground hover:bg-brand-coral-hover border-brand-coral mt-6"
              )}
            >
              List a ticket
              <ArrowRight className="size-4" />
            </Link>
          </div>
        ) : (
          <ul className="border-border/60 mt-10 divide-y rounded-xl border">
            {listings.map((l) => (
              <li
                key={l.id}
                className="flex items-center gap-4 px-5 py-4 sm:px-6 sm:py-5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-heading truncate font-semibold tracking-tight">
                      {l.routeOrigin}
                      <span className="text-muted-foreground mx-1.5">→</span>
                      {l.routeDestination}
                    </p>
                    <Badge variant={STATUS_TONE[l.status]} className="shrink-0">
                      {STATUS_LABEL[l.status]}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {OPERATOR_LABEL[l.operator]} ·{" "}
                    {formatDepartureAt(l.departureAt)} · booking{" "}
                    <span className="font-mono">{l.bookingReference}</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-heading text-lg font-semibold">
                    {formatGBP(l.currentPricePence)}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    was {formatGBP(l.originalPricePence)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
