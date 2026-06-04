# Tasks

Flat actionable breakdown of every task to get LastLeg MVP to launch. Grouped by phase from [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md).

**Conventions**
- `id` — stable identifier for cross-referencing (e.g. in PRs, issue trackers, decision discussions)
- `size` — rough effort: `XS` (<1h) · `S` (1–4h) · `M` (4–12h, ~1 day) · `L` (1–3 days) · `XL` (3+ days, consider splitting)
- `blocks` — task IDs that cannot start until this one is done
- Status starts `todo`; transitions: `todo → in_progress → done` (or `blocked`)

---

## Phase 0 — Landing page + waitlist

| ID | Task | Size | Blocked by | Status |
|---|---|---|---|---|
| P0-01 | Register `lastleg.app` domain; set up DNS | XS | — | todo |
| P0-02 | Create Vercel project; connect domain | XS | P0-01 | todo |
| P0-03 | Initialise Next.js 15 + TypeScript + Tailwind + shadcn/ui in repo | S | — | todo |
| P0-04 | Create Neon project; provision dev + production branches | XS | — | todo |
| P0-05 | Initialise Drizzle ORM; create `waitlist` table migration | S | P0-04 | todo |
| P0-06 | Design landing page wireframe (hero, three-step explainer, FAQ, footer) | S | — | todo |
| P0-07 | Build landing page UI in Next.js | M | P0-03, P0-06 | todo |
| P0-08 | Build waitlist signup form (email, optional phone, route multi-select, role) | M | P0-07 | todo |
| P0-09 | Wire up form server action; insert into `waitlist` table | S | P0-05, P0-08 | todo |
| P0-10 | Set up Resend; send signup confirmation email | S | P0-09 | todo |
| P0-11 | Add PostHog; track page view + signup events | XS | P0-07 | todo |
| P0-12 | Open-graph image + favicon + meta tags | S | P0-07 | todo |
| P0-13 | Lightweight privacy notice page | XS | P0-07 | todo |
| P0-14 | Deploy to production; verify HTTPS, signup E2E, email delivery | S | P0-09, P0-10, P0-11 | todo |

---

## Phase 1 — Foundations

| ID | Task | Size | Blocked by | Status |
|---|---|---|---|---|
| P1-01 | Set up `pnpm` workspaces (single package at MVP, structured for future split) | XS | — | todo |
| P1-02 | Configure strict TypeScript, ESLint, Prettier; pre-commit hooks via `lint-staged` | S | P1-01 | todo |
| P1-03 | Install shadcn/ui core components (Button, Input, Form, Toast, Dialog, Sheet, Select, Card, Badge, Avatar) | XS | P1-01 | todo |
| P1-04 | Drizzle schema: `User` table + migrations | S | — | todo |
| P1-05 | Drizzle schema: `Listing`, `OperatorTicket` tables + indexes + constraints | M | P1-04 | todo |
| P1-06 | Drizzle schema: `Transaction`, `GuaranteeClaim` tables | M | P1-04, P1-05 | todo |
| P1-07 | Drizzle schema: `RouteAlert`, `AuditLog` tables | S | P1-04 | todo |
| P1-08 | Drizzle schema: enums (`Listing.status`, `Transaction.status`, etc.) | XS | P1-05, P1-06 | todo |
| P1-09 | Set up Clerk; configure email + phone OTP signup; webhook for user sync to local `User` table | M | P1-04 | todo |
| P1-10 | Edge middleware: route protection map | S | P1-09 | todo |
| P1-11 | Server-side `auth()` helper + `requireSession()` utility | XS | P1-09 | todo |
| P1-12 | Sentry: client + server SDK; source maps in CI | S | P1-01 | todo |
| P1-13 | PostHog: bootstrap with Clerk user identification | XS | P1-09 | todo |
| P1-14 | Inngest: create project, integrate Next.js handler at `/api/inngest`, deploy one health-check job | M | P1-01 | todo |
| P1-15 | Resend: integrate base layer (templated emails), one test send | S | — | todo |
| P1-16 | `/dashboard` placeholder page: "Hello {name}" — proves full stack | XS | P1-09, P1-10 | todo |
| P1-17 | GitHub Actions CI: typecheck, lint, build on PR; Drizzle migration dry-run | S | P1-02 | todo |
| P1-18 | Set up four Vercel environments: dev / preview / staging / production with env vars per environment | M | P0-02 | todo |
| P1-19 | Write `docs/CONVENTIONS.md`: folder structure, server-action patterns, naming | S | — | todo |

