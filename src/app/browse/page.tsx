import { and, asc, eq, gte, lte } from "drizzle-orm";
import { redirect } from "next/navigation";

import { AppNav } from "@/components/app/app-nav";
import { ListingCard } from "@/components/browse/listing-card";
import { getDb, schema } from "@/db/client";
import { getSessionUser } from "@/lib/auth/session";
import { OPERATOR_VALUES } from "@/lib/operators";

export const metadata = { title: "Browse" };
export const revalidate = 30;

type Search = {
  operator?: string;
  q?: string;
  before?: string;
};

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  if (!process.env.CLERK_SECRET_KEY) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-24">
        <h1 className="font-heading text-3xl font-semibold">Browse</h1>
        <p className="text-muted-foreground mt-4">Auth isn&rsquo;t set up.</p>
      </main>
    );
  }

  const user = await getSessionUser();
  if (!user) redirect("/sign-in");

  const params = await searchParams;
  const operator = OPERATOR_VALUES.includes(
    params.operator as (typeof OPERATOR_VALUES)[number]
  )
    ? (params.operator as (typeof OPERATOR_VALUES)[number])
    : null;
  const query = (params.q ?? "").trim().toUpperCase();
  const before = params.before ? new Date(params.before) : null;

  const db = getDb();
  const conditions = [eq(schema.listings.status, "live")];
  conditions.push(gte(schema.listings.departureAt, new Date()));
  if (operator) conditions.push(eq(schema.listings.operator, operator));
  if (before) conditions.push(lte(schema.listings.departureAt, before));

  const listings = db
    ? await db
        .select()
        .from(schema.listings)
        .where(and(...conditions))
        .orderBy(asc(schema.listings.departureAt))
        .limit(100)
    : [];

  const filtered = query
    ? listings.filter(
        (l) =>
          l.routeOrigin.includes(query) || l.routeDestination.includes(query)
      )
    : listings;

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-5xl px-6 py-12 sm:py-16">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <p className="text-muted-foreground text-sm font-medium tracking-wider uppercase">
              Live tickets
            </p>
            <h1 className="font-heading mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Browse
            </h1>
          </div>
          <p className="text-muted-foreground text-sm">
            {filtered.length} {filtered.length === 1 ? "ticket" : "tickets"}
          </p>
        </div>

        <form
          method="get"
          className="mt-8 grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-3"
        >
          <input
            type="search"
            name="q"
            placeholder="Search station (e.g. MANCHESTER)"
            defaultValue={params.q ?? ""}
            className="border-input bg-background focus-visible:ring-ring/50 h-9 rounded-md border px-3 text-sm outline-none focus-visible:ring-3"
          />
          <select
            name="operator"
            defaultValue={params.operator ?? ""}
            className="border-input bg-background focus-visible:ring-ring/50 h-9 rounded-md border px-3 text-sm outline-none focus-visible:ring-3"
          >
            <option value="">Any operator</option>
            {OPERATOR_VALUES.map((op) => (
              <option key={op} value={op}>
                {op}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="border-primary/20 bg-primary text-primary-foreground hover:bg-primary/90 h-9 rounded-md border text-sm font-medium transition-colors"
          >
            Filter
          </button>
        </form>

        {filtered.length === 0 ? (
          <div className="mt-10 rounded-xl border border-dashed px-6 py-16 text-center">
            <h2 className="font-heading text-xl font-semibold">
              No tickets right now
            </h2>
            <p className="text-muted-foreground mt-2 text-sm">
              Save a route alert and we&rsquo;ll email you the moment a ticket
              opens up.
            </p>
            <a
              href="/alerts"
              className="border-primary/20 bg-primary text-primary-foreground hover:bg-primary/90 mt-6 inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium"
            >
              Save an alert
            </a>
          </div>
        ) : (
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {filtered.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
