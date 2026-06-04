import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { Webhook } from "svix";

import { getDb, schema } from "@/db/client";

// Clerk → LastLeg user sync. Clerk owns the auth identity; we mirror the
// user into our `users` table on every lifecycle event so app code can join
// against domain entities (listings, transactions, etc) without round-tripping
// to Clerk on every request.
//
// Signature verification via Svix is mandatory — without it any attacker
// who can hit our URL can create / promote / delete users.
//
// Env vars:
//   CLERK_WEBHOOK_SIGNING_SECRET — from Clerk dashboard → Webhooks → Endpoint
//   (we expose just the webhook URL to Clerk; it signs every payload)

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ClerkEmailAddress = { id: string; email_address: string };
type ClerkPhoneNumber = { id: string; phone_number: string };
type ClerkUserEvent = {
  id: string;
  email_addresses?: ClerkEmailAddress[];
  primary_email_address_id?: string | null;
  phone_numbers?: ClerkPhoneNumber[];
  primary_phone_number_id?: string | null;
  username?: string | null;
  first_name?: string | null;
};
type ClerkWebhookPayload = {
  type: "user.created" | "user.updated" | "user.deleted" | string;
  data: ClerkUserEvent;
};

function pickPrimaryEmail(user: ClerkUserEvent): string | null {
  const primary = user.email_addresses?.find(
    (e) => e.id === user.primary_email_address_id
  );
  return (primary ?? user.email_addresses?.[0])?.email_address ?? null;
}

function pickPrimaryPhone(user: ClerkUserEvent): string | null {
  const primary = user.phone_numbers?.find(
    (p) => p.id === user.primary_phone_number_id
  );
  return (primary ?? user.phone_numbers?.[0])?.phone_number ?? null;
}

function deriveHandle(user: ClerkUserEvent, email: string | null): string {
  // Prefer the Clerk username, fall back to the local-part of the email,
  // fall back to the clerk user id. We'll let users pick a real handle on
  // their first dashboard visit; this is just enough to satisfy the unique
  // constraint.
  if (user.username) return user.username.toLowerCase();
  if (email) return email.split("@")[0]!.toLowerCase();
  return user.id.toLowerCase();
}

export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  if (!secret) {
    // No secret configured → can't verify → reject. Returning 503 (not 200)
    // makes the broken state visible in Clerk's delivery logs.
    return NextResponse.json(
      { ok: false, error: "webhook signing secret not configured" },
      { status: 503 }
    );
  }

  const rawBody = await req.text();
  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json(
      { ok: false, error: "missing svix headers" },
      { status: 400 }
    );
  }

  let evt: ClerkWebhookPayload;
  try {
    evt = new Webhook(secret).verify(rawBody, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkWebhookPayload;
  } catch (err) {
    console.error("[clerk-webhook] signature verification failed", err);
    return NextResponse.json(
      { ok: false, error: "invalid signature" },
      { status: 401 }
    );
  }

  const db = getDb();
  if (!db) {
    // Webhook arrived before Neon is provisioned — log and 200 so Clerk
    // doesn't retry forever. Once DB is up the next Clerk event will sync.
    console.warn("[clerk-webhook] no DB configured, dropping event", evt.type);
    return NextResponse.json({ ok: true, skipped: "no-db" });
  }

  const data = evt.data;
  try {
    switch (evt.type) {
      case "user.created":
      case "user.updated": {
        const email = pickPrimaryEmail(data);
        const phone = pickPrimaryPhone(data);
        const handle = deriveHandle(data, email);

        if (!email) {
          console.warn(
            "[clerk-webhook] event with no email, skipping",
            data.id
          );
          return NextResponse.json({ ok: true, skipped: "no-email" });
        }

        // Upsert by clerk_user_id. Idempotent — Clerk delivers events at
        // least once.
        await db
          .insert(schema.users)
          .values({
            clerkUserId: data.id,
            email,
            phone,
            handle,
          })
          .onConflictDoUpdate({
            target: schema.users.clerkUserId,
            set: {
              email,
              phone,
              // Don't overwrite handle on update — the user may have set a
              // custom one inside the app. Only seed it on create (which the
              // ON CONFLICT side won't fire for).
              updatedAt: new Date(),
            },
          });
        break;
      }

      case "user.deleted": {
        // Soft-delete: redact PII, keep referential integrity. Real DELETE
        // would orphan transactions and break audit history (§6 GDPR).
        await db
          .update(schema.users)
          .set({
            email: `deleted-${data.id}@redacted.local`,
            phone: null,
            handle: `deleted-${data.id}`,
            deletedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(schema.users.clerkUserId, data.id));
        break;
      }

      default:
        // Other event types (session.*, organization.*) — we don't care yet.
        break;
    }
  } catch (err) {
    console.error("[clerk-webhook] handler failed", evt.type, err);
    // 500 → Clerk retries. We want retries here, not silent drops.
    return NextResponse.json(
      { ok: false, error: "handler failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
