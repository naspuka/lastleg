import type { Metadata } from "next";
import Link from "next/link";

import { Footer, Nav } from "@/components/landing/sections";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "How LastLeg handles your data at the waitlist stage and what your rights are under UK GDPR.",
};

// Phase 0 lightweight notice covering only what we collect today: waitlist
// signups. The full DPA / cookie disclosures land in Phase 7 (P7-03 / P7-06)
// once payments and identity flows exist.
export default function PrivacyPage() {
  return (
    <>
      <Nav />
      <main className="flex-1">
        <article className="mx-auto max-w-2xl px-6 py-16 sm:py-20">
          <header className="border-b border-border/60 pb-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Privacy notice
            </p>
            <h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
              What LastLeg does with your data
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Last updated 4 June 2026. This is the lightweight notice for our
              pre-launch waitlist. The full Privacy Policy and DPA will
              replace it before we accept any payments.
            </p>
          </header>

          <Section title="What we collect when you join the waitlist">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Your email address (required).</li>
              <li>Your UK phone number, only if you choose to share it.</li>
              <li>
                Whether you&rsquo;re interested in buying tickets, selling
                them, or both.
              </li>
              <li>
                Which of our five launch routes you&rsquo;d use.
              </li>
              <li>
                Technical information your browser sends automatically (IP
                address, user-agent, referrer), held briefly in server logs.
              </li>
            </ul>
          </Section>

          <Section title="Why we collect it">
            <p>
              We use your email to send a one-off signup confirmation now, and
              to invite you when LastLeg launches on the routes you picked.
              Your phone number, if you provided one, is only used for the
              SMS route-match alerts you opt into. Your role and route
              preferences let us batch invitations sensibly so people on quiet
              corridors aren&rsquo;t left waiting for a feed with nothing on
              it.
            </p>
            <p>
              The lawful basis under UK GDPR Article 6(1) is your consent
              (Article 6(1)(a)) for everything except the server logs, which
              we keep under legitimate interest (Article 6(1)(f)) for
              security and abuse-prevention.
            </p>
          </Section>

          <Section title="Who we share it with">
            <p>We use a small number of third-party processors:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong>Neon</strong> (US/EU regions; we use EU) &mdash; database
                hosting.
              </li>
              <li>
                <strong>Vercel</strong> &mdash; web hosting and edge delivery.
              </li>
              <li>
                <strong>Resend</strong> &mdash; sends the confirmation email.
              </li>
              <li>
                <strong>PostHog</strong> (EU instance) &mdash; anonymous
                product analytics.
              </li>
            </ul>
            <p>
              We do not sell your data to anyone, ever. We do not share it
              with marketing networks or data brokers.
            </p>
          </Section>

          <Section title="How long we keep it">
            <p>
              Waitlist rows are kept until you ask us to delete them or for
              24 months after we launch on your route, whichever is sooner.
              If you join LastLeg as a user, the row is migrated into your
              account record and governed by the full Privacy Policy from
              that point.
            </p>
            <p>Server logs are kept for 30 days, then deleted.</p>
          </Section>

          <Section title="Your rights">
            <p>Under UK GDPR you can ask us at any time to:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>show you what we hold about you,</li>
              <li>correct anything that&rsquo;s wrong,</li>
              <li>delete it,</li>
              <li>send it to you as a portable file,</li>
              <li>
                stop processing it (you can also do this by unsubscribing from
                the confirmation email, which removes you entirely).
              </li>
            </ul>
            <p>
              If you think we&rsquo;ve mishandled your data you can complain
              to the UK Information Commissioner&rsquo;s Office at{" "}
              <a
                href="https://ico.org.uk/make-a-complaint/"
                className="underline underline-offset-2 hover:text-foreground"
              >
                ico.org.uk
              </a>
              .
            </p>
          </Section>

          <Section title="How to reach us">
            <p>
              Email{" "}
              <a
                href="mailto:contact@lastleg.app"
                className="underline underline-offset-2 hover:text-foreground"
              >
                contact@lastleg.app
              </a>{" "}
              for any privacy request. We aim to respond within 7 days and are
              required to within 30.
            </p>
          </Section>

          <div className="mt-12 border-t border-border/60 pt-6">
            <Link
              href="/"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              ← Back to the landing page
            </Link>
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-base leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}
