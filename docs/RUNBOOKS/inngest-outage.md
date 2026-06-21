# Runbook — Inngest outage

Inngest runs every time-anchored job: verify-listing, match-alerts,
release-ticket, release-payout, decay-price, expire-listing, process-claim,
reconcile-stripe, cleanup-orphaned-blobs.

When it's down or degrading, every one of those stops firing.

## Signal

- Inngest status page (https://status.inngest.com) shows incident.
- Our `/api/inngest` returns 401 for valid Inngest-signed requests (signing
  key mismatch).
- Customers report "ticket didn't arrive at T-30min".
- `/api/health` shows env OK but `inngest.send()` from a server action
  returns network errors.

## Procedure

1. Confirm scope: which jobs are stuck?
   ```sql
   -- listings waiting for verify-listing
   SELECT count(*) FROM listings
   WHERE status = 'pending_verification'
     AND created_at < now() - interval '5 minutes';

   -- transactions past release-ticket time but not released
   SELECT count(*) FROM transactions t
   JOIN listings l ON l.id = t.listing_id
   WHERE t.ticket_released_at IS NULL
     AND l.departure_at - interval '30 minutes' < now()
     AND t.status = 'paid';

   -- transactions past escrow_release_at
   SELECT count(*) FROM transactions
   WHERE escrow_release_at < now() - interval '10 minutes'
     AND payout_released_at IS NULL
     AND dispute_status = 'none'
     AND status = 'ticket_revealed';
   ```
2. **If Inngest recovers within 30 min**: do nothing. They retry
   automatically per their durability guarantees.
3. **If outage > 30 min and tickets needed to be delivered**: manually
   trigger the release-ticket job per affected transaction via
   `POST /api/admin/requeue-verify` (extend the endpoint as needed). For
   payouts past escrow_release_at, the next reconcile-stripe cron will
   eventually fix state — but you can prod it sooner by calling the cron
   handler from the Inngest dashboard once it's back up.
4. Audit-log the manual intervention:
   ```sql
   INSERT INTO audit_log (action, entity_type, entity_id, payload)
   VALUES ('ops.inngest_outage_intervention', 'transaction', '<id>',
           jsonb_build_object('reason', 'manual replay'));
   ```

## Prevention

- If we see two outages > 30 min in a month, swap Inngest for self-hosted
  or move time-anchored work to Vercel Cron jobs as a fallback.
