# Decisions log

Every product, scope, and architecture decision made during ideation, with the context and rationale. New decisions are appended; existing decisions are amended in place with a note when they change.

Format follows lightweight ADRs (Architecture Decision Records).

---

## D001 — Product: peer-to-peer resale of unused transport tickets

**Status:** Accepted
**Date:** 2026-06-03

**Context.** Non-refundable, non-changeable transport tickets get wasted every day when the buyer's plans change. The seller eats the full loss. Other travellers at the same station/route pay walk-up prices for empty seats. There is no working market between them. Facebook groups, WhatsApp threads and Gumtree posts exist but are unverified and scam-prone.

**Decision.** Build a platform where the seller of an unused ticket can list it, and a buyer who needs it can pick it up.

**Why.** Real two-sided demand, currently served only by unsafe informal channels. Clear opportunity for trust + matching infrastructure.

---

## D002 — Inventory: coach/bus only at v1 (no rail Advance, no flight)

**Status:** Accepted
**Date:** 2026-06-03

**Context.** Different ticket types have different transferability:
- **Flights:** strict name + ID match, transfer effectively impossible. Out of scope permanently.
- **UK rail Advance tickets** (the non-refundable target inventory): National Rail Conditions of Travel Condition 28 explicitly forbids transfer. Practically, ID is rarely checked, but operating a platform that facilitates breaches of NRCoT carries cease-and-desist, regulatory (ORR), and lobbying risk. SecondSeat is a cautionary tale here.
- **Coach/bus (Megabus, FlixBus, National Express, Stagecoach):** mostly anonymous barcodes, often no ID check, some operators offer paid name-change flows. Legally far cleaner.

**Decision.** Launch with coach/bus only. Rail Advance tickets are out of scope for v1 and added later either via operator partnerships or once LastLeg has enough scale to negotiate.

**Why.** Coach is the legally cleanest wedge with real volume. Launching on shaky legal ground would invite shutdown before the model is proven. Buses are also where the price-pain (% of fare lost) is most acute for price-sensitive travellers.

---

## D003 — Geography: United Kingdom only at launch

**Status:** Accepted
**Date:** 2026-06-03

**Context.** Multi-country launch fragments operator integrations (each country has different operators, ticket formats, payment rails, regulatory regimes). UK has a concentrated coach market (4 dominant operators), single language, single currency, and known regulatory framework.

**Decision.** UK only at launch. International expansion deferred until model is proven on at least 5 corridors.

**Why.** Focus. Operator integrations are the long pole — going wide too early dilutes them.

---

## D004 — Launch routes: five UK corridors

**Status:** Accepted
**Date:** 2026-06-03

**Context.** A coach marketplace with national coverage but no per-corridor liquidity is dead. Buyers won't return after one empty search.

**Decision.** Launch on five corridors only:
1. London ↔ Manchester
2. London ↔ Birmingham
3. London ↔ Leeds
4. London ↔ Edinburgh
5. One additional, TBD (likely London ↔ Bristol or London ↔ Liverpool based on coach volumes)

Saturate these before adding more.

**Why.** Liquidity beats coverage. Five high-volume corridors give meaningful inventory density. Buyers find what they need; sellers see their listings move; flywheel starts.

---

## D005 — Resale model: capped at original price or lower

**Status:** Accepted
**Date:** 2026-06-03

**Context.** Two viable models — free giveaway vs paid resale. Free is faster to trust and viral but kills supply (sellers eat the loss). Uncapped resale invites scalping, which has been the political and regulatory undoing of event-ticket resale platforms (StubHub, Viagogo).

**Decision.** Paid resale with a hard cap at the seller's original purchase price. Seller chooses the listing price within that ceiling.

**Why.** The "recoup something" motive is what makes a seller bother uploading at 30 minutes to departure. The cap defuses the scalping narrative entirely — LastLeg is consumer-side anti-waste, not a secondary-market markup.

---

## D006 — Auto-discount: step down to seller-set floor as departure approaches

**Status:** Accepted
**Date:** 2026-06-03

**Context.** Most listings appear within 1–4 hours of departure. Many will not sell at the initial price. Static pricing wastes inventory; pure tip-jar feels arbitrary; per-seller custom decay curves are too much friction.

**Decision.** Seller picks an initial price and a minimum acceptable floor at listing time. Platform automatically steps the price down as departure approaches.

