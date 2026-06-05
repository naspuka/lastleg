import Link from "next/link";
import {
  ArrowRight,
  Ban,
  BellRing,
  BusFront,
  CircleCheck,
  LifeBuoy,
  ShieldCheck,
  Upload,
} from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { FadeUp } from "./fade-up";
import { TicketIllustration } from "./ticket-illustration";

import { NavAuth } from "./nav-auth";

export function Nav() {
  return (
    <header className="border-border/60 bg-background/80 sticky top-0 z-30 w-full border-b backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <Link
          href="/"
          className="font-heading text-primary text-xl font-semibold tracking-tight"
        >
          LastLeg
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <NavAuth />
          <a
            href="#waitlist"
            className={cn(
              buttonVariants({ size: "sm" }),
              "bg-brand-coral text-brand-coral-foreground hover:bg-brand-coral-hover border-brand-coral"
            )}
          >
            <span className="hidden sm:inline">Join the waitlist</span>
            <span className="sm:hidden">Waitlist</span>
            <ArrowRight className="size-3.5" />
          </a>
        </div>
      </div>
    </header>
  );
}

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Soft radial wash behind the hero */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(80% 60% at 50% 0%, oklch(0.94 0.018 85) 0%, transparent 70%)",
        }}
      />
      <div className="mx-auto max-w-6xl px-6 pt-14 pb-20 sm:pt-20 sm:pb-28">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <FadeUp className="text-center lg:text-left">
            <span className="border-primary/15 bg-primary/5 text-primary inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium">
              <span className="bg-brand-coral size-1.5 rounded-full" />
              Launching summer 2026 · UK only
            </span>
            <h1 className="font-heading text-foreground mt-6 text-4xl leading-[1.05] font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              Don&rsquo;t waste your unused{" "}
              <span className="text-primary">coach ticket</span>.
            </h1>
            <p className="text-muted-foreground mt-6 text-lg leading-relaxed sm:text-xl">
              LastLeg is a marketplace for last-minute UK coach tickets you
              can&rsquo;t use. Sellers recoup something. Buyers get a discount.
              No scalping.
            </p>
            <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center sm:gap-5 lg:items-start lg:justify-start">
              <a
                href="#waitlist"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "bg-brand-coral text-brand-coral-foreground hover:bg-brand-coral-hover border-brand-coral h-12 px-6 text-base"
                )}
              >
                Join the waitlist
                <ArrowRight className="size-4" />
              </a>
              <a
                href="#how"
                className="text-muted-foreground hover:text-foreground text-sm font-medium underline-offset-4 transition-colors hover:underline"
              >
                See how it works →
              </a>
            </div>
            <p className="text-muted-foreground/80 mt-6 text-sm">
              Free for sellers. Buyers pay £1 + 8%, capped at £4. No scalping,
              ever.
            </p>
          </FadeUp>

          <FadeUp delay={150} className="relative">
            <div className="relative mx-auto max-w-md lg:max-w-none">
              <TicketIllustration />
              <p className="text-muted-foreground mt-4 text-center text-xs lg:text-left">
                Example: a £24 walk-up ticket steps down to £9 as the coach gets
                closer to leaving.
              </p>
            </div>
          </FadeUp>
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  {
    n: 1,
    icon: Upload,
    title: "List",
    body: "Upload your unused ticket in under 60 seconds. Your price is capped at what you paid.",
  },
  {
    n: 2,
    icon: BellRing,
    title: "Match",
    body: "A buyer on the same route picks it up at a discount. Their payment is held in escrow until departure.",
  },
  {
    n: 3,
    icon: BusFront,
    title: "Travel",
    body: "Buyer gets the ticket before the coach leaves. You’re paid an hour after the trip’s done.",
  },
] as const;

export function ThreeStep() {
  return (
    <section id="how" className="border-border/60 bg-card/50 border-t">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <FadeUp className="max-w-2xl">
          <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            How it works
          </h2>
          <p className="text-muted-foreground mt-4 text-base leading-relaxed sm:text-lg">
            Three steps. The system handles the awkward bits — verification,
            escrow, and post-trip payouts — so you don&rsquo;t have to.
          </p>
        </FadeUp>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <FadeUp key={step.n} delay={i * 100}>
                <div className="group border-border bg-card hover:shadow-primary/5 relative flex h-full flex-col rounded-2xl border p-6 transition-all hover:-translate-y-0.5 hover:shadow-lg sm:p-7">
                  <div className="flex items-center gap-4">
                    <div className="bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground grid size-10 place-content-center rounded-xl transition-colors">
                      <Icon className="size-5" />
                    </div>
                    <span className="font-heading text-muted-foreground text-sm font-semibold tracking-wider">
                      STEP {step.n}
                    </span>
                  </div>
                  <h3 className="font-heading mt-5 text-2xl font-semibold tracking-tight">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground mt-3 text-base leading-relaxed">
                    {step.body}
                  </p>
                </div>
              </FadeUp>
            );
          })}
        </div>
      </div>
    </section>
  );
}

