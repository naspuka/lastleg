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

| Doc | Purpose |
|---|---|
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Every product/architecture decision, with context and rationale |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System design, data model, key flows, integrations |
| [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) | Phased build plan from landing page to launch |
| [`docs/TASKS.md`](docs/TASKS.md) | Actionable task breakdown grouped by phase |
| [`docs/SETUP.md`](docs/SETUP.md) | Step-by-step from clone to first production deploy |
| [`docs/LANDING_WIREFRAME.md`](docs/LANDING_WIREFRAME.md) | Landing-page wireframe and copy |

## Status

Pre-development. Planning artifacts complete; first code (landing page) starts next.

## Tech stack (planned)

Next.js 15 (App Router) · TypeScript · Tailwind · shadcn/ui · Neon Postgres · Clerk · Stripe (Connect + Identity + Payments) · Resend · Twilio · Vercel Blob · Inngest · Sentry · PostHog · Vercel hosting

## License

TBD
