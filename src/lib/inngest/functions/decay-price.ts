import { sql } from "drizzle-orm";

import { getDb } from "@/db/client";

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
// Implementation: one SQL UPDATE so the entire decay step is atomic.
// Idempotent: re-running mid-window yields the same target price.

export const decayPrice = inngest.createFunction(
  { id: "decay-price", triggers: [{ cron: "*/5 * * * *" }] },
  async ({ step }) => {
    return step.run("apply-decay", async () => {
      const db = getDb();
      if (!db) return { updated: 0 };

      await db.execute(sql`
        UPDATE listings
        SET current_price_pence = GREATEST(
          floor_price_pence,
          (list_price_pence - ((list_price_pence - floor_price_pence) *
            LEAST(1.0, GREATEST(0.0,
              (EXTRACT(EPOCH FROM (now() - (departure_at - INTERVAL '4 hours')))
               / EXTRACT(EPOCH FROM (INTERVAL '3 hours 30 minutes')))
            ))::numeric
          ))::integer
        ),
        updated_at = now()
        WHERE status = 'live'
          AND departure_at > now() + INTERVAL '30 minutes'
          AND current_price_pence > floor_price_pence
      `);
      return { ok: true };
    });
  }
);
