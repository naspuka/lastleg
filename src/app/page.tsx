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

export default function HomePage() {
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
