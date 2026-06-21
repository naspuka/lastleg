import { and, eq, gte, lte, or, sql as drizzleSql } from "drizzle-orm";

import { getDb, schema } from "@/db/client";
import { sendListingAlertEmail } from "@/lib/email/listing-alert";
import { sendSms } from "@/lib/sms/twilio";

import { inngest } from "../client";

// Phase 3 match-alerts job per §3.7.
//
// Triggered on `listing/published`. Finds RouteAlert rows whose
// (route_origin, route_destination, window, max_price) overlap the newly-
// published listing and fans out notifications per the alert's preferences.
//
// Throttling: an alert never fires twice within 15 minutes — limits the
// price-decay spam (every step-down would otherwise re-notify). Tracked via
// route_alerts.last_match_at.

const THROTTLE_WINDOW_MS = 15 * 60 * 1000;

function baseUrl() {
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (prod) return `https://${prod}`;
  const preview = process.env.VERCEL_URL;
  if (preview) return `https://${preview}`;
  return "http://localhost:4000";
}

export const matchAlerts = inngest.createFunction(
  {
    id: "match-alerts",
    triggers: [{ event: "listing/published" }],
    concurrency: { key: "event.data.listingId", limit: 1 },
  },
  async ({ event, step }) => {
    const listingId = event.data.listingId as string;

    const listing = await step.run("load-listing", async () => {
      const db = getDb();
      if (!db) throw new Error("DB not configured");
      const rows = await db
        .select()
        .from(schema.listings)
        .where(eq(schema.listings.id, listingId))
        .limit(1);
      return rows[0] ?? null;
    });

    if (!listing) return { skipped: true, reason: "listing not found" };
    if (listing.status !== "live") {
      return { skipped: true, reason: `status=${listing.status}` };
    }

    const matchRows = await step.run("find-matching-alerts", async () => {
      const db = getDb();
      if (!db) throw new Error("DB not configured");

      const cutoff = new Date(Date.now() - THROTTLE_WINDOW_MS);

      return db
        .select({
          alert: schema.routeAlerts,
          user: {
            id: schema.users.id,
            email: schema.users.email,
            phone: schema.users.phone,
          },
        })
        .from(schema.routeAlerts)
        .innerJoin(
          schema.users,
          eq(schema.users.id, schema.routeAlerts.userId)
        )
        .where(
          and(
            // Route match — uppercase normalisation done at insert time so
            // case-insensitive exact match is correct.
            eq(schema.routeAlerts.routeOrigin, listing.routeOrigin),
            eq(schema.routeAlerts.routeDestination, listing.routeDestination),
            // Window overlap
            lte(schema.routeAlerts.windowStart, listing.departureAt),
            gte(schema.routeAlerts.windowEnd, listing.departureAt),
            // Price cap (null max_price = "any price")
            or(
              drizzleSql`${schema.routeAlerts.maxPricePence} IS NULL`,
              gte(schema.routeAlerts.maxPricePence, listing.currentPricePence)
            ),
            // Throttle
            or(
              drizzleSql`${schema.routeAlerts.lastMatchAt} IS NULL`,
              lte(schema.routeAlerts.lastMatchAt, cutoff)
            ),
            // Skip the user's own listings — sellers don't need alerts on
            // their own inventory.
            drizzleSql`${schema.routeAlerts.userId} != ${listing.sellerId}`
          )
        );
    });

    if (matchRows.length === 0) {
      return { matched: 0 };
    }

    const url = baseUrl();
    const listingForEmail = {
      id: listing.id,
      operator: listing.operator,
      routeOrigin: listing.routeOrigin,
      routeDestination: listing.routeDestination,
      departureAt: new Date(listing.departureAt),
      currentPricePence: listing.currentPricePence,
      originalPricePence: listing.originalPricePence,
    };

    // Fan out per match. Each match runs in its own step so retries don't
    // re-notify everyone, only the failed ones.
    const results: Array<{
      alertId: string;
      channels: { email: boolean; sms: boolean };
    }> = [];

    for (const row of matchRows) {
      const result = await step.run(`notify-${row.alert.id}`, async () => {
        const channels = { email: false, sms: false };

        if (row.alert.notifyEmail && row.user.email) {
          try {
            await sendListingAlertEmail({
              email: row.user.email,
              listing: listingForEmail,
              baseUrl: url,
            });
            channels.email = true;
          } catch (err) {
            console.error("[match-alerts] email failed", row.alert.id, err);
          }
        }

        if (row.alert.notifySms && row.user.phone) {
          const sms = await sendSms({
            to: row.user.phone,
            body: `LastLeg: ${listingForEmail.routeOrigin} → ${listingForEmail.routeDestination} · £${(listingForEmail.currentPricePence / 100).toFixed(2)} · ${url}/listings/${listingForEmail.id}`,
          });
          channels.sms = sms.ok;
        }

        // Update throttle so the next match doesn't fire for 15 min.
        const db = getDb();
        if (db) {
          await db
            .update(schema.routeAlerts)
            .set({ lastMatchAt: new Date(), updatedAt: new Date() })
            .where(eq(schema.routeAlerts.id, row.alert.id));

          await db.insert(schema.auditLog).values({
            actorUserId: null,
            action: "alert.match_notified",
            entityType: "route_alert",
            entityId: row.alert.id,
            payload: { listingId, channels },
          });
        }
        return { alertId: row.alert.id, channels };
      });
      results.push(result);
    }

    return {
      matched: results.length,
      results,
    };
  }
);
