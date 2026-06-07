import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb, schema } from "@/db/client";
import { requireSession } from "@/lib/auth/session";
import { inngest } from "@/lib/inngest/client";

// Ops tool: requeue verify-listing for any of THIS USER'S listings that
// are stuck in pending_verification. Used to unstick listings whose
// original verify-requested event was dropped (e.g. when the Inngest app
// hadn't yet registered the function at first sync).
//
// Auth: any signed-in user can requeue THEIR OWN stuck listings. No admin
// role required at MVP — the only thing this does is dispatch a fresh
// Inngest event for rows that already belong to the caller. Admin-only
// gating goes in when the broader /admin surface lands (P6-09).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  let user;
  try {
    user = await requireSession();
  } catch {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 }
    );
  }

  const db = getDb();
  if (!db) {
    return NextResponse.json({ ok: false, error: "no DB" }, { status: 503 });
  }

  const stuck = await db
    .select({
      id: schema.listings.id,
      bookingReference: schema.listings.bookingReference,
    })
    .from(schema.listings)
    .where(
      and(
        eq(schema.listings.sellerId, user.id),
        eq(schema.listings.status, "pending_verification")
      )
    );

  if (stuck.length === 0) {
    return NextResponse.json({ ok: true, requeued: 0 });
  }

  const sent = await Promise.allSettled(
    stuck.map((l) =>
      inngest.send({
        name: "listing/verify-requested",
        data: { listingId: l.id },
      })
    )
  );

  const failures = sent
    .map((r, i) => (r.status === "rejected" ? stuck[i]!.id : null))
    .filter(Boolean);

  return NextResponse.json({
    ok: failures.length === 0,
    requeued: stuck.length - failures.length,
    failures,
    listings: stuck.map((l) => ({
      id: l.id,
      bookingReference: l.bookingReference,
    })),
  });
}
