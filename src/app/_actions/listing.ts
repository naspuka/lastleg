"use server";

import { getDb, schema } from "@/db/client";
import { requireSession } from "@/lib/auth/session";
import { uploadTicketPdf, BlobNotConfiguredError } from "@/lib/blob/client";
import { inngest } from "@/lib/inngest/client";
import { createListingSchema } from "@/lib/listing-schema";
import { LIMITS, take } from "@/lib/rate-limit";

import type {
  CreateListingFieldErrors,
  CreateListingState,
} from "./listing-types";

const MAX_PDF_BYTES = 5 * 1024 * 1024; // 5 MB per ARCHITECTURE §6 (file size).

// P2-12: persist a Listing in pending_verification + dispatch the
// verify-listing Inngest event. Returns a discriminated union so the
// client form can rehydrate on error.

export async function createListingAction(
  _prev: CreateListingState,
  formData: FormData
): Promise<CreateListingState> {
  const raw = formDataToRecord(formData);

  let user;
  try {
    user = await requireSession();
  } catch {
    return {
      status: "error",
      fieldErrors: { operator: "You need to sign in to list a ticket." },
      values: raw,
    };
  }

  if (!take(`listing-create:${user.id}`, LIMITS.listingCreate)) {
    return {
      status: "error",
      fieldErrors: {
        operator:
          "Too many listings today. The cap is 10 per user per 24 hours.",
      },
      values: raw,
    };
  }

  // Validate non-file fields first — cheapest to fail fast on bad input
  // before doing any blob I/O.
  const parsed = createListingSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: CreateListingFieldErrors = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !(key in fieldErrors)) {
        (fieldErrors as Record<string, string>)[key] = issue.message;
      }
    }
    return { status: "error", fieldErrors, values: raw };
  }

  // PDF validation.
  const pdf = formData.get("pdf");
  if (!(pdf instanceof File) || pdf.size === 0) {
    return {
      status: "error",
      fieldErrors: { pdf: "Upload your ticket PDF" },
      values: raw,
    };
  }
  if (pdf.size > MAX_PDF_BYTES) {
    return {
      status: "error",
      fieldErrors: {
        pdf: `That PDF is ${formatBytes(pdf.size)} — please keep it under 5 MB`,
      },
      values: raw,
    };
  }
  if (pdf.type && pdf.type !== "application/pdf") {
    return {
      status: "error",
      fieldErrors: { pdf: "That doesn't look like a PDF" },
      values: raw,
    };
  }

  const db = getDb();
  if (!db) {
    console.error("[listing] DB not configured");
    return {
      status: "error",
      fieldErrors: { operator: "Listings aren't ready yet — try again later." },
      values: raw,
    };
  }

  // Insert the listing row first with no blob URL so we have an id to scope
  // the upload path under. The verify-listing job won't be triggered until
  // after the blob is uploaded (separate audit-able step).
  let listingId: string;
  try {
    const rows = await db
      .insert(schema.listings)
      .values({
        sellerId: user.id,
        operator: parsed.data
          .operator as typeof schema.listings.$inferInsert.operator,
        routeOrigin: parsed.data.routeOrigin,
        routeDestination: parsed.data.routeDestination,
        departureAt: parsed.data.departureAt,
        originalPricePence: parsed.data.originalPricePence,
        listPricePence: parsed.data.listPricePence,
        floorPricePence: parsed.data.floorPricePence,
        currentPricePence: parsed.data.listPricePence,
        bookingReference: parsed.data.bookingReference,
        hasPassengerName: parsed.data.hasPassengerName,
        passengerNameFirst: parsed.data.passengerNameFirst ?? null,
        status: "pending_verification",
        verificationStatus: "pending",
        expiresAt: parsed.data.departureAt,
      })
      .returning({ id: schema.listings.id });
    listingId = rows[0]!.id;
  } catch (err) {
    console.error("[listing] insert failed", err);
    return {
      status: "error",
      fieldErrors: {
        operator: "Couldn't save the listing — try again in a moment.",
      },
      values: raw,
    };
  }

  // Upload the PDF. If blob isn't configured (dev / £0 path), we skip the
  // upload and let verify-listing run against an empty blob URL — the stub
  // parser doesn't actually read the file. Real parsers in P2-04+ will
  // require the upload.
  let blobUrl: string | null = null;
  try {
    const buf = await pdf.arrayBuffer();
    const uploaded = await uploadTicketPdf({
      pathname: `listings/${listingId}/ticket.pdf`,
      body: buf,
      contentType: "application/pdf",
    });
    blobUrl = uploaded.url;
  } catch (err) {
    if (err instanceof BlobNotConfiguredError) {
      console.warn(
        "[listing] blob not configured; saving listing without PDF URL"
      );
    } else {
      console.error("[listing] blob upload failed", err);
      return {
        status: "error",
        fieldErrors: { pdf: "Couldn't store the PDF — try again." },
        values: raw,
      };
    }
  }

  if (blobUrl) {
    await db
      .update(schema.listings)
      .set({ ticketPdfBlobUrl: blobUrl, updatedAt: new Date() })
      .where(eqListingId(listingId));
  }

  // Audit + fire-off verification.
  await db.insert(schema.auditLog).values({
    actorUserId: user.id,
    action: "listing.created",
    entityType: "listing",
    entityId: listingId,
    payload: { hasBlob: blobUrl !== null, notes: parsed.data.notes },
  });

  try {
    await inngest.send({
      name: "listing/verify-requested",
      data: { listingId },
    });
  } catch (err) {
    // Non-fatal: the listing exists, we just couldn't queue verification.
    // A retry pathway (admin requeue button or a periodic sweep) lives in
    // Phase 5 hardening. For now we log and continue.
    console.error("[listing] failed to enqueue verify-listing", err);
  }

  return { status: "ok", listingId };
}

function formDataToRecord(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (typeof v === "string") {
      out[k] = v;
    }
  }
  return out;
}

function formatBytes(n: number) {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${n} B`;
}

// Imported here rather than at the top of the file because drizzle-orm
// `eq()` collides naming-wise with our existing imports. Inlined small
// helper keeps the diff to one symbol.
import { eq } from "drizzle-orm";
function eqListingId(id: string) {
  return eq(schema.listings.id, id);
}
