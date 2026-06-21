# Runbook — Neon incident

Neon Postgres is unreachable, slow, or a migration failed.

## Quick diagnostics

```bash
# Connection check
DATABASE_URL='...' psql -c 'SELECT 1'

# Look up latest applied migration
DATABASE_URL='...' psql -c 'SELECT * FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 5'
```

Also: open https://status.neon.tech and the Neon project dashboard.

## Procedure

1. **Unreachable, < 10 min**: serverless functions will retry. Nothing to do.
2. **Unreachable, > 10 min**: degraded experience.
   - The landing page still works (statically prerendered).
   - Form submits to waitlist fail gracefully (returns "try again").
   - Authenticated routes return 503 from `/api/health`.
   - Post on `/status` (manual update or status-page tool) acknowledging.
3. **Migration failed mid-deploy**: drizzle-kit applies migrations in a
   transaction, so partial state is rare. If it does happen:
   ```bash
   # Verify schema state
   DATABASE_URL='...' pnpm db:studio
   # Roll the journal back one migration manually
   ```
   Then push a corrective migration. Never edit `drizzle/*.sql` in place
   after it's been applied to prod.
4. **Slow queries**: Neon dashboard → Monitoring → Slow Queries. Common
   offenders are missing indexes. Add the index, drizzle-generate, deploy.

## Prevention

- Production runs on the pooled connection string (`?pooler=true`). Don't
  use the direct connection for serverless.
- Monitor for autosuspend wake-up latency. If we exceed 500ms cold-start
  more than 5%/week, upgrade Neon plan.
