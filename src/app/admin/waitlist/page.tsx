import { count, desc, sql as drizzleSql } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";

import { inviteWaitlistBatchAction } from "@/app/_actions/admin";
import { AppNav } from "@/components/app/app-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getDb, schema } from "@/db/client";
import { getSessionUser } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";
import { formatUkDateTime } from "@/lib/time";

export const metadata = { title: "Admin · Waitlist" };
export const dynamic = "force-dynamic";

export default async function AdminWaitlistPage() {
  if (!process.env.CLERK_SECRET_KEY) notFound();
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");
  if (!user.isAdmin) notFound();

  const db = getDb();
  if (!db) notFound();

  // Per-route un-invited counts.
  const perRoute: { route: string; pending: number }[] = [];
  for (const r of ROUTES) {
    const rows = await db
      .select({ n: count() })
      .from(schema.waitlist)
      .where(
        drizzleSql`${schema.waitlist.invitedAt} IS NULL AND ${r.slug} = ANY(${schema.waitlist.routes})`
      );
    perRoute.push({ route: r.slug, pending: rows[0]?.n ?? 0 });
  }

  const recent = await db
    .select()
    .from(schema.waitlist)
    .orderBy(desc(schema.waitlist.createdAt))
    .limit(50);

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-4xl px-6 py-12">
        <p className="text-muted-foreground text-sm font-medium tracking-wider uppercase">
          Admin · Waitlist
        </p>
        <h1 className="font-heading mt-2 text-3xl font-semibold sm:text-4xl">
          Send invites
        </h1>

        <section className="mt-8 rounded-2xl border bg-card p-5 sm:p-6">
          <form action={inviteWaitlistBatchAction} className="space-y-4">
            <div>
              <Label htmlFor="route">Route</Label>
              <select
                id="route"
                name="route"
                required
                className="border-input bg-background focus-visible:ring-ring/50 mt-2 h-9 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-3"
              >
                <option value="" disabled selected>
                  Pick a route
                </option>
                {ROUTES.map((r) => {
                  const pending =
                    perRoute.find((p) => p.route === r.slug)?.pending ?? 0;
                  return (
                    <option key={r.slug} value={r.slug}>
                      {r.label} ({pending} pending)
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <Label htmlFor="batchSize">Batch size</Label>
              <Input
                id="batchSize"
                name="batchSize"
                type="number"
                min={1}
                max={200}
                defaultValue={50}
                className="mt-2 max-w-[160px]"
              />
              <p className="text-muted-foreground mt-1 text-xs">
                Sends to N un-invited rows for the route, oldest signups first.
              </p>
            </div>
            <Button
              type="submit"
              className="bg-brand-coral text-brand-coral-foreground hover:bg-brand-coral-hover border-brand-coral"
            >
              Send invites
            </Button>
          </form>
        </section>

        <section className="mt-12">
          <h2 className="font-heading text-lg font-semibold">Recent signups</h2>
          <ul className="mt-4 divide-y rounded-xl border bg-card">
            {recent.map((w) => (
              <li
                key={w.id}
                className="flex items-center justify-between px-5 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">{w.email}</p>
                  <p className="text-muted-foreground text-xs">
                    {w.role} · {w.routes.join(", ")} ·{" "}
                    {formatUkDateTime(w.createdAt)}
                  </p>
                </div>
                <span className="text-muted-foreground text-xs">
                  {w.invitedAt ? "invited" : "pending"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