const TRUST = [
  {
    icon: ShieldCheck,
    title: "Escrow",
    body: "Sellers paid after the trip, not before. Buyers covered until they’ve boarded.",
  },
  {
    icon: Ban,
    title: "No scalping",
    body: "Resale price is capped at the seller’s original purchase price. Never above.",
  },
  {
    icon: LifeBuoy,
    title: "Guarantee fund",
    body: "Denied boarding? Operator cancellation? You get a full refund from us.",
  },
] as const;

export function TrustStrip() {
  return (
    <section className="border-border/60 bg-primary text-primary-foreground border-y">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 sm:grid-cols-3 sm:gap-8">
        {TRUST.map((t, i) => {
          const Icon = t.icon;
          return (
            <FadeUp key={t.title} delay={i * 100}>
              <div className="flex flex-col gap-3">
                <div className="bg-primary-foreground/10 text-brand-coral grid size-10 place-content-center rounded-xl">
                  <Icon className="size-5" />
                </div>
                <h3 className="font-heading text-lg font-semibold">
                  {t.title}
                </h3>
                <p className="text-primary-foreground/70 text-sm leading-relaxed">
                  {t.body}
                </p>
              </div>
            </FadeUp>
          );
        })}
      </div>
    </section>
  );
}

const ROUTE_CARDS = [
  { from: "London", to: "Manchester", code: "VIC ↔ MAN", live: true },
  { from: "London", to: "Birmingham", code: "VIC ↔ BHM", live: true },
  { from: "London", to: "Leeds", code: "VIC ↔ LDS", live: true },
  { from: "London", to: "Edinburgh", code: "VIC ↔ EDI", live: true },
  { from: "London", to: "Bristol", code: "VIC ↔ BRS", live: false },
] as const;

export function Routes() {
  return (
    <section className="bg-background">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <FadeUp className="max-w-2xl">
          <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            Launch corridors
          </h2>
          <p className="text-muted-foreground mt-4 text-base leading-relaxed sm:text-lg">
            We&rsquo;re saturating five UK corridors first. Pick yours when you
            sign up and we&rsquo;ll invite you the moment that route goes live.
          </p>
        </FadeUp>

        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:gap-4">
          {ROUTE_CARDS.map((route, i) => (
            <FadeUp key={route.code} delay={i * 60}>
              <div className="group border-border bg-card hover:border-primary/40 relative h-full rounded-xl border p-5 transition-all hover:shadow-md">
                <div className="flex items-start justify-between">
                  <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                    {route.code}
                  </span>
                  {route.live ? (
                    <span className="bg-primary/8 text-primary inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase">
                      <span className="bg-brand-coral size-1 rounded-full" />
                      Day 1
                    </span>
                  ) : (
                    <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase">
                      TBD
                    </span>
                  )}
                </div>
                <div className="font-heading mt-4 text-base leading-tight font-semibold">
                  {route.from}
                  <span className="text-muted-foreground mx-1.5">→</span>
                  {route.to}
                </div>
              </div>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  );
}

const FAQS = [
  {
    q: "Is this legal?",
    a: "Coach tickets from National Express, Megabus, FlixBus and Stagecoach are generally transferable. Rail Advance tickets aren't, so we don't accept them.",
  },
  {
    q: "What if the driver checks the name on the ticket?",
    a: "Most don't, but if you're denied boarding our guarantee fund refunds you in full. We tell you at checkout when a ticket is in someone else's name.",
  },
  {
    q: "How does the price work?",
    a: "The seller chooses a price, capped at what they originally paid. As departure approaches, the price automatically steps down toward a floor the seller sets.",
  },
  {
    q: "When does the seller get paid?",
    a: "About an hour after the coach departs, once we know the buyer wasn't turned away.",
  },
  {
    q: "What does it cost?",
    a: "Free for sellers. Buyers pay £1 + 8%, capped at £4. So a £9 ticket costs £10.72 all-in.",
  },
  {
    q: "Which routes are you launching with?",
    a: "London ↔ Manchester, Birmingham, Leeds and Edinburgh on day one, with a fifth corridor (likely Bristol or Liverpool) to follow. We'll expand from there.",
  },
] as const;

export function Faq() {
  return (
    <section className="border-border/60 bg-card/40 border-t">
      <div className="mx-auto max-w-3xl px-6 py-20 sm:py-24">
        <FadeUp>
          <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            Frequently asked
          </h2>
        </FadeUp>
        <FadeUp delay={100}>
          <Accordion className="border-border/60 mt-10 border-t">
            {FAQS.map((item) => (
              <AccordionItem key={item.q} value={item.q}>
                <AccordionTrigger className="py-5 text-base font-medium sm:text-lg">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-muted-foreground leading-relaxed">
                    {item.a}
                  </p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </FadeUp>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-border/60 bg-background border-t">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="font-heading text-primary text-lg font-semibold">
            LastLeg
          </span>
          <span className="bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase">
            <CircleCheck className="text-primary size-3" />
            UK only
          </span>
        </div>
        <div className="text-muted-foreground flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
          <a
            href="/privacy"
            className="hover:text-foreground underline-offset-4 hover:underline"
          >
            Privacy
          </a>
          <a
            href="mailto:contact@lastleg.app"
            className="hover:text-foreground underline-offset-4 hover:underline"
          >
            contact@lastleg.app
          </a>
          <span>© 2026 LastLeg</span>
        </div>
      </div>
    </footer>
  );
}
