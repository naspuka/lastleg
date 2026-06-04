# Landing page wireframe

Phase 0 deliverable. Single page at `lastleg.app` whose only job is to (a) explain LastLeg in 10 seconds, (b) capture a waitlist signup with route + role intent. No product UI, no auth beyond email capture.

References: [`DECISIONS.md`](DECISIONS.md), [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md#phase-0--landing-page--waitlist), [`TASKS.md`](TASKS.md) P0-06 / P0-07 / P0-08.

---

## Section order

1. Nav (minimal)
2. Hero
3. Three-step explainer
4. Waitlist form
5. Trust strip (guarantee + cap + escrow)
6. FAQ
7. Footer

---

## 1. Nav

- Left: `LastLeg` wordmark (logo TBD per X-01)
- Right: anchor link `Join the waitlist` → scrolls to form

No login. No nav menu. We have nothing to navigate to yet.

---

## 2. Hero

```
┌──────────────────────────────────────────────────┐
│                                                  │
│  Don't waste your unused coach ticket.           │
│                                                  │
│  LastLeg is a marketplace for last-minute UK     │
│  coach tickets you can't use. Sellers recoup     │
│  something. Buyers get a discount. No scalping.  │
│                                                  │
│  [ Join the waitlist ]  ← primary CTA            │
│                                                  │
│  Launching on 5 UK corridors this summer.        │
│                                                  │
└──────────────────────────────────────────────────┘
```

Tone: plain, direct, no marketing hype. Headline reads as a statement of intent, not a slogan.

Mobile: same content, single column, hero text scaled down. CTA stays full-width.

---

## 3. Three-step explainer

Three equal columns on desktop, stacked on mobile. Numbered, with a short verb-led heading and one supporting line.

```
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│ 1. List       │  │ 2. Match      │  │ 3. Travel     │
│               │  │               │  │               │
│ Upload your   │  │ A buyer on    │  │ Buyer gets    │
│ unused ticket │  │ the same      │  │ the ticket    │
│ in under 60   │  │ route picks   │  │ before the    │
│ seconds.      │  │ it up at a    │  │ coach goes.   │
│               │  │ discount.     │  │ You're paid   │
│ Price capped  │  │ Held in       │  │ after the     │
│ at what you   │  │ escrow until  │  │ trip's done.  │
│ paid.         │  │ departure.    │  │               │
└───────────────┘  └───────────────┘  └───────────────┘
```

Why this order: matches the actual user mental model (list → match → travel), not the product flow. Each step gestures at a key decision baked in (cap, escrow, post-trip payout) without making the user read the FAQ.

---

## 4. Waitlist form

Sits below the explainer. Centred, max-width ~480px on desktop. shadcn `Card` container.

```
┌──────────────────────────────────────────────────┐
│  Join the waitlist                               │
│                                                  │
│  We're launching on 5 routes this summer.        │
│  Tell us which ones matter to you and we'll      │
│  invite you early.                               │
│                                                  │
│  Email *                                         │
│  [_______________________________]               │
│                                                  │
│  Phone (optional — for SMS alerts)               │
│  [+44_________________________]                  │
│                                                  │
│  I'm interested in… *                            │
│  ( ) Buying tickets                              │
│  ( ) Selling tickets                             │
│  ( ) Both                                        │
│                                                  │
│  Routes I'd use *                                │
│  [✓] London ↔ Manchester                         │
│  [ ] London ↔ Birmingham                         │
│  [ ] London ↔ Leeds                              │
│  [ ] London ↔ Edinburgh                          │
│  [ ] London ↔ Bristol  (or Liverpool, TBD)       │
│                                                  │
│  [        Join the waitlist        ]             │
│                                                  │
│  By joining you agree to our [privacy notice].   │
└──────────────────────────────────────────────────┘
```

Field rules
- **Email** — required, validated client-side, deduped server-side on submit (case-insensitive lower-cased before insert).
- **Phone** — optional. UK only at MVP (per D003 + D017 SMS via Twilio). Format: E.164. Show inline hint "we'll only text you about route matches you opted in for."
- **Role** — required, single select. Saved as enum `buyer | seller | both`.
- **Routes** — required, multi-select, at least one. Persist as array of route slugs (`lon-man`, `lon-bir`, `lon-lee`, `lon-edi`, `lon-bri`). The 5th corridor is provisionally `lon-bri`; flag in form as TBD so we can swap it without breaking schema.

Submit behaviour (Phase 0)
- Server action inserts into `waitlist` table.
- Triggers Resend confirmation email (P0-10).
- PostHog event `waitlist_signup` with `{ role, routes_count }` (no PII in event props beyond what's required).
- On success: replace form with inline confirmation — "You're in. Check your email."
- On duplicate email: treat as success (don't reveal whether email was already signed up) but still re-send the confirmation.

---

## 5. Trust strip

A single horizontal row of three short claims, icon + line each. Sits between form and FAQ. Pure reassurance — these are the answers to objections we expect.

```
┌────────────────┬────────────────┬────────────────┐
│ 🔒 Escrow      │ 🚫 No scalping │ 🛟 Guarantee   │
│                │                │                │
│ Sellers paid   │ Sellers can't  │ Denied         │
│ after the trip │ list above the │ boarding?      │
│                │ price they     │ Full refund    │
│                │ paid           │ from us        │
└────────────────┴────────────────┴────────────────┘
```

(Emoji placeholders — real iconography per X-01 brand work.)

---

## 6. FAQ

Accordion (shadcn `Accordion`). 6 items, all collapsed by default. Order = expected concern frequency, most common first.

1. **Is this legal?** Coach tickets from National Express, Megabus, FlixBus and Stagecoach are generally transferable. Rail Advance tickets aren't, so we don't accept them. (Per D002.)
2. **What if the driver checks the name on the ticket?** Most don't, but if you're denied boarding our guarantee fund refunds you in full. We tell you at checkout when a ticket is in someone else's name. (Per D016.)
3. **How does the price work?** The seller chooses a price, capped at what they originally paid. As departure approaches, the price automatically steps down toward a floor the seller sets. (Per D005, D006.)
4. **When does the seller get paid?** About an hour after the coach departs, once we know the buyer wasn't turned away. (Per D012.)
5. **What does it cost?** Free for sellers. Buyers pay £1 + 8%, capped at £4. (Per D007.)
6. **Which routes are you launching with?** London ↔ Manchester, Birmingham, Leeds, Edinburgh, and one more TBD. We'll expand from there. (Per D004.)

Copy direction
- Each answer ≤ 40 words.
- Plain language. No "rest assured" / "industry-leading" / "seamless."
- Where useful, link the underlying decision page (post-launch we'll publish a `/why` page; for now the FAQ is the source).

---

## 7. Footer

Single line, centred, small text.

```
LastLeg · UK only · [privacy] · contact@lastleg.app · © 2026
```

Privacy link → `/privacy` (P0-13, lightweight; full DPA in P7-03).

---

## Visual style (placeholder until X-01)

- Single neutral background (light grey / off-white)
- One accent colour (TBD — likely a deep green or muted orange; brand work pending)
- Typography: one sans-serif family, two weights, 16px body baseline
- Generous vertical rhythm; the page should feel calm, not crowded
- No stock photography; if we add imagery later, illustrations only

---

## Tech notes (for P0-07 implementation)

- Single route `app/page.tsx` — no client-side routing yet
- All sections are server components except the form (client component with `useFormState` for the server action)
- shadcn components used: `Button`, `Input`, `Label`, `Card`, `Checkbox`, `RadioGroup`, `Accordion`, `Toast` (for inline error states)
- Lighthouse target: Performance ≥ 95, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 100 on mobile emulation before P0-14 ships
- Open-graph image is a static PNG generated from the hero — built in P0-12

---

## What this wireframe deliberately omits

- Per-route landing pages (deferred — X-06 keeps URL space reserved)
- Operator logos / "as seen in" social proof (we have none yet; don't fake it)
- A pricing calculator (premature; buyer fee is small enough that one line in the FAQ suffices)
- A blog or content area (Phase 8+)
- Live listing previews (we have no listings; mock listings on the landing page would be dishonest)
