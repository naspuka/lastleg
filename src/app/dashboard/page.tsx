import { redirect } from "next/navigation";

import { AppNav } from "@/components/app/app-nav";
import { getSessionUser } from "@/lib/auth/session";

// Placeholder dashboard per P1-16. Proves the full stack:
//   Clerk session → middleware allows access → server component reads our
//   `users` row from Neon → renders.
//
// When Clerk isn't yet configured this page renders a setup hint instead of
// crashing, mirroring the £0-path behaviour we use everywhere else.

export const metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const clerkConfigured = Boolean(process.env.CLERK_SECRET_KEY);

  if (!clerkConfigured) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-24">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Dashboard
        </h1>
        <p className="text-muted-foreground mt-4 leading-relaxed">
          Auth isn&rsquo;t wired up yet on this deploy. Once Clerk is
          provisioned (see <code>docs/SETUP.md</code>), this page will require a
          signed-in user and show their account state.
        </p>
      </main>
    );
  }

  const user = await getSessionUser();
  if (!user) {
    // Middleware should already gate this route, but defence in depth — and
    // covers the race where the Clerk session expires mid-render.
    redirect("/sign-in");
  }

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
        <p className="text-muted-foreground text-sm font-medium tracking-wider uppercase">
          Dashboard
        </p>
        <h1 className="font-heading mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
          Hello, {user.handle}.
        </h1>
        <p className="text-muted-foreground mt-4 max-w-xl text-base leading-relaxed">
          You&rsquo;re signed in. The seller and buyer surfaces land in Phase 2
          — for now this page is your account.
        </p>

        <section className="mt-12">
          <h2 className="font-heading text-lg font-semibold tracking-tight">
            Account
          </h2>
          <dl className="border-border/60 mt-4 divide-y rounded-xl border">
            <div className="flex items-center justify-between px-5 py-4 text-sm">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="font-medium">{user.email}</dd>
            </div>
            <div className="flex items-center justify-between px-5 py-4 text-sm">
              <dt className="text-muted-foreground">Phone</dt>
              <dd className="font-medium">
                {user.phone ?? (
                  <span className="text-muted-foreground italic">
                    Not added
                  </span>
                )}
              </dd>
            </div>
            <div className="flex items-center justify-between px-5 py-4 text-sm">
              <dt className="text-muted-foreground">Handle</dt>
              <dd className="font-medium">@{user.handle}</dd>
            </div>
            <div className="flex items-center justify-between px-5 py-4 text-sm">
              <dt className="text-muted-foreground">Role</dt>
              <dd className="font-medium capitalize">{user.role}</dd>
            </div>
            <div className="flex items-center justify-between px-5 py-4 text-sm">
              <dt className="text-muted-foreground">Stripe Identity</dt>
              <dd className="font-medium">
                {user.stripeIdentityVerifiedAt ? (
                  <span className="text-primary">Verified</span>
                ) : (
                  <span className="text-muted-foreground">
                    Pending (required before first payout)
                  </span>
                )}
              </dd>
            </div>
          </dl>
        </section>

        <section className="mt-12">
          <h2 className="font-heading text-lg font-semibold tracking-tight">
            What&rsquo;s next
          </h2>
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
            Phase 2 unlocks the seller flow: upload a coach ticket, get it
            verified via the PDF parser + forwarded receipt, see it go live in
            the feed. Buyer flow follows in Phase 3.
          </p>
        </section>
      </main>
    </>
  );
}
