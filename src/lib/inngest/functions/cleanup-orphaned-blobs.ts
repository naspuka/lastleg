import { and, eq, inArray, lte, not, sql } from "drizzle-orm";

import { getDb, schema } from "@/db/client";

import { inngest } from "../client";

// P5-08 cleanup-orphaned-blobs.
// Daily cron. For every listing in a terminal status (withdrawn / rejected)
// whose last update was more than 7 days ago and which still has a
// ticket_pdf_blob_url, DELETE the blob and null the URL on the row.
//
// Why: keeps Vercel Blob storage costs predictable and reduces the surface
// area for an attacker who exfiltrates a stale blob URL.
// We deliberately exclude `expired` and `sold` because those listings'
// PDFs are part of the audit trail for ~30 days post-trip — Phase 7 will
// add a configurable retention sweep that handles those.

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export const cleanupOrphanedBlobs = inngest.createFunction(
  { id: "cleanup-orphaned-blobs", triggers: [{ cron: "30 3 * * *" }] },
  async ({ step }) => {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return { skipped: true, reason: "blob not configured" };
    }

    const rows = await step.run("find-orphaned", async () => {
      const db = getDb();
      if (!db) return [];
      const cutoff = new Date(Date.now() - SEVEN_DAYS_MS);
      return db
        .select({
          id: schema.listings.id,
          blobUrl: schema.listings.ticketPdfBlobUrl,
        })
        .from(schema.listings)
        .where(
          and(
            inArray(schema.listings.status, ["withdrawn", "rejected"]),
            lte(schema.listings.updatedAt, cutoff),
            not(sql`${schema.listings.ticketPdfBlobUrl} IS NULL`)
          )
        )
        .limit(100);
    });

    if (rows.length === 0) return { deleted: 0 };

    const { del } = await import("@vercel/blob");

    const results: Array<{ id: string; ok: boolean }> = [];
    for (const r of rows) {
      if (!r.blobUrl) continue;
      const result = await step.run(`del-${r.id}`, async () => {
        try {
          await del(r.blobUrl!);
          const db = getDb();
          if (db) {
            await db
              .update(schema.listings)
              .set({ ticketPdfBlobUrl: null, updatedAt: new Date() })
              .where(eq(schema.listings.id, r.id));
            await db.insert(schema.auditLog).values({
              actorUserId: null,
              action: "listing.blob_cleanup",
              entityType: "listing",
              entityId: r.id,
              payload: { url: r.blobUrl },
            });
          }
          return { id: r.id, ok: true };
        } catch (err) {
          console.error("[cleanup-blobs] failed", r.id, err);
          return { id: r.id, ok: false };
        }
      });
      results.push(result);
    }

    return { deleted: results.filter((r) => r.ok).length, total: rows.length };
  }
);
