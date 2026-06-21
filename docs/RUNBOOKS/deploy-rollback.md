# Runbook — Deploy rollback

A Vercel deploy broke production.

## Signal

- `/api/health` returns 500 or non-2xx
- Sentry error spike (once wired in P1-12)
- Customer reports

## Procedure

1. Vercel dashboard → `lastleg-azure` → Deployments
2. Find the last known-good deployment (look for green status + recent
   smoke test). Click ⋯ → **Promote to Production**.
3. Within 30 seconds the production alias swaps. Verify:
   ```bash
   curl https://lastleg-azure.vercel.app/api/health
   ```
4. The broken commit is still in `main`. Revert it locally:
   ```bash
   git revert <bad-sha>
   git push
   ```
5. Audit-log:
   ```sql
   INSERT INTO audit_log (action, entity_type, entity_id, payload)
   VALUES ('ops.deploy_rollback', 'deploy', '<bad-sha>',
           jsonb_build_object('rolledBackTo', '<good-sha>', 'reason', '...'));
   ```

## DB migration caveat

If the bad commit included a Drizzle migration, `pnpm db:migrate` already
applied it. Rolling back the *code* does NOT roll back the schema.
- If the migration was additive (new column, new table), the rollback is
  fine — extra schema is dormant.
- If it was a destructive change (drop, rename), write a corrective
  migration that restores the old shape AND push it as the next deploy.
- This is why CONVENTIONS.md says: avoid destructive migrations on
  production tables without a deprecation period.