**Why.** Sellers set intent ("I'll take anything down to £5") once. Platform handles the optimisation. Maximises sell-through without asking sellers to think about pricing dynamics they don't want to manage.

---

## D007 — Fees: free for sellers, buyer pays £1 + 8% capped at £4

**Status:** Accepted
**Date:** 2026-06-03

**Context.** Sellers are already losing money on their unused ticket — taxing them further reduces supply and feels punitive. Buyers are getting a clear discount on walk-up price, so a modest service fee is acceptable. Need to cover Stripe processing (~£0.20 + 1.5%), guarantee fund payouts, and platform margin.

**Decision.** Sellers pay nothing. Buyers pay £1 flat + 8% of the resale price, capped at £4 per transaction.

**Why.** Maximises seller-side supply (the constrained side at launch). Buyer fee remains small in absolute terms (a £15 ticket sold for £8 still completes for ~£8.70). Cap prevents the fee feeling extortionate on higher-value tickets.

---

## D008 — Trust posture: marketplace + small guarantee fund

**Status:** Accepted
**Date:** 2026-06-03

**Context.** Three options: pure marketplace (disputes are between users), full guarantor (platform refunds any failed transaction), or hybrid (marketplace with a backstop fund for the small fraction of bad outcomes).

**Decision.** Marketplace-with-guarantee-fund hybrid. Default position is buyer-and-seller settle; LastLeg's guarantee fund pays out for documented failure modes (denied boarding, operator cancellation, seller misconduct).

**Why.** Pure marketplace makes buyer trust impossible at launch. Full guarantor exposes LastLeg to unbounded fraud loss. Hybrid threads the needle: most transactions cost the fund nothing; the fund's existence is what makes buyers trust the platform on day one.

---

## D009 — Guarantee policy: flat refund with 2-claim lifetime cap per buyer

**Status:** Accepted (default — open to revision once we have fraud data)
**Date:** 2026-06-03

**Context.** Flat ("if it fails, you get refunded, no questions asked") is best UX but most abusable. Claim-based is fraud-resistant but creates a hostile UX at the worst possible moment (the buyer has just missed their coach).

**Decision.** Flat-refund policy by default. Each buyer account is allowed up to 2 lifetime claims before further claims trigger manual review. Refund covers ticket price + service fee.

**Why.** Optimises for trust during cold start. The 2-claim cap limits Sybil-attack exposure (a fraud ring would need to keep creating verified phone accounts to scale). Threshold can be raised or lowered later from observed data.

---

## D010 — Discovery: both push alerts AND a browseable live feed

**Status:** Accepted
**Date:** 2026-06-03

**Context.** Two buyer archetypes: (i) the planner who wants alerts on a route, (ii) the spontaneous standby buyer at the station who wants to see everything available right now. Either alone misses half the market.

**Decision.** Ship both. Saved route alerts trigger email/SMS/push notifications when a match appears. Browseable feed shows all currently-live listings filterable by route and departure window.

**Why.** Each model unblocks a distinct use case. Both are cheap to build relative to their incremental value.

---

## D011 — Verification: PDF parse + forwarded receipt + duplicate detection + post-departure scan check

**Status:** Accepted
**Date:** 2026-06-03

**Context.** A ticket marketplace without verification is a scam marketplace. Four layers of verification, each catching different fraud modes:
1. Ticket authenticity (is this a real, unused ticket?)
2. Original price proof (is the cap being respected?)
3. Non-duplication (is this ticket also listed elsewhere or sold twice?)
4. Post-departure confirmation (was the ticket actually used by the buyer?)

**Decision.**
1. Server-side PDF parsing extracts operator, booking reference, route, time, price, name (if present).
2. Sellers forward the original booking confirmation email to `receipts@lastleg.app` for price verification.
3. Booking references are stored and checked against the full history to prevent duplicate listings.
4. Where the operator exposes a PNR/scan API, LastLeg confirms the ticket was scanned at boarding before releasing payout.

**Why.** Defence in depth. Any single layer can be defeated; all four together raise the cost of fraud well above the value of any single transaction.

---

## D012 — Escrow: buyer pays at purchase, seller paid ~1 hour after scheduled departure

**Status:** Accepted
**Date:** 2026-06-03