---

## Phase 2 — Seller flow

| ID | Task | Size | Blocked by | Status |
|---|---|---|---|---|
| P2-01 | Acquire 5+ real Megabus ticket PDFs (sample inventory) | M | — | todo |
| P2-02 | Acquire 5+ real PDFs each from FlixBus, National Express, Stagecoach | L | — | todo |
| P2-03 | Build `pdf.js` server-side wrapper utility | S | P1-14 | todo |
| P2-04 | Build Megabus PDF parser (regex + heuristics) | M | P2-01, P2-03 | todo |
| P2-05 | Build parser-registry pattern (operator detection → dispatch to specific parser) | S | P2-04 | todo |
| P2-06 | Build FlixBus parser | M | P2-02, P2-05 | todo |
| P2-07 | Build National Express parser | M | P2-02, P2-05 | todo |
| P2-08 | Build Stagecoach parser | M | P2-02, P2-05 | todo |
| P2-09 | Parser confidence-scoring + ambiguous-flag for manual review | S | P2-05 | todo |
| P2-10 | Vercel Blob integration; signed-URL upload from client | M | P1-14 | todo |
| P2-11 | `/sell/new` page: drag-drop PDF upload + form fields | M | P1-03, P2-10 | todo |
| P2-12 | Server action: create `Listing` in `pending_verification`, store PDF, enqueue `verify-listing` job | S | P2-11, P1-05 | todo |
| P2-13 | Inngest job `verify-listing`: parse PDF, dup check, status transitions | M | P2-05, P2-12 | todo |
| P2-14 | Receipt-email webhook: configure Resend Inbound (or SendGrid Inbound Parse) for `receipts@lastleg.app` | M | P1-15 | todo |
| P2-15 | Receipt-email parser: extract operator, booking ref, price | M | P2-14 | todo |
| P2-16 | Match incoming receipt email to a `pending_verification` listing; transition to `live` or `failed` | S | P2-13, P2-15 | todo |
| P2-17 | `/sell` dashboard: list seller's listings with status + withdraw action | M | P2-12 | todo |
| P2-18 | Email seller at every state change (verification pending, live, sold, failed) | S | P2-13, P2-16 | todo |
| P2-19 | E2E test: seller uploads Megabus ticket → forwards receipt → listing goes live | S | P2-16, P2-18 | todo |
| P2-20 | E2E test: duplicate listing attempt is rejected | S | P2-19 | todo |

---

## Phase 3 — Buyer flow (browse + alerts)

| ID | Task | Size | Blocked by | Status |
|---|---|---|---|---|
| P3-01 | Homepage logged-in layout: search-led hero + featured live listings | M | P1-16, P2-16 | todo |
| P3-02 | `/browse` page: filterable feed (route, departure window, price) | L | P3-01 | todo |
| P3-03 | Auto-refresh live feed every 30s (server-side polling or `useSWR`) | S | P3-02 | todo |
| P3-04 | Listing detail page: full info + passenger-name disclosure component | M | P3-02 | todo |
| P3-05 | `/alerts` page: create / list / delete saved alerts | M | P1-07 | todo |
| P3-06 | Alert creation form: origin, destination, window, max price, channels | M | P3-05 | todo |
| P3-07 | Inngest job `match-alerts`: triggered on listing → `live`; fan-out matching | M | P2-13, P3-06 | todo |
| P3-08 | Email notification template for alert match | S | P1-15, P3-07 | todo |
| P3-09 | Twilio SMS integration (UK numbers only at MVP) | M | — | todo |
| P3-10 | SMS notification for alert match | S | P3-09, P3-07 | todo |
| P3-11 | Web push: Service Worker + VAPID keys + opt-in flow | M | — | todo |
| P3-12 | Web push notification for alert match | S | P3-11, P3-07 | todo |
| P3-13 | Notification throttling: max one per alert per 15 min | S | P3-07 | todo |
| P3-14 | E2E test: buyer saves alert → matching listing fires email + SMS within 60s | S | P3-08, P3-10 | todo |

---

## Phase 4 — Payments and escrow

