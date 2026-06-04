# Implementation plan

Phased build plan from zero to live MVP. Each phase has clear deliverables, dependencies and a rough duration. Phases 1 onward proceed in parallel with Phase 0 (landing page) per [`D020`](DECISIONS.md#d020--build-order-landing-page-this-week--real-mvp-in-parallel-over-46-weeks).

Total target: **launch-ready MVP in ~6 weeks** of focused build time.

---

## Phase 0 — Landing page + waitlist

**Goal:** ship a public landing page this week that explains LastLeg, captures waitlist signups (with route + role preferences), and starts seeding the cold-start audience while the real product is being built.

**Duration:** 1–2 days

**Dependencies:** none

**Deliverables**

- Static (or near-static) Next.js landing page deployed to `lastleg.app`
- Hero: positioning, three-step explainer, FAQ
- Waitlist signup form: email + (optional) phone + route interest (multi-select from 5 corridors) + role (buyer / seller / both)
- Signups written to a Neon `waitlist` table — same DB as the eventual app
- Resend transactional email confirming signup
- Basic analytics (PostHog)
- Open-graph metadata + favicon + simple branding
- Privacy notice (lightweight — formal DPA in Phase 7)

**Exit criteria**

- Landing page is live at production domain over HTTPS
- A signup completes end-to-end and appears in the DB + receives a confirmation email
- PostHog records the page view + signup events

**What this phase does NOT include**

- Any product UI (no listings, no buyer flow, no auth beyond email capture)
- Stripe, Twilio, or PDF parsing
- Per-route landing pages (could be added later if SEO matters)

---

## Phase 1 — Foundations

**Goal:** project scaffold and shared infrastructure that everything else depends on. No user-visible features.

**Duration:** 3–5 days

**Dependencies:** Phase 0 complete (uses same repo)

**Deliverables**

- Next.js 15 (App Router) + TypeScript baseline (`pnpm`, strict TS, ESLint, Prettier)
- Tailwind CSS configured + shadcn/ui initialised + core components installed (Button, Input, Form, Toast, Dialog, Sheet, etc.)
- Drizzle ORM set up against Neon (separate dev branch)
- Initial Drizzle schema migrated: `User`, `Listing`, `Transaction`, `OperatorTicket`, `RouteAlert`, `GuaranteeClaim`, `AuditLog` + enums
- Clerk integrated: email + phone OTP signup, middleware-gated routes, server-side `auth()` helpers
- Resend integrated (transactional email base layer)
- Sentry integrated for client + server
- PostHog integrated
- Inngest project created (dev environment), one health-check job working
- Vercel project with environment configured: dev / preview / staging / production
- GitHub repo with CI: typecheck, lint, build on PR. Drizzle migration check.
- Repo conventions documented in `docs/CONVENTIONS.md` (folder structure, naming, server-action patterns)

**Exit criteria**

- A logged-in user can hit a `/dashboard` page that says "Hello {name}" — proves auth → DB → server → client end-to-end
- An Inngest test job fires from a server action and writes an audit log entry
- A failing test or typecheck blocks PR merge

---

## Phase 2 — Seller flow

**Goal:** a seller can sign up, list a ticket, and have it pass verification.

**Duration:** 5–7 days

**Dependencies:** Phase 1

**Deliverables**

- `/sell/new` page: PDF upload (drag-drop, 5 MB max), original price, listing price, floor price, optional notes
- Server action to create a `Listing` row in `pending_verification`, upload PDF to Vercel Blob with private signed URL
- `verify-listing` Inngest job:
  - PDF parsing: integrate `pdf.js` server-side; build parser for **Megabus** first (highest UK coach volume), with a parser-registry pattern for adding the other three operators
  - Extract: operator, booking ref, route, departure, price, passenger name (if present)
  - DB duplicate check on `(operator, booking_reference)` against `OperatorTicket`
  - Email-receipt verification: inbound webhook on `receipts@lastleg.app` (Resend inbound or SendGrid Inbound Parse), parse, match to listing
  - Status transitions: `pending_verification → live` (success) or `failed` (with reason surfaced to seller)
- `/sell` dashboard: list of seller's listings with status, ability to withdraw a live listing
- Email notifications to seller at every state change
- Listing display: route, time, operator, price (showing list price + auto-discount path)
- Parsers for **FlixBus**, **National Express**, **Stagecoach** added in this phase (Megabus is first; rest follow)

**Exit criteria**

- A seller uploads a real Megabus ticket PDF, forwards the receipt, and sees the listing go live
- The duplicate-listing check rejects a second attempt with the same booking ref
- All four operator parsers extract correct data on at least 5 real sample tickets each

**Notes**

- Real ticket PDFs are required for parser dev. Acquire 5+ real tickets per operator (purchase + cancel where possible, or use historical tickets shared by friends/colleagues).
- Parsers are necessarily fragile (operators change PDF format). Build them with a "this looked weird" telemetry signal that flags ambiguous tickets for manual review rather than auto-rejecting.

---

## Phase 3 — Buyer flow (browse + alerts)

**Goal:** a buyer can find a listing — either by browsing or via a saved route alert.

**Duration:** 4–6 days

**Dependencies:** Phase 2 (needs live listings to browse)

**Deliverables**

- `/` homepage logged-in: search-led "Where are you going?" + featured live listings on the 5 corridors
- `/browse` browseable feed: filterable by route, departure window, price; sorted by departure time ascending; auto-refresh every 30s on the live feed
- Listing detail page: full route info, time, operator, current price, decay schedule preview, passenger-name disclosure if applicable
- Route alerts:
  - `/alerts` create / list / delete saved alerts
  - Form: origin, destination, departure window, max price, notification channels (email / SMS opt-in, web push)
  - `match-alerts` Inngest job triggered when listing reaches `live`
  - Throttle: max one notification per alert per 15 minutes
- Web push notification opt-in (Service Worker + VAPID keys via `web-push`)
- Twilio integration for SMS alerts (UK numbers only at MVP)

**Exit criteria**

- A buyer with a saved alert receives an email + SMS within 60 seconds of a matching listing going live
- Browse feed shows live listings and reflects price decay
- A buyer can save a route alert and see it persist

**What this phase does NOT include**

- Checkout / payment (Phase 4)
- Buyer-side dispute flow (Phase 6)

---

## Phase 4 — Payments and escrow

**Goal:** a buyer can pay; funds are held in escrow; the system knows when and how to release them.

**Duration:** 6–8 days

**Dependencies:** Phase 3

**Deliverables**

- Stripe Connect Express set up; account creation flow triggered from seller dashboard on first listing
- Stripe Identity gating: required before any payout releases (not at signup, not at first listing)
- Buyer checkout:
  - Pricing breakdown (list price + £1 + 8% capped at £4)
  - Passenger-name disclosure component with required acknowledgement checkbox (per D016)
  - Stripe Elements card form
  - PaymentIntent with `capture_method = manual`
- On payment authorisation success:
  - `Transaction` row created
  - `Listing` marked sold; `OperatorTicket.sold_in_transaction_id` set
  - `release-ticket` Inngest job scheduled per adaptive-release rule (D014)
  - `release-payout` Inngest job scheduled for `departure_at + 1h`
- `release-ticket` job:
  - Generates short-TTL signed URL for the PDF
  - Sends to buyer via email + SMS + web push
  - Records `ticket_released_at`
- `release-payout` job:
  - Pre-checks: dispute open? scan-API check (where available)? seller Identity verified?
  - On pass: capture PaymentIntent, trigger Stripe transfer to seller's connected account
  - Records `payout_released_at`
- Stripe webhook handler for `payment_intent.succeeded`, `payment_intent.payment_failed`, `transfer.created`, `transfer.failed`, `account.updated`
- `reconcile-stripe` hourly cron to detect drift

**Exit criteria**

- An end-to-end transaction completes in Stripe test mode: buyer pays, ticket is released at the right time, payout fires at departure + 1h
- Adaptive-release timing verified for both early-sale (held) and late-sale (instant) paths
- All Stripe webhook events are idempotently handled (same event ID processed twice is a no-op)

---

## Phase 5 — Background-job hardening + operator scan checks

**Goal:** the time-anchored logic is robust. Operator scan APIs are integrated where they exist.

**Duration:** 3–5 days

**Dependencies:** Phase 4

**Deliverables**

- Price-decay job (`decay-price`): runs every 5 minutes; steps each live listing's current price toward its floor per a deterministic decay curve (e.g. linear from list price to floor over departure − 4h to departure − 30min)
- `expire-listing` job: marks unsold listings as expired at departure time; refunds any in-flight payment attempts; halts pending payouts
- Operator scan-API integration sprint: for each of Megabus, FlixBus, National Express, Stagecoach, investigate whether an API exists to check whether a booking ref was scanned. Document coverage in `docs/OPERATOR_INTEGRATIONS.md`. Implement integration for the operator(s) that have usable endpoints.
- `release-payout` job enhanced to use scan data where available
- Cleanup job (`cleanup-orphaned-blobs`): daily; removes Vercel Blob files for withdrawn/rejected listings older than 7 days

**Exit criteria**

- A listing's current price visibly steps down on the browse feed as departure approaches
- Where scan API exists, `release-payout` correctly holds payout when a ticket was not scanned + buyer claims they couldn't board
- Documented operator coverage map so we know exactly what manual-review proportion to expect

---

## Phase 6 — Guarantee fund and disputes

**Goal:** the unhappy paths work as well as the happy paths.

**Duration:** 4–6 days

**Dependencies:** Phase 4

**Deliverables**

- "Report a problem" button on every Transaction view
- Claim sub-flow:
  - Reason selection: denied boarding (name check / already scanned / other), operator cancellation, ticket invalid, seller misconduct
  - Optional evidence: photo upload, free text
  - `GuaranteeClaim` row created
- `process-claim` Inngest job:
  - Buyer's `guarantee_claims_used`:
    - `< 2`: auto-approve; cancel uncaptured PaymentIntent; refund buyer fee from platform balance; halt `release-payout`; increment counter
    - `>= 2`: route to manual-review queue (webhook → Linear issue or similar); show buyer "Under review, decision in 48h"
- Seller-side notification: payout blocked pending review, opportunity to dispute the claim
- Operator-cancellation path (`process-cancellation`): refund buyer, halt payout, no seller penalty
- Admin view (`/admin/claims`): list of pending manual reviews, approve / deny, attach notes; gated by Clerk role
- Audit log entries for every state transition

**Exit criteria**

- A test buyer files a denied-boarding claim; refund completes in test mode; seller payout is correctly halted; audit log shows the full trail
- A second claim from the same buyer also auto-approves; a third routes to manual review
- An operator-cancellation flow refunds the buyer without touching the guarantee fund

---

## Phase 7 — Pre-launch hardening

**Goal:** legally, operationally, and security-wise ready for real users and real money.

**Duration:** 5–7 days

**Dependencies:** Phases 0–6 complete

**Deliverables**

- **Terms of Service** drafted (template + UK legal review) — covers seller obligations, buyer rights, guarantee policy, dispute procedure, prohibited conduct, account termination
- **Privacy Policy + DPA** (UK GDPR / Data Protection Act 2018 compliant) — covers data collected, retention periods, third-party processors (Stripe, Clerk, Resend, Twilio, Vercel, Inngest, Sentry, PostHog), data subject rights
- **Cookie banner** (only if non-essential cookies in use — likely just PostHog, so a banner is needed)
- **Acceptable-use policy** specifically addressing: no rail Advance ticket listings, no listings the seller doesn't own, no inflated original-price claims
- Rate limits implemented on listing creation, account creation, claim filing
- Stripe Radar rules configured for the LastLeg use case
- Operational runbooks in `docs/RUNBOOKS/`: how to handle a chargeback, how to handle a manual claim review, how to recover from an Inngest outage, how to reverse a payout
- On-call rotation (single person at launch — owner) with PagerDuty or equivalent
- Status page (statuspage.io or simple Vercel route)
- Performance: Core Web Vitals all green on landing, browse feed, listing detail, checkout; image optimisation; CDN caching headers
- Accessibility pass: keyboard navigation, screen reader, colour contrast on all critical flows
- Security review (internal or external) — at minimum: secrets audit, dependency CVE scan, Stripe webhook signature verification check, file-upload safety check

**Exit criteria**

- A buyer can complete a full transaction in production with real money and a real ticket
- All legal documents are linked in the footer
- An external user agent (eg. a friend testing) can complete signup → list ticket → buy ticket → use ticket → receive payout, with no developer intervention

---

## Phase 8 — Soft launch

**Goal:** first 100 real transactions, with the team closely watching every one.

**Duration:** 2 weeks active monitoring

**Dependencies:** Phase 7

**Deliverables**

- Invite waitlist signups (Phase 0) in batches of 50, prioritising those who registered route interest on the launch corridors
- Reddit seeding: manual outreach to authors of "selling my coach ticket" posts on r/uktrains, r/UKPersonalFinance, r/london — offer to handle their listing
- Student-society outreach: contact union event-organisers at universities served by the launch corridors during term-end week
- Daily review of every transaction: completion rate, dispute rate, time-to-sale, average discount, buyer fee revenue, guarantee fund draw, Stripe Radar flags
- Hotfix tempo: deploy fixes same-day for anything user-facing
- Weekly retro: what's working, what isn't, what the data is showing
- Iterate the denied-boarding disclosure copy based on observed denial rates per route/operator
- Iterate the price-decay curve based on observed sell-through

**Exit criteria**

- 100 completed transactions
- Dispute rate < 5%
- Guarantee fund draw < 2% of GMV
- At least one corridor has consistent daily liquidity (≥5 listings/day, ≥40% sell-through)
- No critical incidents in the final 7 days

**Decision point:** at end of Phase 8, decide:

- Open to public + invest in growth?
- Iterate on a specific friction point?
- Expand inventory (add a 6th corridor, or begin rail Advance with operator partnership)?

---

## Cross-cutting workstreams (in parallel)

These don't fit neatly into phases — they happen throughout.

- **Brand and copy:** logo, colour system, marketing copy, the disclosure-at-checkout copy (high-stakes, A/B-testable). Best done at end of Phase 1, refined throughout.
- **Real ticket acquisition:** ongoing throughout Phases 2–5. Need a pipeline of real coach tickets to test parsers and flows against.
- **Operator relations:** background work throughout. Cold email each operator's commercial team early — even a non-answer is data. Some may want to collaborate; some may send legal threats. Either is useful to know before launch.
- **Content / SEO:** per-route landing pages, blog posts on "how to get cheap last-minute coach tickets" — useful for organic acquisition. Probably Phase 8+ but architect URLs to support it from Phase 1.

---

## Timeline (rough, contiguous build days)

```
Week 1  ────  Phase 0 ships day 2; Phase 1 starts day 1
Week 2  ────  Phase 1 finishes; Phase 2 starts
Week 3  ────  Phase 2 finishes; Phase 3 starts
Week 4  ────  Phase 3 finishes; Phase 4 starts
Week 5  ────  Phase 4 finishes; Phase 5 + 6 in parallel
Week 6  ────  Phase 5 + 6 finish; Phase 7 starts
Week 7  ────  Phase 7 finishes; Phase 8 (soft launch) begins
```

Real elapsed time will be longer with normal life. **Six contiguous build weeks → realistically 8–10 calendar weeks.**

---

## Risks and mitigations

| Risk                                               | Likelihood | Impact | Mitigation                                                                                                                      |
| -------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------------- |
| PDF parsing fragile across operator format changes | High       | Medium | Parser-registry pattern, "ambiguous → manual review" fallback, monitoring on parse confidence scores                            |
| Operator cease-and-desist                          | Medium     | High   | Coach-only at launch is the primary mitigation; have a legal-response plan ready; lean on consumer-rights framing               |
| Cold start fails on launch corridors               | Medium     | High   | Waitlist seeding from Phase 0; aggressive Reddit + student outreach; willing to operate with very low liquidity for 6+ weeks    |
| Stripe Identity friction drops sellers             | Medium     | Medium | Gating at first payout not signup softens this; monitor drop-off rate, consider relaxing to first listing if it's hurting badly |
| Guarantee fund draw exceeds buyer fee revenue      | Low        | High   | Buyer fee model has 8% margin built in; if fund draw spikes, tighten claim policy + investigate fraud patterns                  |
| Single-vendor outage (Stripe, Clerk, Vercel)       | Low        | High   | Accept the risk at MVP; document recovery procedures; multi-region / vendor redundancy is a v2 problem                          |
