# Architecture

System design for LastLeg MVP. Derives from decisions in [`DECISIONS.md`](DECISIONS.md).

---

## 1. High-level architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Web client                              │
│              Next.js 15 App Router · React Server              │
│              Components · Tailwind · shadcn/ui                  │
└────────────────────────┬────────────────────────────────────────┘
                         │  HTTPS
┌────────────────────────▼────────────────────────────────────────┐
│                      Next.js server                             │
│   App Router routes · Server Actions · Route Handlers · Edge    │
│   middleware (auth gate via Clerk)                              │
└──┬──────────┬──────────┬──────────┬──────────┬──────────┬──────┘
   │          │          │          │          │          │
   ▼          ▼          ▼          ▼          ▼          ▼
┌──────┐  ┌─────┐  ┌────────┐  ┌──────┐  ┌──────┐  ┌────────┐
│Neon  │  │Clerk│  │Stripe  │  │Resend│  │Twilio│  │Inngest │
│Postgres│ │Auth │  │Payments│  │Email │  │ SMS  │  │Jobs    │
│      │  │+OTP │  │Connect │  │      │  │      │  │        │
│      │  │     │  │Identity│  │      │  │      │  │        │
└──────┘  └─────┘  └────────┘  └──────┘  └──────┘  └────────┘
                         │                              │
                         ▼                              ▼
                  ┌────────────┐                ┌──────────────┐
                  │ Stripe     │                │ Vercel Blob  │
                  │ Webhooks → │                │ ticket PDFs  │
                  │ Next.js    │                │              │
                  └────────────┘                └──────────────┘

                    Observability layer
              ┌─────────────┬────────────────┐
              │   Sentry    │    PostHog     │
              │  (errors)   │  (analytics)   │
              └─────────────┴────────────────┘
```

---

## 2. Data model

Postgres, accessed via Drizzle ORM (TypeScript-native, generates types from schema, low-magic). All IDs are ULIDs (sortable, URL-safe).

### Core entities

```
User                       Listing                    Transaction
─────                      ───────                    ───────────
id (PK)                    id (PK)                    id (PK)
clerk_user_id              seller_id (FK User)        listing_id (FK Listing)
email                      operator (enum)            buyer_id (FK User)
phone                      route_origin               seller_id (FK User)
handle                     route_destination          status (enum)
role (buyer|seller|both)   departure_at               price_pence
stripe_connect_id          original_price_pence       buyer_fee_pence
stripe_identity_verified   list_price_pence           seller_payout_pence
guarantee_claims_used      floor_price_pence          stripe_payment_intent
banned_at                  current_price_pence        escrow_release_at
created_at                 has_passenger_name         ticket_revealed_at
                           passenger_name_first       ticket_released_at
                           ticket_pdf_blob_url        scan_confirmed_at
                           booking_reference          payout_released_at
                           operator_pnr               dispute_status
                           receipt_email_hash         created_at
                           verification_status
                           status (enum)              GuaranteeClaim
                           created_at                 ──────────────
                           expires_at                 id (PK)
                                                      transaction_id (FK)
RouteAlert                 OperatorTicket             reason (enum)
──────────                 ──────────────             evidence_text
id (PK)                    id (PK)                    evidence_blob_url
user_id (FK User)          booking_reference          status (enum)
route_origin               operator                   resolved_by
route_destination          first_seen_listing_id      refund_amount_pence
max_price_pence            sold_in_transaction_id     created_at
window_start               status (live|sold|expired) resolved_at
window_end                 (Uniqueness invariant      
notify_email               on booking_reference +     AuditLog
notify_sms                 operator — prevents        ────────
created_at                 dup listings)              id (PK)
last_match_at                                         actor_user_id
                                                      action
                                                      entity_type
                                                      entity_id
                                                      payload_jsonb
                                                      created_at