**Context.** If sellers are paid immediately, a malicious seller can sell a ticket, use it themselves anyway, and the buyer is stranded with no recourse. If sellers are paid days later, they may distrust the platform and not list.

**Decision.** Buyer's card is charged at purchase. Funds are held in escrow (Stripe `payment_intent` with manual capture or held as platform balance). Payout to seller is released approximately one hour after scheduled departure, conditional on no buyer-reported issue and (where available) operator scan confirmation.

**Why.** Aligns incentives. Seller still gets paid same-day, but only after the trip has happened — closing the window for seller-side misuse.

---

## D013 — Seller payout: Stripe Connect direct-to-bank, onboarding deferred to first listing

**Status:** Accepted
**Date:** 2026-06-03

**Context.** Options were direct-to-bank (Stripe Connect), in-app wallet (faster but holds user funds, FCA implications), or hybrid.

**Decision.** Stripe Connect Express direct-to-bank for v1. Wallet model deferred to v2 if usage patterns justify it. KYC happens via Stripe.

Critically: Stripe Connect onboarding is **not** required at signup. It is required at the point the seller lists their first ticket (or earlier, before first payout). This preserves a low-friction signup.

**Why.** Stripe Connect shifts regulatory weight off LastLeg (no money-transmitter licensing, no FCA safeguarding under PSRs 2017 at v1 scale). Wallet model is a v2 optimisation when there's evidence of repeat sellers.

---

## D014 — Ticket delivery: adaptive release based on time-to-departure

**Status:** Accepted
**Date:** 2026-06-03

**Context.** Releasing the ticket file instantly on payment maximises UX but gives a malicious seller the longest possible window to misuse (relist on Facebook, claim an operator refund, board with the original). Releasing at T-15min closes that window but breaks the standby-buyer use case (someone at the station with 10 minutes to spare).

**Decision.** Adaptive release:
- If the sale completes more than 1 hour before departure → ticket file is held; released to buyer at T-30 minutes
- If the sale completes within 1 hour of departure → ticket file is released immediately on payment

UI surfaces a clear countdown to buyers in the "held" state ("Your ticket will be revealed at 14:30 — 30 min before departure").

**Why.** Threads the needle: 80%+ of fraud window closed for the common early-sale case; standby UX preserved for the high-value last-minute case.

---

## D015 — Identity: buyers anonymous, sellers verified via Stripe Identity at first payout

**Status:** Accepted
**Date:** 2026-06-03

**Context.** Fraud risk is asymmetric — buyers risk losing the price of a ticket; sellers can run multi-account scams of much larger value. Requiring ID for everyone tanks signup conversion 40–60%. Requiring it for no one means a banned fraudster can re-onboard in 90 seconds.

**Decision.** Buyers sign up with email + verified phone number, use a chosen handle. Sellers go through Stripe Identity (passport / driving licence + selfie) as part of Stripe Connect onboarding. Stripe Identity is **gated at first payout**, not first listing — sellers can list and sell immediately; verification happens before any money moves out of LastLeg.

**Why.** Friction is placed where the risk is. A banned seller cannot trivially re-onboard (same ID = blocked). The Stripe Identity step adds ~£1.20 cost and ~30 seconds; the resulting drop in fraud rate makes the guarantee fund materially cheaper, which materially lowers the buyer service fee.

---

## D016 — Named tickets: accept, disclose at checkout, full refund if denied boarding

**Status:** Accepted
**Date:** 2026-06-03

**Context.** Some coach tickets have the original purchaser's name printed. Drivers check ID infrequently but not never. Three policies considered: ignore (accept any ticket without warning), coach the buyer to impersonate (legally toxic), reject all named tickets (cuts inventory 50–70%), disclose at checkout.

**Decision.** Accept named tickets. At buyer checkout, surface explicitly: *"This ticket is in the name of [Seller First Name + Initial]. Drivers occasionally check ID on this route. If you are denied boarding, the LastLeg guarantee fund refunds you in full."* Buyer accepts the risk knowingly.

**Why.** Maximises inventory (the alternative — rejecting all named tickets — kills supply). Treats users as adults. Legally defensible (informed consent, no instruction to deceive). Per-route denied-boarding rates will be refined from real outcomes within ~6 months of launch.

---

## D017 — Platform: web app only at v1

**Status:** Accepted
**Date:** 2026-06-03