| ID | Task | Size | Blocked by | Status |
|---|---|---|---|---|
| P4-01 | Stripe account setup + API keys configured in all environments | XS | P1-18 | todo |
| P4-02 | Stripe Connect Express integration; account creation flow from seller dashboard | L | P4-01, P2-17 | todo |
| P4-03 | Stripe Identity integration; gating logic at first payout | M | P4-02 | todo |
| P4-04 | Checkout page UI: pricing breakdown (list price + buyer fee), name-disclosure component, card form | L | P3-04 | todo |
| P4-05 | Server action: create PaymentIntent (`manual` capture); link to `Transaction` | M | P4-01, P4-04 | todo |
| P4-06 | On payment-authorisation success: mark Listing `sold`, set `OperatorTicket.sold_in_transaction_id`, create Transaction | S | P4-05 | todo |
| P4-07 | Schedule `release-ticket` Inngest job per adaptive-release rule (D014) | S | P4-06 | todo |
| P4-08 | Schedule `release-payout` Inngest job for `departure_at + 1h` | S | P4-06 | todo |
| P4-09 | Inngest `release-ticket` job: generate signed URL, send to buyer via email + SMS + push | M | P4-07, P3-09, P3-11 | todo |
| P4-10 | Inngest `release-payout` job: pre-checks (dispute, scan, Identity), capture PI, transfer to seller | L | P4-08, P4-03 | todo |
| P4-11 | Stripe webhook handler: signature verification, idempotent processing | M | P4-01 | todo |
| P4-12 | Webhook events handled: `payment_intent.succeeded`, `.payment_failed`, `transfer.created`, `.failed`, `account.updated` | M | P4-11 | todo |
| P4-13 | Inngest hourly cron `reconcile-stripe`: drift detection between Stripe and DB | M | P4-12 | todo |
| P4-14 | E2E test: full transaction in Stripe test mode — buy, ticket releases, payout fires | S | P4-09, P4-10 | todo |
| P4-15 | E2E test: adaptive release correctness for early-sale (held) and late-sale (instant) | S | P4-14 | todo |
| P4-16 | E2E test: replaying same webhook event is a no-op | S | P4-12 | todo |

---

## Phase 5 — Background-job hardening + operator scan checks

| ID | Task | Size | Blocked by | Status |
|---|---|---|---|---|
| P5-01 | Inngest `decay-price` job: every 5 min, step current_price toward floor per linear decay | M | P2-12 | todo |
| P5-02 | Visualise decay curve on listing detail page ("price drops to £X by 14:00") | S | P5-01, P3-04 | todo |
| P5-03 | Inngest `expire-listing` job: at departure time, mark unsold listings expired; refund any in-flight payments | M | P4-12 | todo |
| P5-04 | Operator-scan-API discovery sprint: investigate Megabus, FlixBus, National Express, Stagecoach | L | — | todo |
| P5-05 | Document operator scan coverage in `docs/OPERATOR_INTEGRATIONS.md` | S | P5-04 | todo |
| P5-06 | Implement scan-check integration for first-available operator | L | P5-04 | todo |
| P5-07 | Enhance `release-payout` to use scan data where available | M | P5-06, P4-10 | todo |
| P5-08 | Inngest daily cron `cleanup-orphaned-blobs`: remove Vercel Blob files for >7d-old withdrawn/rejected listings | S | P2-10 | todo |

---

## Phase 6 — Guarantee fund and disputes

| ID | Task | Size | Blocked by | Status |
|---|---|---|---|---|
| P6-01 | "Report a problem" button + entry on every Transaction view | S | P4-04 | todo |
| P6-02 | Claim sub-flow UI: reason picker, optional evidence (photo upload + text) | M | P6-01 | todo |
| P6-03 | Server action: create `GuaranteeClaim` row; enqueue `process-claim` job | S | P6-02, P1-06 | todo |
| P6-04 | Inngest `process-claim` job: counter check, auto-approve or manual-review routing | M | P6-03 | todo |
| P6-05 | Auto-approve path: cancel PI (or refund if captured), refund buyer fee from platform balance, halt `release-payout`, increment counter | M | P6-04 | todo |
| P6-06 | Manual-review path: webhook to issue tracker (Linear or similar); "under review" UI state | M | P6-04 | todo |
| P6-07 | Seller notification: payout blocked pending review; dispute opportunity | S | P6-04 | todo |
| P6-08 | Inngest `process-cancellation` job: refund buyer, halt payout, no seller penalty | M | P4-12 | todo |
| P6-09 | Admin `/admin/claims` page: list, approve, deny, attach notes; Clerk role-gated | L | P6-06 | todo |
| P6-10 | Audit log entries for every claim/payout/refund state change | S | P1-07 | todo |
| P6-11 | E2E test: denied-boarding claim → auto-refund → payout halted → audit trail correct | S | P6-05 | todo |
| P6-12 | E2E test: third claim from same buyer routes to manual review | S | P6-04 | todo |
| P6-13 | E2E test: operator cancellation refunds buyer without touching guarantee fund | S | P6-08 | todo |

