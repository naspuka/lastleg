import { NextResponse } from "next/server";
import { serve } from "inngest/next";

import { inngest } from "@/lib/inngest/client";
import { functions } from "@/lib/inngest/functions";

// Inngest serve handler. Exposes our registered functions to the Inngest
// service via SDK introspection (PUT /api/inngest) and receives function-run
// callbacks (POST). GET returns the dev landing page.
//
// Env-gating: in production, Inngest's serve handler requires either
// INNGEST_SIGNING_KEY or local-dev mode. With neither, it 500s on every
// request. Without keys we instead return a clean 503 with diagnostic copy
// so curling the endpoint tells the operator what's missing — matches the
// behaviour of /api/clerk/webhook when its secret is unset.
//
// In local dev the Inngest CLI (`npx inngest-cli@latest dev`) handles
// things without any env vars; serve() detects the local mode automatically.

export const runtime = "nodejs";

const inProduction = process.env.VERCEL_ENV === "production";
const hasSigningKey = Boolean(process.env.INNGEST_SIGNING_KEY);

const handlers = serve({
  client: inngest,
  functions,
});

function notConfiguredResponse() {
  return NextResponse.json(
    {
      ok: false,
      error: "inngest is not configured for this environment",
      missing: ["INNGEST_SIGNING_KEY", "INNGEST_EVENT_KEY"],
      docs: "https://github.com/naspuka/lastleg/blob/main/docs/SETUP.md#9-inngest-background-jobs--p1-14-do-when-shipping-seller-flow",
    },
    { status: 503 }
  );
}

const enabled = !inProduction || hasSigningKey;

export const GET = enabled ? handlers.GET : notConfiguredResponse;
export const POST = enabled ? handlers.POST : notConfiguredResponse;
export const PUT = enabled ? handlers.PUT : notConfiguredResponse;
