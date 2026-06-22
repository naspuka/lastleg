# LastLeg

A peer-to-peer resale platform for unused, last-minute UK coach tickets.

## The problem

Non-refundable, non-changeable coach tickets get wasted every day when plans change. The seller eats the loss. Someone else, often standing at the same coach station, is paying full walk-up price for the exact same seat. There is no working market between them.

## What LastLeg does

- A seller who can't use their ticket lists it on LastLeg in under 60 seconds
- A buyer browsing the live feed (or matching a saved route alert) picks it up at a discount
- The price is capped at what the seller originally paid — no scalping
- Payments are held in escrow; sellers are paid after the trip has happened
- Tickets are PDF-parsed, deduplicated, and verified before listing
- If a buyer is denied boarding, a guarantee fund refunds them in full

## MVP scope

- **Geography:** United Kingdom only
- **Inventory:** Coach/bus only (National Express, Megabus, FlixBus, Stagecoach). Rail is out of scope for v1.
- **Routes at launch:** five corridors — London ↔ Manchester / Birmingham / Leeds / Edinburgh, plus one TBD
- **Platform:** web app only
- **Fees:** free for sellers. Buyer pays £1 flat + 8%, capped at £4

See [`docs/DECISIONS.md`](docs/DECISIONS.md) for the full set of product decisions and why they were made.

## Documents

| Doc                                                          | Purpose                                                         |
| ------------------------------------------------------------ | --------------------------------------------------------------- |
| [`docs/DECISIONS.md`](docs/DECISIONS.md)                     | Every product/architecture decision, with context and rationale |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)               | System design, data model, key flows, integrations              |
| [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) | Phased build plan from landing page to launch                   |
| [`docs/TASKS.md`](docs/TASKS.md)                             | Actionable task breakdown grouped by phase                      |
| [`docs/SETUP.md`](docs/SETUP.md)                             | Step-by-step from clone to first production deploy              |
| [`docs/LANDING_WIREFRAME.md`](docs/LANDING_WIREFRAME.md)     | Landing-page wireframe and copy                                 |
| [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md)                 | Folder structure, server-action patterns, money / time / id rules |
| [`docs/RUNBOOKS/`](docs/RUNBOOKS/)                           | Ops runbooks: chargeback, claim review, Inngest outage, payout reversal, deploy rollback, Neon incident, seller payouts |
| [`docs/LEGAL/`](docs/LEGAL/)                                 | Draft ToS / Privacy / AUP / DPA — pending UK legal review       |

## Status

Built solo across 8 product phases (Phase 0 → Phase 8). Marketing landing,
auth, full app data model, seller flow with real PDF parsing, buyer browse +
checkout, Stripe escrow, background jobs, dispute flow, admin surfaces,
legal templates, runbooks. Deployed on Vercel; landing + waitlist live and
collecting signups. Production transactions gated on Stripe live keys + a
custom domain (intentionally deferred — see `docs/SETUP.md`).

## For recruiters — project highlights

LastLeg is a portfolio-grade full-stack project that I designed and built
end-to-end as one person, from problem statement through architecture
documents through shipped code through ops runbooks. It's deliberately
ambitious so the architectural reasoning is visible to a reviewer.

**Stack.** Next.js 16 (App Router, React Server Components, Server Actions)
· TypeScript strict · Drizzle ORM on Neon Postgres · Clerk auth (email +
phone OTP) · Stripe Connect Express + manual-capture PaymentIntents ·
Inngest for time-anchored background work · Resend transactional email ·
Twilio SMS · Vercel Blob for PDF storage · PostHog (EU) analytics · Tailwind
v4 + shadcn/ui · GitHub Actions CI · Husky + lint-staged + Prettier on
pre-commit.

**Engineering highlights — what the code shows I can do.**

- **Designed the data model from first principles.** 8 Postgres tables
  (`users`, `listings`, `operator_tickets`, `transactions`,
  `guarantee_claims`, `route_alerts`, `audit_log`, `waitlist`) with
  Postgres enums, CHECK constraints encoding business invariants
  (`list_price ≤ original_price`, `floor ≤ list`), partial unique indexes
  on soft-deleted columns, and a `(operator, booking_reference)` UNIQUE
  index that makes duplicate-listing fraud impossible at the DB layer.
  Documented in `docs/ARCHITECTURE.md`; migrations under `drizzle/`.

