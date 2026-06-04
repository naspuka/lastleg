"use server";

import { getDb, schema } from "@/db/client";
import { trackServerEvent } from "@/lib/analytics/posthog-server";
import { sendWaitlistConfirmation } from "@/lib/email/waitlist-confirmation";
import { waitlistSchema, type WaitlistInput } from "@/lib/waitlist-schema";

import type { WaitlistState } from "./waitlist-types";

// IMPORTANT: a "use server" file can only export async functions per Next.js
// 16's strict runtime check (otherwise `A "use server" file can only export
// async functions, found object`). Types and the initialWaitlistState
// constant live in ./waitlist-types.ts.

// Per the wireframe rule: on duplicate email we treat the response as success
// so we don't leak whether an address is already on the list. Insert uses
// onConflictDoNothing, which silently no-ops on the unique(email) violation.
export async function joinWaitlistAction(
  _prev: WaitlistState,
  formData: FormData
): Promise<WaitlistState> {
  const raw = {
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    role: String(formData.get("role") ?? ""),
    routes: formData.getAll("routes").map((v) => String(v)),
  };

  const parsed = waitlistSchema.safeParse(raw);

  if (!parsed.success) {
    const fieldErrors: Partial<Record<keyof WaitlistInput, string>> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !(key in fieldErrors)) {
        (fieldErrors as Record<string, string>)[key] = issue.message;
      }
    }
    return { status: "error", fieldErrors, values: raw };
  }

  const db = getDb();
  let isNewRow = true;

  if (db) {
    try {
      const inserted = await db
        .insert(schema.waitlist)
        .values({
          email: parsed.data.email,
          phone: parsed.data.phone ?? null,
          role: parsed.data.role,
          routes: parsed.data.routes,
          source: "landing",
        })
        .onConflictDoNothing({ target: schema.waitlist.email })
        .returning({ id: schema.waitlist.id });

      // Empty returning() array == row already existed and the conflict
      // clause skipped the insert. Per wireframe rule: still surface success,
      // but skip the analytics event + confirmation re-send so we don't spam
      // people who are already on the list.
      isNewRow = inserted.length > 0;
    } catch (err) {
      console.error("[waitlist] insert failed", err);
      return {
        status: "error",
        fieldErrors: {
          email: "Something went wrong on our end. Try again in a moment.",
        },
        values: raw,
      };
    }
  } else {
    console.log("[waitlist] signup (no DB configured)", parsed.data);
  }

  if (isNewRow) {
    // Best-effort fan-out. Either failing is non-fatal to signup UX — they're
    // logged in posthog-server / waitlist-confirmation respectively.
    await Promise.allSettled([
      sendWaitlistConfirmation({
        email: parsed.data.email,
        routes: parsed.data.routes,
        role: parsed.data.role,
      }).catch((err) => {
        console.error("[waitlist] confirmation email failed", err);
      }),
      trackServerEvent({
        distinctId: parsed.data.email,
        event: "waitlist_signup",
        properties: {
          role: parsed.data.role,
          routes_count: parsed.data.routes.length,
          routes: parsed.data.routes,
          has_phone: Boolean(parsed.data.phone),
        },
      }),
    ]);
  }

  return { status: "ok" };
}