---

## Phase 7 — Pre-launch hardening

| ID | Task | Size | Blocked by | Status |
|---|---|---|---|---|
| P7-01 | Draft Terms of Service (template) | M | — | todo |
| P7-02 | UK legal review of ToS | L (external) | P7-01 | todo |
| P7-03 | Draft Privacy Policy + DPA (UK GDPR / DPA 2018) | M | — | todo |
| P7-04 | Legal review of Privacy Policy + DPA | L (external) | P7-03 | todo |
| P7-05 | Draft Acceptable Use Policy (no rail Advance, no listings you don't own, no price inflation) | S | — | todo |
| P7-06 | Cookie banner (for PostHog and any other non-essential cookies) | S | — | todo |
| P7-07 | Rate limits: listing creation (10/user/day), account creation (3/IP/hour), claim filing | M | — | todo |
| P7-08 | Stripe Radar rules configured for LastLeg use case | S | P4-01 | todo |
| P7-09 | Runbook: handling a chargeback | S | — | todo |
| P7-10 | Runbook: manual claim review process | S | — | todo |
| P7-11 | Runbook: Inngest outage recovery | S | — | todo |
| P7-12 | Runbook: reversing a payout | S | — | todo |
| P7-13 | On-call setup (PagerDuty or equivalent), single rotation at launch | S | — | todo |
| P7-14 | Status page (statuspage.io or simple Vercel route) | S | — | todo |
| P7-15 | Performance pass: Core Web Vitals green on landing, browse, listing detail, checkout | M | — | todo |
| P7-16 | Image optimisation + CDN caching headers | S | P7-15 | todo |
| P7-17 | Accessibility pass: keyboard nav, screen reader, contrast on critical flows | M | — | todo |
| P7-18 | Internal security review: secrets audit, dep CVE scan, webhook signature check, file-upload safety | L | — | todo |
| P7-19 | (Optional) External security review | L (external) | P7-18 | todo |
| P7-20 | E2E test in production: full transaction with real money + real ticket | S | (everything) | todo |

---

## Phase 8 — Soft launch

| ID | Task | Size | Blocked by | Status |
|---|---|---|---|---|
| P8-01 | Segment waitlist by route preference; prepare batched invite emails | S | P0-14, P7-20 | todo |
| P8-02 | Send first invite batch (50 users) to launch corridors | XS | P8-01 | todo |
| P8-03 | Daily transaction-review dashboard (could be a Notion page initially) | M | — | todo |
| P8-04 | Reddit outreach: identify recent "selling my coach ticket" posts; DM offers to handle | M | — | todo |
| P8-05 | Student-society outreach: contact union event-organisers at launch-corridor universities | M | — | todo |
| P8-06 | Hotfix tempo: same-day deploys for user-facing issues | (ongoing) | — | todo |
| P8-07 | Weekly retro: what's working, what's not, data review | (ongoing) | — | todo |
| P8-08 | Iterate denied-boarding disclosure copy from observed denial rates | M | P8-03 | todo |
| P8-09 | Iterate price-decay curve from observed sell-through | M | P8-03 | todo |
| P8-10 | Decision-point review: open to public / iterate / expand inventory | S | (100 txn target) | todo |

---

## Cross-cutting (run in parallel through all phases)

| ID | Task | Size | Phase tie-in | Status |
|---|---|---|---|---|
| X-01 | Brand: logo, colour system | M | end of Phase 1 | todo |
| X-02 | Marketing copy: landing page, listing detail, checkout disclosure | M | end of Phase 1 → refined throughout | todo |
| X-03 | High-stakes copy: passenger-name disclosure (A/B variants for later) | M | Phase 3 / Phase 4 | todo |
| X-04 | Real-ticket acquisition pipeline (ongoing) | (ongoing) | Phases 2–5 | todo |
| X-05 | Operator relations: cold email commercial teams at all four operators | M | Phase 1+ | todo |
| X-06 | URL structure designed to support future per-route SEO pages | XS | Phase 1 | todo |

---

## Definition of done

A task is `done` when:
1. Code is merged to `main` (or for non-code tasks, the deliverable exists at its documented location)
2. CI is green
3. Any new behaviour is covered by at least one test
4. If user-facing, deployed to production (or staging if explicitly scoped pre-launch)
5. Anything new that affects architecture, decisions, or operations is reflected in the relevant doc
