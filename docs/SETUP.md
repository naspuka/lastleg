# Setup

Step-by-step from a fresh clone to a deployed landing page at your production
domain. Each section corresponds to one or more Phase 0 tasks in
[`TASKS.md`](TASKS.md). Work through them in order — later steps depend on
earlier ones.

If you get stuck, the [`DECISIONS.md`](DECISIONS.md) entries explain *why*
each service was chosen.

---

## 0. Prerequisites

You will need:

- **Node.js 22+** (we use Node 22, scaffold tested on 22.22.2)
- **pnpm 11+** — activate via `corepack enable && corepack prepare pnpm@latest --activate`
- **Git** + a GitHub account
- A credit/debit card for the domain (everything else has a free tier that covers waitlist-scale traffic)

Check your versions:

```bash
node --version    # v22.x
pnpm --version    # 11.x
```

---

## 1. Local dev (no external services)

The app is designed to boot and render the landing page **without any external
credentials**. You can poke at the UI before sorting out any accounts.

```bash
git clone <repo-url> lastleg
cd lastleg
pnpm install
cp .env.example .env.local    # leave it empty for now
pnpm dev                      # http://localhost:4000
```

Submitting the waitlist form in this state will validate the input and log it
to the dev server console (no DB write, no email sent). That's expected — the
server action checks for `DATABASE_URL` before attempting an insert.

When you're done editing, `pnpm run lint && pnpm run build` should both pass
green. CI will enforce this in P1-17.

---

## 2. Register the domain — P0-01

We're going with `lastleg.app`. If it's taken, pick something close
(`lastleg.uk`, `lastleg.co`, `getlastleg.com`) — anything where you control
the apex DNS.

**Recommended registrars:**

