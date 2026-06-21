# Runbook — Seller payouts setup

When a seller asks "why hasn't my payout arrived?", walk through this list.

## Three gates before any payout fires

1. **Stripe Connect account exists** (`users.stripe_connect_account_id` not null)
2. **Stripe Identity verified** (`users.stripe_identity_verified_at` not null)
3. **No open dispute** (`transactions.dispute_status = 'none'`)
4. **Time anchor reached** (`transactions.escrow_release_at < now()`)

## Diagnostic SQL

```sql
SELECT
  t.id, t.status, t.escrow_release_at, t.payout_released_at,
  t.dispute_status, t.stripe_payment_intent,
  s.email AS seller, s.stripe_connect_account_id IS NOT NULL AS connect_ok,
  s.stripe_identity_verified_at IS NOT NULL AS identity_ok
FROM transactions t
JOIN users s ON s.id = t.seller_id
WHERE t.id = '<tx-id>';
```

## Most common cause

The seller never finished Stripe Identity. Direct them to `/sell` → "Set
up payouts" — they'll be re-routed through the AccountLink onboarding.

## Manual trigger

If all gates are green but the job didn't fire (Inngest hiccup):

```bash
# Find via Inngest dashboard, or curl:
curl -X POST https://lastleg-azure.vercel.app/api/admin/requeue-payout \
  -H 'cookie: ...session...' \
  -d 'transactionId=<id>'
```

(Note: `/api/admin/requeue-payout` is a planned endpoint — extend
requeue-verify.ts when this comes up for the first time.)
