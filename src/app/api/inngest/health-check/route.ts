import { NextResponse } from "next/server";

import { inngest } from "@/lib/inngest/client";

// Dev-side trigger for the Inngest health-check function. Curl this endpoint
// (or hit it in a browser) and it sends the `app/health-check` event, which
// Inngest then dispatches to the registered function.
//
// Useful for proving:
//   1. The Vercel runtime has Inngest credentials
//   2. Inngest can reach our serve handler in the other direction
//   3. The whole job-dispatch loop is healthy
//
// Returns the event ID so you can correlate the request with the dashboard
// run page.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await inngest.send({
      name: "app/health-check",
      data: { triggeredAt: new Date().toISOString() },
    });
    return NextResponse.json({ ok: true, ids: result.ids });
  } catch (err) {
    console.error("[inngest] health-check send failed", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
