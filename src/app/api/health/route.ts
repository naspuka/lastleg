import { NextResponse } from "next/server";

import { getDb, schema } from "@/db/client";

// Phase 0 ops endpoint. Reports presence of env vars (not their values) and
// pings Neon so we can diagnose "form submits but no row appears" in prod
// without needing a Vercel logs tab.
//
// Safe to keep in prod: no secrets in the response, no DB writes, no
// authentication needed beyond the obscurity of the path. We can remove or
// gate it once we're past P0-09.

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const env = {
    DATABASE_URL: Boolean(process.env.DATABASE_URL),
    NEXT_PUBLIC_POSTHOG_KEY: Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY),
    NEXT_PUBLIC_POSTHOG_HOST: Boolean(process.env.NEXT_PUBLIC_POSTHOG_HOST),
    RESEND_API_KEY: Boolean(process.env.RESEND_API_KEY),
    RESEND_FROM: Boolean(process.env.RESEND_FROM),
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: Boolean(
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
    ),
    CLERK_SECRET_KEY: Boolean(process.env.CLERK_SECRET_KEY),
    CLERK_WEBHOOK_SIGNING_SECRET: Boolean(
      process.env.CLERK_WEBHOOK_SIGNING_SECRET
    ),
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: Boolean(
      process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL
    ),
    NEXT_PUBLIC_CLERK_SIGN_UP_URL: Boolean(
      process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL
    ),
    NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: Boolean(
      process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL
    ),
    NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL: Boolean(
      process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL
    ),
    INNGEST_EVENT_KEY: Boolean(process.env.INNGEST_EVENT_KEY),
    INNGEST_SIGNING_KEY: Boolean(process.env.INNGEST_SIGNING_KEY),
  };

  let db: {
    reachable: boolean;
    waitlistRows?: number;
    error?: string;
  } = { reachable: false };

  try {
    const client = getDb();
    if (!client) {
      db = { reachable: false, error: "no DATABASE_URL" };
    } else {
      // Cheap probe: count waitlist rows. Doubles as confirmation that the
      // migration is applied (table exists).
      const rows = await client.select().from(schema.waitlist).limit(0);
      // limit(0) returns [], but a successful query means the connection works
      // and the table exists. Fetch the actual count separately.
      const countRows = await client.$count(schema.waitlist);
      db = {
        reachable: true,
        waitlistRows: countRows,
      };
      // Silence unused
      void rows;
    }
  } catch (err) {
    db = {
      reachable: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  return NextResponse.json({
    ok: env.DATABASE_URL && db.reachable,
    env,
    db,
    runtime: {
      nodeVersion: process.version,
      vercelEnv: process.env.VERCEL_ENV ?? null,
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      region: process.env.VERCEL_REGION ?? null,
    },
  });
}