- [**Porkbun**](https://porkbun.com) — cheapest for `.app`, sane DNS UI, no
  upsells. Roughly £14/year for `.app`.
- [**Cloudflare Registrar**](https://www.cloudflare.com/products/registrar/) —
  at-cost pricing, requires moving DNS to Cloudflare (which is fine and
  arguably an upgrade).
- **Avoid GoDaddy and Namecheap defaults** — both push paid add-ons hard and
  Namecheap charges more than Porkbun for the same TLDs.

After buying:

1. Note the registrar's DNS console URL — you'll add records in step 4.
2. Do **not** point DNS anywhere yet. Vercel will give us the exact records.

---

## 3. Provision Neon Postgres — P0-04

[Neon](https://console.neon.tech) is our serverless Postgres. Free tier
includes 500 MB storage, plenty for the waitlist + early MVP usage.

1. Sign up at https://console.neon.tech
2. **Create project**: name it `lastleg`, region `aws-eu-west-2` (London) so
   it's close to UK users.
3. Neon creates a default branch called `main` — this is your production DB.
   Create a second branch called `dev` for local development (Branches tab →
   `New Branch` → branch off `main`).
4. From the **Connection Details** panel, copy the **pooled** connection
   string for the **dev** branch (it'll look like
   `postgresql://user:pass@ep-something-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require`).
   Paste it into `.env.local`:

   ```bash
   DATABASE_URL="postgresql://...pooler...?sslmode=require"
   ```

5. Apply the initial migration:

   ```bash
   pnpm db:migrate
   ```

   That runs `drizzle/0000_numerous_wind_dancer.sql` against the dev branch
   and creates the `waitlist` table + `waitlist_role` enum.

6. Sanity check: `pnpm db:studio` opens Drizzle Studio in your browser; you
   should see the empty `waitlist` table.

7. Re-run `pnpm dev`, submit the form once, refresh studio — your row should
   appear. ✅

> **Don't apply the prod migration yet.** We do that just before the first
> production deploy (step 7).

---

## 4. Vercel project + connect domain — P0-02

1. Sign up at https://vercel.com using your GitHub account.
2. Push this repo to GitHub if you haven't already.
3. In Vercel: **Add New… → Project**, import the GitHub repo. Accept the
   detected Next.js settings (Framework: Next.js, Build command: `next build`,
   Output: `.next`). Don't deploy yet — set env vars first.
4. **Settings → Environment Variables**, add:
   - `DATABASE_URL` (production value — use the **prod-branch pooled URL**
     from Neon, *not* the dev one) → **Production** environment
   - `DATABASE_URL` (dev value) → **Preview** + **Development** environments
5. **Settings → Domains**, add `lastleg.app` and `www.lastleg.app`. Vercel
   will show you DNS records to add.
6. In your registrar (Porkbun/Cloudflare), add the DNS records exactly as
   Vercel shows. Typical setup:
   - `A` record for `@` (apex) → `76.76.21.21`
   - `CNAME` for `www` → `cname.vercel-dns.com`
7. Wait 1–5 minutes for DNS to propagate. Vercel will turn green when verified.

> **Don't deploy yet** — finish steps 5 and 6 so the first prod deploy already
> has email + analytics wired.

---

## 5. Resend transactional email — P0-10

[Resend](https://resend.com) handles the signup confirmation email and (later)
all transactional email.

1. Sign up at https://resend.com.
2. **Domains → Add Domain**, enter `lastleg.app`. Resend gives you DNS
   records to add (DKIM, SPF, DMARC).
3. Add those records at the registrar. Wait for Resend to verify them (often
   under 5 minutes).
4. **API Keys → Create API Key**, name it `production`. Copy the key — you
   only see it once.
5. Add to `.env.local`:
   ```bash
   RESEND_API_KEY="re_..."
   RESEND_FROM="LastLeg <hello@lastleg.app>"
   ```
6. Add the same values to Vercel: Settings → Environment Variables, scope to
   **Production** + **Preview**.

> The Resend code path is env-gated — until `RESEND_API_KEY` is set the
> server action just skips the email send. (Implementation is part of P0-10;
> coming next session.)

---

## 6. PostHog analytics — P0-11

[PostHog](https://posthog.com) tracks page views + the `waitlist_signup`
event. EU cloud is the right region for GDPR.

1. Sign up at https://eu.posthog.com (note: **eu**, not the US instance).
2. **Project Settings → Project API Key**, copy it.
3. Add to `.env.local` and to Vercel (Production + Preview + Development):
   ```bash
   NEXT_PUBLIC_POSTHOG_KEY="phc_..."
   NEXT_PUBLIC_POSTHOG_HOST="https://eu.i.posthog.com"
   ```

The `NEXT_PUBLIC_` prefix is required for browser-side firing of page views.

---

## 7. First production deploy — P0-14

Now everything's wired:

1. Apply the migration to **prod** Neon branch:
   ```bash
   DATABASE_URL="<prod-branch-pooled-url>" pnpm db:migrate
   ```
2. In Vercel: **Deployments → Redeploy** (or push to `main`).
3. Wait for the deploy to finish, click the production URL.
4. Smoke-test live:
   - Open `https://lastleg.app` — page loads over HTTPS
   - Submit the form with your real email
   - Check Drizzle Studio (against prod URL): row appears
   - Check your inbox: confirmation email arrives (once P0-10 is implemented)
   - Check PostHog: `$pageview` + `waitlist_signup` events appear under
     **Activity**
5. Mark P0-14 done in [`TASKS.md`](TASKS.md). 🚀

---

## Troubleshooting

**`DATABASE_URL` is set but inserts fail in dev**
Make sure the URL ends with `?sslmode=require`. Neon requires SSL.

**Vercel build fails on `db:migrate`**
We don't run migrations in the Vercel build — apply them manually with
`pnpm db:migrate` against the relevant `DATABASE_URL`. This is intentional;
auto-migrations on deploy are the Phase 7 conversation.

**Resend "domain not verified"**
DNS propagation can take up to a few hours. Use https://dnschecker.org to
confirm the records have propagated globally before re-clicking *verify* in
Resend.

**Production env var changes don't take effect**
Vercel uses the env vars from the deploy that was active at build time. After
changing a var in Settings, you must **Redeploy** (Deployments → ⋯ → Redeploy)
for it to take effect.

---

## What's next

Once steps 1–7 are green, Phase 0 is shipped. Move on to Phase 1 (foundations
— auth, full schema, CI). See [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md#phase-1--foundations).
