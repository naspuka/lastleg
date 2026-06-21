import { headers } from "next/headers";

import { Badge } from "@/components/ui/badge";

// Lightweight public status page per P7-14. Probes /api/health from the
// same origin so external monitors can scrape this URL and consumers can
// check during incidents.
//
// Render is server-side, no auth — useful for everyone.

export const metadata = { title: "Status" };
export const dynamic = "force-dynamic";

type Health = {
  ok: boolean;
  env: Record<string, boolean>;
  db: { reachable: boolean; waitlistRows?: number; error?: string };
  runtime: {
    nodeVersion: string;
    vercelEnv: string | null;
    commit: string | null;
    region: string | null;
  };
};

async function fetchHealth(): Promise<Health | null> {
  // Build the absolute URL from the incoming request's host so this works
  // on preview deployments + custom domains without env var fiddling.
  const h = await headers();
  const host = h.get("host") ?? "localhost:4000";
  const proto =
    process.env.NODE_ENV === "production" || host.includes(".vercel.app")
      ? "https"
      : "http";
  try {
    const res = await fetch(`${proto}://${host}/api/health`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as Health;
  } catch {
    return null;
  }
}

export default async function StatusPage() {
  const h = await fetchHealth();

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <p className="text-muted-foreground text-sm font-medium tracking-wider uppercase">
        Status
      </p>
      <h1 className="font-heading mt-2 text-3xl font-semibold sm:text-4xl">
        Service status
      </h1>

      <div className="mt-8 rounded-2xl border bg-card p-6">
        <div className="flex items-center justify-between">
          <p className="font-heading text-lg font-semibold">Overall</p>
          {h?.ok ? (
            <Badge>All systems operational</Badge>
          ) : (
            <Badge variant="destructive">Degraded</Badge>
          )}
        </div>
        {h && (
          <dl className="text-muted-foreground mt-5 space-y-2 text-sm">
            <Row label="Database" ok={h.db.reachable}>
              {h.db.reachable
                ? `${h.db.waitlistRows ?? 0} waitlist rows`
                : (h.db.error ?? "unreachable")}
            </Row>
            <Row label="Auth (Clerk)" ok={h.env.CLERK_SECRET_KEY} />
            <Row label="Background jobs (Inngest)" ok={h.env.INNGEST_SIGNING_KEY} />
            <Row label="Payments (Stripe)" ok={h.env.STRIPE_SECRET_KEY} />
            <Row label="Email (Resend)" ok={h.env.RESEND_API_KEY} />
            <Row label="SMS (Twilio)" ok={h.env.TWILIO_ACCOUNT_SID} />
            <Row label="Blob storage" ok={h.env.BLOB_READ_WRITE_TOKEN} />
            <Row label="Analytics (PostHog)" ok={h.env.NEXT_PUBLIC_POSTHOG_KEY} />
          </dl>
        )}
        {h && (
          <p className="text-muted-foreground mt-6 text-xs">
            Commit {h.runtime.commit ?? "?"} · region {h.runtime.region ?? "?"}
            {" "}· {h.runtime.vercelEnv ?? "local"}
          </p>
        )}
      </div>

      <p className="text-muted-foreground mt-6 text-xs">
        For incidents reach out to contact@lastleg.app.
      </p>
    </main>
  );
}

function Row({
  label,
  ok,
  children,
}: {
  label: string;
  ok: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b pb-2 last:border-0">
      <dt>{label}</dt>
      <dd className="flex items-center gap-2 font-medium">
        <span
          className={
            ok ? "inline-block size-2 rounded-full bg-emerald-500" : "inline-block size-2 rounded-full bg-zinc-300"
          }
          aria-hidden
        />
        {children ?? (ok ? "Live" : "Not configured")}
      </dd>
    </div>
  );
}
