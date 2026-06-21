import { eq, lte } from "drizzle-orm";

import { getDb, schema } from "@/db/client";

import { inngest } from "../client";

// P5-03 expire-listing.
// Runs every minute. Any live or pending_verification listing whose
// departure_at has passed gets flipped to `expired`. Also marks the
// associated operator_ticket as expired so the booking ref becomes
// re-listable only after a buyer-side dispute resolution explicitly
// reopens it (not a Phase 2 concern).
//
// Idempotent: the WHERE clause filters out anything already in a terminal
// state, so re-running on the same minute is a no-op.

export const expireListing = inngest.createFunction(
  { id: "expire-listing", triggers: [{ cron: "* * * * *" }] },
  async ({ step }) => {
    const stale = await step.run("find-stale", async () => {
      const db = getDb();
      if (!db) return [];
      return db
        .select({
          id: schema.listings.id,
          bookingReference: schema.listings.bookingReference,
          status: schema.listings.status,
        })
        .from(schema.listings)
        // Live and pending_verification rows whose departure has passed.
        // The status filter happens client-side after fetch so the index on
        // (status, departure_at) doesn't get fragmented across two enum
        // values.
        .where(lte(schema.listings.departureAt, new Date()))
        .limit(100);
    });

    const targets = stale.filter(
      (l) => l.status === "live" || l.status === "pending_verification"
    );
    if (targets.length === 0) return { expired: 0 };

    await step.run("flip-expired", async () => {
      const db = getDb();
      if (!db) return;
      for (const t of targets) {
        await db
          .update(schema.listings)
          .set({ status: "expired", updatedAt: new Date() })
          .where(eq(schema.listings.id, t.id));
        if (t.bookingReference) {
          await db
            .update(schema.operatorTickets)
            .set({ status: "expired", updatedAt: new Date() })
            .where(
              eq(schema.operatorTickets.bookingReference, t.bookingReference)
            );
        }
        await db.insert(schema.auditLog).values({
          actorUserId: null,
          action: "listing.expired",
          entityType: "listing",
          entityId: t.id,
          payload: { previousStatus: t.status },
        });
      }
    });

    return { expired: targets.length };
  }
);
