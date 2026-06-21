# Runbooks

Operational procedures for production incidents and recurring ops tasks per
P7-09..12.

| Runbook | When |
|---|---|
| [chargeback.md](chargeback.md) | Stripe forwards a chargeback notification |
| [manual-claim-review.md](manual-claim-review.md) | A buyer's claim hits manual review (3rd+ claim or seller disputed) |
| [inngest-outage.md](inngest-outage.md) | Inngest dashboard shows degraded service or jobs are silently dropping |
| [reverse-payout.md](reverse-payout.md) | A payout went out by mistake (failed dispute, late cancel) |
| [neon-incident.md](neon-incident.md) | Neon Postgres is unreachable, slow, or migrations failed |
| [deploy-rollback.md](deploy-rollback.md) | A Vercel deploy broke production |

Each runbook is short and procedural. If you need more than 5 minutes to
follow it, the runbook itself needs editing — file a PR.
