# Runbook — Chargeback

A chargeback is the buyer disputing the charge with their card issuer rather
than via the in-app claim flow. Stripe emails the registered account.

## Inputs

- Stripe email "You have a new dispute" with PaymentIntent id `pi_...`
- Deadline (usually 7 days) shown in Stripe dashboard

## Procedure

1. Open Stripe dashboard → Disputes → click the dispute.
2. Grab the PaymentIntent id and look up the Transaction:
   ```sql
   SELECT * FROM transactions WHERE stripe_payment_intent = 'pi_...';
   SELECT * FROM listings WHERE id = (SELECT listing_id FROM transactions WHERE stripe_payment_intent = 'pi_...');
   SELECT * FROM audit_log WHERE entity_id IN (...) ORDER BY created_at DESC;
   ```
3. **If we already refunded** (transactions.status = 'refunded') → in Stripe,
   submit evidence: "Refund already processed on YYYY-MM-DD via guarantee
   claim claim_id=...". Stripe usually returns the dispute deposit to us.
4. **If we did NOT refund**:
   - Was there a payout to the seller? (transactions.payout_released_at)
   - If yes and chargeback succeeds → loss is debited from our platform
     balance. Reverse the seller transfer via Stripe Connect:
     `stripe.transfers.createReversal(transferId)` (manual via dashboard).
   - Pull together evidence: listing PDF blob URL, audit trail, any buyer
     messages. Submit in Stripe.
5. **Always** add an audit_log entry:
   ```sql
   INSERT INTO audit_log (action, entity_type, entity_id, payload)
   VALUES ('stripe.chargeback_received', 'transaction', '<tx-id>',
           jsonb_build_object('paymentIntentId', '...', 'reason', '...'));
   ```
6. If we lose 3+ chargebacks in any week, file a follow-up to tighten Stripe
   Radar rules.

## Escalation

If the buyer is clearly fraudulent (multiple Sybil accounts, same device
fingerprint across chargebacks), set `users.banned_at = now()` for every
account in the cluster.
