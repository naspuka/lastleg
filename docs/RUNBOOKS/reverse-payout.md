# Runbook — Reverse a payout

The seller was paid but shouldn't have been:
- Late-arriving guarantee claim approved
- Operator confirmed the buyer was denied boarding hours after the trip
- Chargeback lost

## Procedure

1. Find the transaction + transfer in the audit log:
   ```sql
   SELECT id, payload FROM audit_log
   WHERE action = 'transaction.payout_released'
     AND entity_id = '<tx-id>';
   ```
2. Grab the `transferId` from the payload.
3. In Stripe dashboard → Connect → Transfers → find transfer → "Reverse".
   (Or via API: `stripe.transfers.createReversal(transferId)`.)
4. Update the transaction:
   ```sql
   UPDATE transactions
   SET status = 'refunded', dispute_status = 'resolved_buyer',
       updated_at = now()
   WHERE id = '<tx-id>';

   INSERT INTO audit_log (action, entity_type, entity_id, payload)
   VALUES ('ops.payout_reversed', 'transaction', '<tx-id>',
           jsonb_build_object('reason', '...', 'transferId', '...'));
   ```
5. Refund the buyer if not already done:
   ```bash
   # If PI was captured
   stripe refunds create --payment-intent pi_...
   ```
6. Email the seller manually. There's no automated "your payout was
   reversed" template at MVP — write a polite explanation.

## Constraints

- Stripe Connect reversals only work if the connected account has enough
  balance. If they've withdrawn already, the reversal goes negative — they
  owe Stripe. Stripe will email them and eventually deduct from future
  payouts.
- We cover the difference from the guarantee fund.
