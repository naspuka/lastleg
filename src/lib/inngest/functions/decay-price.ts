import { and, eq, gt, lte, sql } from "drizzle-orm";

import { getDb, schema } from "@/db/client";

import { inngest } from "../client";

// Price decay per D006 (P5-01).
// Every 5 minutes, step each live Listing's current_price_pence toward its
// floor_price_pence along a linear curve from list_price_pence at
// (departure - 4h) down to floor_price_pence at (departure - 30min).
//
// Outside that window the price is left alone:
//   - More than 4h before departure → still at list_price.
//   - Less than 30min before departure → already at floor.
//
// Implementation: one SQL update with a CASE expression so we touch each
// live row at most once per run. Idempotent: re-running mid-window yields
// the same target price.

const WINDOW_START_MS = 4 * 60 * 60 * 1000;
const WINDOW_END_MS = 30 * 60 * 1000;

export const decayPrice = inngest.createFunction(
  { id: "decay-price", triggers: [{ cron: "*/5 * * * *" }] },
  async ({ step }) => {
    const result = await step.run("apply-decay", async () => {
      const db = getDb();
      if (!db) return { updated: 0 };

      // Postgres: clamp progress to [0,1] and interpolate.
      //   progress = clamp((decayStart - now()) → over WINDOW_DURATION → 1)
      //   target   = list - (list - floor) * progress
      // We compute decayStart in epoch ms entirely in SQL for atomicity.
      const updated = await db.execute(sql`
        UPDATE listings
        SET current_price_pence = GREATEST(
          floor_price_pence,
          list_price_pence - ((list_price_pence - floor_price_pence) *
            LEAST(1.0, GREATEST(0.0,
              (EXTRACT(EPOCH FROM (now() - (departure_at - INTERVAL '4 hours')))
               / EXTRACT(EPOCH FROM (INTERVAL '3 hours 30 minutes')))
            ))::numeric
          )::integer
        ),
        updated_at = now()
        WHERE status = 'live'
          AND departure_at > now() + INTERVAL '30 minutes'
          AND current_price_pence > floor_price_pence
      `);
      return { updated: updated.rowCount ?? 0 };
    });

    // gt / lte imports referenced for future filters — keep them around.
    void gt;
    void lte;
    void eq;
    void and;

    return result;
  }
);
