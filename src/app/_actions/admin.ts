"use server";

import { eq, isNull, sql as drizzleSql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb, schema } from "@/db/client";
import { requireSession } from "@/lib/auth/session";
import { sendWaitlistInviteEmail } from "@/lib/email/waitlist-invite";

function baseUrl() {
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (prod) return `https://${prod}`;
  return "http://localhost:4000";
}

// Phase 8 batched waitlist invites per P8-01/02.
// Admin picks a route slug and max batch size; we invite N un-invited
// waitlist rows whose `routes` array contains that slug.

type InviteResult =
  | { ok: true; sent: number; failed: number; route: string }
  | { ok: false; error: string };

export async function inviteWaitlistBatchAction(
  formData: FormData
): Promise<InviteResult> {
  const route = String(formData.get("route") ?? "").trim();
  const batchSize = Math.max(
    1,
    Math.min(200, parseInt(String(formData.get("batchSize") ?? "50"), 10) || 50)
  );

  const user = await requireSession();
  if (!user.isAdmin) return { ok: false, error: "admin only" };
  if (!route) return { ok: false, error: "Pick a route" };

  const db = getDb();
  if (!db) return { ok: false, error: "Server unavailable" };

  // Drizzle's typed builder doesn't expose Postgres' `ANY(array)` cleanly
  // for text[] columns, so the route-membership predicate uses a raw SQL
  // fragment inside the typed where().
  const targets = await db
    .select({
      id: schema.waitlist.id,
      email: schema.waitlist.email,
    })
    .from(schema.waitlist)
    .where(
      drizzleSql`${schema.waitlist.invitedAt} IS NULL AND ${route} = ANY(${schema.waitlist.routes})`
    )
    .limit(batchSize);

  if (targets.length === 0) {
    return { ok: true, sent: 0, failed: 0, route };
  }

  const signUpUrl = `${baseUrl()}/sign-up`;
  let sent = 0;
  let failed = 0;

  for (const t of targets) {
    try {
      const result = await sendWaitlistInviteEmail({
        email: t.email,
        signUpUrl,
      });
      if (result) {
        sent += 1;
        await db
          .update(schema.waitlist)
          .set({ invitedAt: new Date() })
          .where(eq(schema.waitlist.id, t.id));
      }
    } catch (err) {
      console.error("[invite] failed", t.email, err);
      failed += 1;
    }
  }

  await db.insert(schema.auditLog).values({
    actorUserId: user.id,
    action: "waitlist.batch_invited",
    entityType: "waitlist_batch",
    entityId: `${route}-${Date.now()}`,
    payload: { route, sent, failed, requested: batchSize },
  });

  revalidatePath("/admin/waitlist");
  return { ok: true, sent, failed, route };
}

// Defensive uses to keep type imports if some are unused.
void isNull;
