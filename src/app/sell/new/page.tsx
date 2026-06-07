import { redirect } from "next/navigation";

import { AppNav } from "@/components/app/app-nav";
import { SellForm } from "@/components/sell/sell-form";
import { getSessionUser } from "@/lib/auth/session";

export const metadata = {
  title: "List a ticket",
};

// P2-11. Seller flow entry point. Middleware (proxy.ts) already gates
// /sell/* so we redirect to sign-in defensively only — anyone reaching this
// component is already authenticated.

export default async function SellNewPage() {
  if (!process.env.CLERK_SECRET_KEY) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-24">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Sell a ticket
        </h1>
        <p className="text-muted-foreground mt-4">
          Auth isn&rsquo;t configured on this deploy yet.
        </p>
      </main>
    );
  }

  const user = await getSessionUser();
  if (!user) redirect("/sign-in");

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-2xl px-6 py-12 sm:py-16">
        <p className="text-muted-foreground text-sm font-medium tracking-wider uppercase">
          List a ticket
        </p>
        <h1 className="font-heading mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Recover something from your unused ticket.
        </h1>
        <p className="text-muted-foreground mt-3 max-w-xl text-base leading-relaxed">
          Upload your coach ticket, set your price, and we&rsquo;ll match it to
          a buyer on the same route. You get paid an hour after the trip.
        </p>

        <div className="mt-10">
          <SellForm />
        </div>
      </main>
    </>
  );
}
