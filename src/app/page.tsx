import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { FadeUp } from "@/components/landing/fade-up";
import {
  Faq,
  Footer,
  Hero,
  Nav,
  Routes,
  ThreeStep,
  TrustStrip,
} from "@/components/landing/sections";
import { WaitlistForm } from "@/components/landing/waitlist-form";

// Signed-in users go straight into the app — they've already converted, no
// reason to keep showing them marketing. Marketing landing is only ever
// rendered for anonymous visitors.
//
// Env-gated: skip the auth probe when Clerk isn't configured so the page
// keeps rendering for £0/pre-Clerk deploys.
export default async function HomePage() {
  if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    const user = await currentUser();
    if (user) {
      redirect("/dashboard");
    }
  }

  return (
    <>
      <Nav />
      <main className="flex-1">
        <Hero />
        <ThreeStep />
        <Routes />
        <section
          id="waitlist-section"
          className="border-border/60 bg-background border-t"
        >
          <div className="mx-auto max-w-3xl px-6 py-20 sm:py-24">
            <FadeUp>
              <WaitlistForm />
            </FadeUp>
          </div>
        </section>
        <TrustStrip />
        <Faq />
      </main>
      <Footer />
    </>
  );
}
