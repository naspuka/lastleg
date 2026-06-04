"use server";

import { getDb, schema } from "@/db/client";
import { waitlistSchema, type WaitlistInput } from "@/lib/waitlist-schema";

export type WaitlistState =
  | { status: "idle" }
  | { status: "ok" }
  | {
      status: "error";
      fieldErrors: Partial<Record<keyof WaitlistInput, string>>;
      values: { email: string; phone: string; role: string; routes: string[] };
    };

export const initialWaitlistState: WaitlistState = { status: "idle" };

// Per the wireframe rule: on duplicate email we treat the response as success
// so we don't leak whether an address is already on the list. Insert uses
// onConflictDoNothing, which silently no-ops on the unique(email) violation.
// (Re-sending the confirmation email on dup happens in P0-10.)
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

  if (db) {
    try {
      await db
        .insert(schema.waitlist)
        .values({
          email: parsed.data.email,
          phone: parsed.data.phone ?? null,
          role: parsed.data.role,
          routes: parsed.data.routes,
          source: "landing",
        })
        .onConflictDoNothing({ target: schema.waitlist.email });
    } catch (err) {
      // Don't surface DB infrastructure errors to the user. Log + return a
      // generic field error so the form still behaves predictably. Sentry
      // wiring lands in P1-12.
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
    // No DATABASE_URL configured — dev/preview before Neon is provisioned.
    console.log("[waitlist] signup (no DB configured)", parsed.data);
  }

  // TODO(P0-10): enqueue Resend confirmation email.
  // TODO(P0-11): PostHog server-side event `waitlist_signup`.

  return { status: "ok" };
}
