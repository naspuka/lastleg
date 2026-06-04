import { redirect } from "next/navigation";

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
    <main className="mx-auto max-w-2xl px-6 py-24">
      <h1 className="font-heading text-3xl font-semibold tracking-tight">
        Hello, {user.handle}.
      </h1>
      <dl className="mt-8 space-y-3 text-sm">
        <div className="flex justify-between border-b pb-2">
          <dt className="text-muted-foreground">Email</dt>
          <dd>{user.email}</dd>
        </div>
        <div className="flex justify-between border-b pb-2">
          <dt className="text-muted-foreground">Role</dt>
          <dd>{user.role}</dd>
        </div>
        <div className="flex justify-between border-b pb-2">
          <dt className="text-muted-foreground">Stripe Identity</dt>
          <dd>{user.stripeIdentityVerifiedAt ? "Verified" : "Pending"}</dd>
        </div>
      </dl>
    </main>
  );
}