**Context.** Native apps add app-store gatekeeping, longer release cycles, and a second codebase. Web ships immediately, updates instantly, and is universally accessible. The downside is push notifications — web push is significantly weaker than native (iOS Safari especially).

**Decision.** Web app only for v1. Native (or aggressive PWA install prompts) deferred to v2.

**Why.** Faster to ship, cheaper to iterate, no platform risk. Mitigate the push gap with email + SMS for high-priority alerts (route matches, ticket-revealed notifications, denied-boarding refund confirmation). SMS via Twilio is worth ~£0.04 per message at the moments that matter.

---

## D018 — Cold-start strategy: student-society wedge + Reddit-seeded supply

**Status:** Accepted (high-level — execution plan in IMPLEMENTATION_PLAN.md)
**Date:** 2026-06-03

**Context.** Two-sided marketplace cold start is the actual hard problem. Three options: route-density saturation (posters at stations), student-society partnership (concentrated demand spikes at term-end), or Reddit/social seeding (shepherd existing organic posts).

**Decision.** Run student-society wedge + Reddit-seeded supply in parallel. Posters and broader marketing deferred until liquidity is proven on a corridor.

**Why.** Students provide concentrated, predictable demand spikes (term-end weeks) — perfect testing ground for the matching engine. Reddit (r/uktrains, r/UKPersonalFinance, r/london) has steady weekly organic supply — direct outreach converts those posts into platform transactions and builds the seller base.

---

## D019 — Tech stack: Next.js 15 + Vercel + Neon Postgres + Clerk + Stripe + Inngest

**Status:** Accepted
**Date:** 2026-06-03

**Context.** Need a stack that ships fast at MVP and scales to real volume. Optimising for: TypeScript end-to-end, minimal vendor count without single-vendor lock-in, mature billing/auth/identity primitives.

**Decision.**
- **Framework:** Next.js 15 (App Router) + TypeScript
- **Hosting:** Vercel
- **Database:** Neon Postgres (serverless, branching)
- **Auth:** Clerk (email + phone OTP)
- **Payments:** Stripe (Connect Express + Identity + Payments + Webhooks)
- **Email:** Resend
- **SMS:** Twilio
- **Object storage:** Vercel Blob (uploaded ticket PDFs)
- **PDF parsing:** `pdf.js` server-side + per-operator regex parsers
- **UI:** Tailwind CSS + shadcn/ui
- **Forms/validation:** react-hook-form + Zod
- **Background jobs:** Inngest (time-based escrow release, adaptive ticket delivery, route-match alerts, post-departure scan checks)
- **Observability:** Sentry (errors) + PostHog (product analytics)

**Why.** Each pick is boring-correct for its category. The non-obvious one is Inngest — the product has many time-anchored jobs (T-30min release, T+1hr payout, listing TTL, alert dispatch) and a real scheduler is much cheaper to adopt at MVP than to retrofit.

---

## D020 — Build order: landing page this week + real MVP in parallel over 4–6 weeks

**Status:** Accepted
**Date:** 2026-06-03

**Context.** Three credible starting points: landing page + waitlist (validate + seed audience), clickable prototype (feel the UX with fake data), real narrow-slice MVP (do live transactions). Marketplace prototypes with fake data don't teach the things that matter (liquidity, trust, fraud).

**Decision.** Skip the clickable prototype entirely. Ship a landing page this week (Phase 0). Build the real MVP in parallel over the following 4–6 weeks (Phases 1–8). The landing page does double duty as marketing AND audience-building while the real product is built.

**Why.** Empty marketplaces die. Capturing waitlist signups with route preferences starts populating the cold-start hopper before launch, so day-1 has live demand. Skipping the prototype avoids learning the wrong things from fake data.

---

## Out-of-scope decisions (explicitly deferred)

The following were discussed during ideation and explicitly pushed to post-MVP:

- **Rail Advance ticket inventory** — pending operator partnerships or platform scale to negotiate
- **International expansion** — pending UK model proof on 5 corridors
- **Native mobile app** — pending evidence that web push + email + SMS is insufficient
- **In-app wallet for sellers** — pending evidence of repeat-seller behaviour
- **Premium features / sponsored routes / operator partnerships as monetisation** — pending core fee model proof
- **Group tickets, open/flexible tickets, railcard-discounted tickets** — pending parser maturity and clearer risk-handling policy