- **Reverse-engineered Distribusion's white-label PDF format** (used by
  Megabus UK, FlixBus, and several smaller European operators) from a
  single real ticket. The parser at `src/lib/pdf-parsers/distribusion.ts`
  walks pdfjs token streams, extracts operator/booking/ticket/route/time/
  price/passenger fields with self-reported confidence scoring, and
  splits multi-passenger PDFs into sibling listings, each with its own
  uniqueness constraint. One parser covers ~80 % of UK coach inventory.

- **Built the Stripe-escrow marketplace state machine.** Per D012, buyer
  cards are authorised at purchase but **not captured** until
  `departure + 1 hour`; the seller is paid via a Stripe Connect transfer
  after that with pre-checks on Identity verification (D015), open
  disputes, and pending guarantee claims (D009). Adaptive ticket-file
  release per D014: early sales hold the file until T-30min, late sales
  release immediately. Webhook signature verification + idempotency via
  `audit_log` dedup.

- **Wrote ten Inngest background functions** (verify-listing,
  match-alerts, release-ticket, release-payout, reconcile-stripe,
  decay-price, expire-listing, cleanup-orphaned-blobs, process-claim,
  health-check) with concurrency keys, `step.run` idempotency, and
  `step.sleepUntil` for the time-anchored escrow + ticket-release flows.

- **Implemented linear price decay in a single SQL UPDATE** with a CASE
  expression interpolating `current_price` between `list_price` at
  `departure − 4h` and `floor_price` at `departure − 30min`. Touches each
  live listing at most once per 5-minute cron tick; idempotent within
  the window. (`src/lib/inngest/functions/decay-price.ts`.)

- **Adopted an "env-gated integration" pattern** that lets every external
  service (Clerk, Stripe, Inngest, Resend, Twilio, Vercel Blob, PostHog,
  Sentry) be unset without the app crashing. Each integration's client
  returns `null` when its keys are absent, and call sites handle that
  branch. The app boots and the landing page renders at zero monthly
  cost; each integration "lights up" as keys are pasted into Vercel.

- **Honesty in the UX surface.** Named-ticket disclosure at checkout
  per D016 (we show the buyer the seller's first name + initial and a
  guarantee-fund refund clause if they're denied boarding). Strict
  no-scalping cap enforced at both the form-validation and DB-CHECK
  layers (D005). Buyer-fee formula `min(£1 + 8 %, £4)` lives in one
  place at `src/lib/pricing.ts`.

- **Multi-layer fraud prevention** documented in D011: PDF parse + DB
  UNIQUE on `(operator, ticket #)` (working today) + receipt-email
  cross-check (P2-14, deferred until custom domain) + operator scan-API
  (Phase 5, post-MVP). Rate limits (in-process token bucket) on listing
  creation and claim filing per P7-07.

- **Took the time to document the why.** 21 numbered ADR-style decision
  records under `docs/DECISIONS.md` covering inventory scope (D002),
  pricing model (D005-D007), trust posture (D008), escrow timing (D012),
  identity gating (D015), named-ticket UX (D016), tech-stack picks
  (D019), build order (D020), and the Phase-1 UUID-over-ULID amendment
  (D021). Plus implementation plan, task breakdown, conventions, and 7
  operational runbooks under `docs/RUNBOOKS/`.

- **Phase 0 (landing + waitlist) is live in production** at the deployed
  Vercel URL, collecting signups end-to-end (real Neon row + Clerk-synced
  user + PostHog events). Phases 1 – 8 ship the rest of the stack: data
  model, real PDF parser proven against a real ticket, Stripe scaffolding,
  ten Inngest jobs, dispute flow, admin surfaces, cookie banner, status
  page, legal templates, ops runbooks. End-to-end activation needs Stripe
  test keys and a verified Resend sender domain — see `docs/SETUP.md`.

- **The architecture is "boring on purpose."** Every choice is
  conventionally correct rather than novel: Postgres over a vector DB,
  Drizzle over Prisma, Inngest over self-rolled cron, Stripe Connect
  over a custom escrow layer. Optimised for shipping and for the next
  engineer to read.

**Honest scope.** I have not run real money through Stripe in this repo;
that requires live keys + a domain + UK legal review of the ToS / Privacy
templates. The Phase 7 legal docs and external security review are
explicitly flagged as TODO. This project is the *engineering substrate*
behind a marketplace — not a launched company. It's here to show how I
think about data models, time-anchored escrow, fraud surfaces, fallback
patterns, and writing things down.

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · shadcn/ui ·
Drizzle ORM · Neon Postgres · Clerk · Stripe (Connect + Identity +
Payments) · Resend · Twilio · Vercel Blob · Inngest · Sentry (env-gated
stub) · PostHog (EU) · Vercel hosting.

## License

TBD — see `docs/DECISIONS.md` for the open licensing question.