```

### Key invariants

- A given `(operator, booking_reference)` pair can have at most one **live** `Listing` at a time, and at most one historically-completed `Transaction`. Duplicate-listing fraud is blocked at the DB layer.
- `Listing.list_price_pence ≤ Listing.original_price_pence` (enforced at app + DB constraint).
- `Listing.floor_price_pence ≤ Listing.list_price_pence`.
- A `Transaction` cannot be created against an expired or already-sold `Listing` (transactional, with `SELECT FOR UPDATE`).
- `Transaction.escrow_release_at = Listing.departure_at + 1 hour` at creation time.
- `Transaction.ticket_released_at` is non-null only after: (a) the buyer paid AND (b) `now() >= max(payment_time, departure_at - 30min)` for early sales, or AND (b) immediately for late sales.

### Status enums

- `Listing.status`: `draft | pending_verification | live | sold | expired | withdrawn | rejected`
- `Listing.verification_status`: `pending | pdf_parsed | receipt_matched | failed`
- `Transaction.status`: `pending_payment | paid | ticket_revealed | completed | refunded | disputed`
- `Transaction.dispute_status`: `none | open | resolved_buyer | resolved_seller`
- `GuaranteeClaim.reason`: `denied_boarding_name_check | denied_boarding_already_scanned | operator_cancellation | ticket_invalid | seller_misconduct | other`

---

## 3. Key flows

### 3.1 Seller lists a ticket

1. Seller authenticated via Clerk (must have verified phone).
2. Seller submits: PDF upload, original purchase price, listing price, floor price, optional notes. (No seller-entered route/operator — extracted from PDF.)
3. Backend stores PDF in Vercel Blob; creates `Listing` row with status `pending_verification`.
4. Inngest job `verify-listing` triggered:
   a. Server-side PDF parser extracts: operator, booking ref, route, departure, price, passenger name.
   b. Database checks: is `(operator, booking_reference)` already used? If yes → reject.
   c. Seller is prompted (in-app + email) to forward their original booking confirmation email to `receipts@lastleg.app`.
   d. Inbound email is parsed; price is matched against listing. Match → verification passes; mismatch or no forward within 30 min → status `failed`, seller notified.
5. On verification pass: status → `live`. Indexed for the feed. Route-alert matching job dispatched.
6. If seller has not yet completed Stripe Connect onboarding, they are prompted now (but listing can go live before — onboarding is only blocking for payout, not listing).

### 3.2 Buyer purchases a ticket

1. Buyer authenticated via Clerk (verified phone). May be brand new — no Stripe required for buyers.
2. Buyer hits "Buy" on a `live` listing. Checkout screen surfaces:
   - Final price (list price + buyer fee, broken down)
   - **If passenger name present on ticket:** disclosure copy per D016, requires explicit checkbox acknowledgment.
   - Estimated ticket release time (immediate if `departure - now() < 60min`, otherwise countdown to `departure - 30min`)
3. Stripe `PaymentIntent` created with `capture_method = manual` and metadata linking to the transaction. Buyer's card is authorised; funds are not yet captured.
4. On successful payment authorisation: `Transaction` row created with status `paid`. `Listing` status → `sold`. `OperatorTicket.sold_in_transaction_id` set.
5. Inngest job `release-ticket` scheduled for `max(now(), departure_at - 30min)`. If `now()` >= that time, runs immediately.
6. Inngest job `release-payout` scheduled for `departure_at + 1 hour`.
7. Confirmation email + (optional) SMS sent to buyer with countdown link.

### 3.3 Ticket release to buyer (adaptive)

1. `release-ticket` job fires at scheduled time.
2. Pre-check: dispute open? → halt. Listing withdrawn / refunded? → halt.
3. Generate a one-time signed URL to the PDF in Vercel Blob (expires 24h after departure).
4. Email + SMS + in-app push to buyer: "Your ticket is ready" with the signed URL and a save-to-wallet prompt.
5. Update `Transaction.ticket_released_at = now()`. Mark in audit log.

### 3.4 Payout release to seller

1. `release-payout` job fires at `departure_at + 1 hour`.
2. Pre-checks:
   a. Dispute open? → halt; resolution flow handles payout.
   b. Operator scan API available for this operator and route? → check whether ticket was scanned. If scanned by anyone → continue. If not scanned and buyer claims they couldn't board → halt; route to guarantee claim flow.
   c. Seller passed Stripe Identity? If no → halt; notify seller they must complete verification before payout.
3. Capture the Stripe PaymentIntent (now buyer's card is charged for real).
4. Trigger Stripe transfer to seller's connected account: `Transaction.seller_payout_pence`.
5. LastLeg retains buyer fee + (price - payout) margin.
6. Update `Transaction.payout_released_at`, status → `completed`. Audit log.

### 3.5 Denied-boarding refund (D016 / D009)

1. Buyer hits "Report a problem" within the in-app transaction view, picks "Denied boarding."
2. Sub-reason picker: name check failed | ticket already scanned | other.
3. Optional photo evidence upload (driver-issued receipt, video timestamp).
4. Inngest job `process-claim`:
   a. Lookup buyer's `guarantee_claims_used`. If `>= 2` → route to manual review queue (Linear webhook). Buyer sees "Under review, decision in 48h."
   b. If `< 2` → auto-approve. Cancel the PaymentIntent if not yet captured (no money changes hands). Refund buyer fee from platform balance. Halt the `release-payout` job. Increment `guarantee_claims_used`. Notify seller (their payout is blocked pending review).
5. Seller may dispute the claim; second-tier manual review.

### 3.6 Operator cancellation

1. Detected via: seller reports it, buyer reports it, or (future) operator API webhook.
2. Inngest job `process-cancellation`:
   a. Cancel uncaptured PaymentIntent → buyer is refunded automatically, no fund needed.
   b. Halt `release-payout`.
   c. Update statuses.
3. Seller's operator-side refund (if their fare allows) is between seller and operator — not LastLeg's concern.
4. If PaymentIntent already captured (rare — would mean cancellation happened after `departure + 1h`): refund from platform balance, debit seller via Stripe Connect reverse transfer.

### 3.7 Route-alert match

1. New listing reaches `live` status → Inngest fan-out job `match-alerts`.
2. Query `RouteAlert` for matching `route_origin`, `route_destination`, departure window, max price.
3. For each match: dispatch notification per the alert's preferences (email via Resend, SMS via Twilio, web push via Service Worker).
4. Update `RouteAlert.last_match_at`. Throttle: maximum one notification per alert per 15 minutes (to avoid spam from price-decay re-matches).

---

## 4. External integrations

| Service | Purpose | Critical-path? | Failure mode |
|---|---|---|---|
| Clerk | Auth (email + phone OTP) | Yes (signin) | Auth down → users can't sign in. Cached sessions still work for ~hours. |
| Stripe Payments | Card capture, escrow | Yes (checkout) | Checkout down → no new transactions. Existing escrow unaffected. |
| Stripe Connect | Seller onboarding + payout | Yes (payout) | Payouts queue; LastLeg holds funds longer. |
| Stripe Identity | Seller KYC | Yes (first payout) | First payouts delayed until restored. |
| Resend | Transactional email | Soft (alerts) | Queue for retry; SMS still fires for high-priority. |
| Twilio | SMS for high-priority alerts | Soft | Email fallback; UK delivery may take seconds longer. |
| Vercel Blob | Ticket PDF storage | Yes (PDF) | Listings cannot be created or released. |
| Inngest | Background jobs | Yes (escrow/release) | All time-sensitive logic stops. Critical dependency. |
| pdf.js | Server-side PDF parsing | Yes (verification) | Manual review queue picks up. |
| Sentry | Error capture | No | Errors logged to Vercel only; investigation slower. |
| PostHog | Analytics | No | No business impact. |
| Operator scan APIs | Post-departure ticket scan confirmation | No (best-effort) | Falls back to honour-system + dispute-based handling. |

---

## 5. Background jobs catalogue

All jobs run on Inngest. Idempotent by design (jobs check current state before acting).

| Job | Trigger | What it does |
|---|---|---|
| `verify-listing` | Listing created | PDF parse, dup check, receipt-email wait, status transition |
| `match-alerts` | Listing reaches `live` | Fan-out notifications to matching `RouteAlert` rows |
| `decay-price` | Cron every 5 min OR listing event | Steps `current_price_pence` toward `floor_price_pence` per the decay schedule |
| `expire-listing` | Listing departure time | Marks unsold listings as `expired` |
| `release-ticket` | Scheduled per Transaction | Releases signed PDF URL to buyer per adaptive-release rule |
| `release-payout` | Scheduled per Transaction | Captures PaymentIntent, triggers Stripe transfer to seller |
| `process-claim` | Buyer files claim | Auto-approves or routes to manual review per guarantee policy |
| `process-cancellation` | Cancellation reported | Refunds buyer, halts payout |
| `reconcile-stripe` | Cron hourly | Reconciles Stripe webhooks against DB state, surfaces drift |
| `cleanup-orphaned-blobs` | Cron daily | Removes Vercel Blob files for listings withdrawn/rejected >7 days ago |

---

## 6. Security considerations

### Authentication / Authorization
- All authenticated routes gated by Clerk middleware at the Edge.
- Server-side actions re-verify session and user ownership of any resource being modified (defence in depth).
- Admin actions (manual claim review, refunds) gated by a separate Clerk role + audit logged.

### Payment security
- LastLeg never sees raw card data — Stripe Elements / Checkout handles input.
- All Stripe webhook handlers verify signatures.
- All money movements (capture, refund, transfer) are logged to `AuditLog` with the originating Stripe event ID.

### PDF / file uploads
- Vercel Blob URLs for ticket PDFs are short-TTL signed URLs only — never directly accessible.
- Uploaded PDFs are scanned for malformed structures before parsing (defence against parser exploits).
- Maximum file size: 5 MB per ticket (well above any real coach ticket).

### Personal data (UK GDPR)
- Personal data stored: email, phone, handle, Stripe identity reference, ticket-derived names.
- Data minimisation: passenger name from a ticket is stored only as `first_name + initial` (e.g. "Sarah K."), never full name. Full name lives only in the Stripe Identity record.
- Right to deletion: implemented as soft-delete on `User`; transactional records preserved with PII redacted.
- DPA + privacy policy at launch (Phase 7).

### Fraud / abuse
- Rate limits on listing creation (10 per user per day) and account creation (3 per IP per hour).
- Device fingerprinting (via Stripe Radar) on payment attempts.
- Pattern detection: same IP/device buying from + selling to same account → flagged for review.
- Stripe Connect reverse-transfer for seller misconduct payouts.

### Audit log
- Every state-changing action writes an entry. Append-only; never modified or deleted.
- Used for dispute resolution, regulator inquiries, internal investigation.

---

## 7. Environments and deployment

| Environment | Branch | DB | Stripe | Domain |
|---|---|---|---|---|
| Local dev | any | Neon dev branch | Stripe test | `localhost:3000` |
| Preview | PR branches | Neon preview branches (auto) | Stripe test | `*.lastleg.vercel.app` |
| Staging | `staging` | dedicated Neon DB | Stripe test | `staging.lastleg.app` |
| Production | `main` | production Neon DB | Stripe live | `lastleg.app` |

Migrations run on deploy via Drizzle. Stripe webhook secrets per environment. Inngest separate apps per environment.

---

## 8. Non-goals (explicitly)

- **Real-time chat between buyer and seller.** Out of scope — all interaction is mediated by the platform's structured flows. Avoids harassment/coercion surfaces and dispute complexity.
- **Multi-leg / itinerary planning.** Out of scope — LastLeg lists single-leg coach tickets only. No combining tickets into journeys.
- **In-app messaging, social features, ratings beyond a simple thumbs.** Out of scope at MVP.
- **Mobile app.** Web only (D017).
- **International ticket support.** UK only (D003).

---

## 9. Open architecture questions (post-MVP)

- **Operator scan APIs:** which operators expose them in a usable form? Need a discovery sprint in Phase 5 to map coverage.
- **Real-time inventory deduplication across platforms:** can we detect a ticket also listed on Facebook? Probably not at MVP — accept the risk.
- **PWA install prompts:** before considering native, exhaust PWA / web push capability. Worth a Phase 8.x experiment.
- **Multi-region:** Vercel is global; Neon is regional. UK-only launch → Neon `eu-west` is fine. Revisit if expanding.
