# Runbook — Manual claim review

Triggered when:
- Buyer files a 3rd+ claim on their account (`users.guarantee_claims_used >= 2`)
- A seller disputes an auto-approved claim
- Operator-cancellation needs evidence we can't verify automatically

## Procedure

1. Open `/admin/claims` (admin-gated by `users.is_admin = true`).
2. For each pending claim, gather context:
   - Click into the buyer's transaction history (run a SQL query)
   - Pull seller's listing audit trail
   - If the claim is for "denied boarding name check": check if the listing
     had `has_passenger_name = true` AND was disclosed at checkout.
3. Decide:
   - **Approve**: refund buyer (PI gets refunded if captured, cancelled
     otherwise). Seller's payout halts. Buyer's guarantee_claims_used
     increments. Operator_ticket stays in `sold` state — not relistable.
   - **Reject**: claim status → rejected. Seller's payout resumes (the
     release-payout job will pick it up on the next run). Buyer gets a
     short email explaining.
4. Always include internal notes in the form. They're audit-logged.
5. If the same seller racks up 3+ rejected-buyer claims in a month, flag
   for review:
   ```sql
   SELECT count(*) FROM guarantee_claims gc
   JOIN transactions t ON t.id = gc.transaction_id
   WHERE t.seller_id = '<seller-id>'
     AND gc.status = 'approved'
     AND gc.created_at > now() - interval '30 days';
   ```

## SLA

Aim for a 48-hour first-response on every claim. The seller and buyer both
get an email on resolution.
