import { serve } from "inngest/next";

import { inngest } from "@/lib/inngest/client";
import { functions } from "@/lib/inngest/functions";

// Inngest serve handler. Exposes our registered functions to the Inngest
// service via SDK introspection (PUT /api/inngest) and receives function-run
// callbacks (POST). GET returns the dev landing page.
//
// Phase 0/1 ships this route empty (only the health-check fn). Phase 2+
// adds verify-listing, release-ticket, release-payout, match-alerts, etc.
//
// Env-gating: Inngest's serve() handler tolerates a missing signing key in
// dev (it talks to the local Inngest CLI on port 8288). In production, the
// platform-level INNGEST_SIGNING_KEY + INNGEST_EVENT_KEY env vars need to
// be set. Without them, registration calls from Inngest cloud will be
// rejected — but the app still boots, which is what we want.

export const runtime = "nodejs";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
});
