import { count, eq, gte, sql as drizzleSql } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppNav } from "@/components/app/app-nav";
import { getDb, schema } from "@/db/client";
import { getSessionUser } from "@/lib/auth/session";

export const metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

// Phase 8 admin home with daily / weekly counts per P8-03. Read-only.

export default async function AdminHomePage() {
  if (!process.env.CLERK_SECRET_KEY) notFound();
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");
  if (!user.isAdmin) notFound();

  const db = getDb();
  if (!db) notFound();

  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    listings24,
    listingsLive,
    txCompleted24,
    txCompletedWeek,
    claimsOpen,
    waitlistTotal,
  ] = await Promise.all([
    db
      .select({ n: count() })
      .from(schema.listings)
      .where(gte(schema.listings.createdAt, dayAgo))
      .then((r) => r[0]?.n ?? 0),
    db
      .select({ n: count() })
      .from(schema.listings)
      .where(eq(schema.listings.status, "live"))
      .then((r) => r[0]?.n ?? 0),
    db
      .select({ n: count() })
      .from(schema.transactions)
      .where(
        drizzleSql`${schema.transactions.status} = 'completed' AND ${schema.transactions.createdAt} >= ${dayAgo}`
      )
      .then((r) => r[0]?.n ?? 0),
    db
      .select({ n: count() })
      .from(schema.transactions)
      .where(
        drizzleSql`${schema.transactions.status} = 'completed' AND ${schema.transactions.createdAt} >= ${weekAgo}`
      )
      .then((r) => r[0]?.n ?? 0),
    db
      .select({ n: count() })
      .from(schema.guaranteeClaims)
      .where(
        drizzleSql`${schema.guaranteeClaims.status} IN ('pending', 'under_review')`
      )
      .then((r) => r[0]?.n ?? 0),
    db
      .select({ n: count() })
      .from(schema.waitlist)
      .then((r) => r[0]?.n ?? 0),
  ]);

  const cards = [
    { label: "Listings (24h)", value: listings24 },
    { label: "Live listings", value: listingsLive },
    { label: "Transactions completed (24h)", value: txCompleted24 },
    { label: "Transactions completed (7d)", value: txCompletedWeek },
    { label: "Open claims", value: claimsOpen, href: "/admin/claims" },
    { label: "Waitlist total", value: waitlistTotal, href: "/admin/waitlist" },
  ];

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-5xl px-6 py-12">
        <p className="text-muted-foreground text-sm font-medium tracking-wider uppercase">
          Admin
        </p>
        <h1 className="font-heading mt-2 text-3xl font-semibold sm:text-4xl">
          Operations
        </h1>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <CardLink key={c.label} {...c} />
          ))}
        </div>

        <div className="mt-12 flex flex-wrap gap-3">
          <Link
            href="/admin/claims"
            className="border-primary/20 bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium"
          >
            Review claims
          </Link>
          <Link
            href="/admin/waitlist"
            className="border bg-card hover:bg-muted inline-flex h-9 items-center rounded-md px-4 text-sm font-medium"
          >
            Send waitlist invites
          </Link>
        </div>
      </main>
    </>
  );
}

function CardLink({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href?: string;
}) {
  const card = (
    <div className="rounded-2xl border bg-card p-5 transition-colors hover:bg-muted/40">
      <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
        {label}
      </p>
      <p className="font-heading mt-3 text-3xl font-bold">{value}</p>
    </div>
  );
  return href ? <Link href={href}>{card}</Link> : card;
}
