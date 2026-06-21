import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { Trash2 } from "lucide-react";

import { deleteAlertAction } from "@/app/_actions/alerts";
import { AppNav } from "@/components/app/app-nav";
import { AlertForm } from "@/components/alerts/alert-form";
import { getDb, schema } from "@/db/client";
import { getSessionUser } from "@/lib/auth/session";
import { formatGBP } from "@/lib/pricing";
import { formatUkDateTime } from "@/lib/time";

export const metadata = { title: "Alerts" };

export default async function AlertsPage() {
  if (!process.env.CLERK_SECRET_KEY) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-24">
        <h1 className="font-heading text-3xl font-semibold">Alerts</h1>
        <p className="text-muted-foreground mt-4">Auth isn&rsquo;t set up.</p>
      </main>
    );
  }
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");

  const db = getDb();
  const alerts = db
    ? await db
        .select()
        .from(schema.routeAlerts)
        .where(eq(schema.routeAlerts.userId, user.id))
        .orderBy(desc(schema.routeAlerts.createdAt))
        .limit(50)
    : [];

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <p className="text-muted-foreground text-sm font-medium tracking-wider uppercase">
          Saved routes
        </p>
        <h1 className="font-heading mt-2 text-3xl font-semibold sm:text-4xl">
          Alerts
        </h1>
        <p className="text-muted-foreground mt-3 max-w-xl text-sm leading-relaxed">
          We&rsquo;ll email or SMS you the moment a ticket goes live on a route
          you&rsquo;ve saved. Throttled to one notification per alert per 15
          minutes.
        </p>

        <div className="mt-10 space-y-8">
          <AlertForm />

          <div>
            <h2 className="font-heading text-lg font-semibold">Your alerts</h2>
            {alerts.length === 0 ? (
              <p className="text-muted-foreground mt-3 text-sm">
                No alerts saved yet.
              </p>
            ) : (
              <ul className="mt-4 divide-y rounded-xl border bg-card">
                {alerts.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-4 px-5 py-4">
                    <div className="min-w-0">
                      <p className="font-heading truncate font-semibold">
                        {a.routeOrigin}
                        <span className="text-muted-foreground mx-1.5">→</span>
                        {a.routeDestination}
                      </p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {formatUkDateTime(a.windowStart)} – {formatUkDateTime(a.windowEnd)}
                        {a.maxPricePence !== null && (
                          <> · max {formatGBP(a.maxPricePence)}</>
                        )}
                        {" · "}
                        {[
                          a.notifyEmail && "email",
                          a.notifySms && "SMS",
                          a.notifyPush && "push",
                        ]
                          .filter(Boolean)
                          .join(" + ")}
                      </p>
                    </div>
                    <form action={deleteAlertAction}>
                      <input type="hidden" name="id" value={a.id} />
                      <button
                        type="submit"
                        className="text-muted-foreground hover:text-destructive p-2 transition-colors"
                        aria-label="Delete alert"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
