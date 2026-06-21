"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb, schema } from "@/db/client";
import { requireSession } from "@/lib/auth/session";
import { inngest } from "@/lib/inngest/client";
import { LIMITS, take } from "@/lib/rate-limit";

import type { ClaimReason, CreateClaimState } from "./claim-types";

const REASONS = new Set<ClaimReason>([
  "denied_boarding_name_check",
  "denied_boarding_already_scanned",
  "operator_cancellation",
  "ticket_invalid",
  "seller_misconduct",
  "other",
]);

export async function createClaimAction(
  _prev: CreateClaimState,
  formData: FormData
): Promise<CreateClaimState> {
  const raw: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (typeof v === "string") raw[k] = v;

  let user;
  try {
    user = await requireSession();
  } catch {
    return { status: "error", message: "Sign in first.", values: raw };
  }

  if (!take(`claim-create:${user.id}`, LIMITS.claimFile)) {
    return {
      status: "error",
      message: "Too many claims in a short window. Contact support.",
      values: raw,
    };
  }

  const transactionId = raw.transactionId ?? "";
  const reason = raw.reason as ClaimReason;
  const evidenceText = (raw.evidenceText ?? "").trim().slice(0, 2000);

  if (!REASONS.has(reason)) {
    return { status: "error", message: "Pick a reason.", values: raw };
  }
  if (!transactionId) {
    return { status: "error", message: "Missing transaction id.", values: raw };
  }

  const db = getDb();
  if (!db) {
    return { status: "error", message: "Server unavailable.", values: raw };
  }

  // Validate the transaction belongs to this user as buyer.
  const txRows = await db
    .select()
    .from(schema.transactions)
    .where(
      and(
        eq(schema.transactions.id, transactionId),
        eq(schema.transactions.buyerId, user.id)
      )
    )
    .limit(1);
  const tx = txRows[0];
  if (!tx) {
    return { status: "error", message: "Transaction not found.", values: raw };
  }
  if (tx.status === "refunded") {
    return {
      status: "error",
      message: "This transaction was already refunded.",
      values: raw,
    };
  }

  // Ensure no open claim already exists.
  const existing = await db
    .select({ id: schema.guaranteeClaims.id })
    .from(schema.guaranteeClaims)
    .where(eq(schema.guaranteeClaims.transactionId, transactionId))
    .limit(1);
  if (existing.length > 0) {
    return {
      status: "error",
      message: "A claim already exists for this transaction.",
      values: raw,
    };
  }

  // Mark the transaction's dispute_status open immediately so the
  // release-payout job halts on its next pre-check.
  await db
    .update(schema.transactions)
    .set({ disputeStatus: "open", updatedAt: new Date() })
    .where(eq(schema.transactions.id, transactionId));

  const claimRows = await db
    .insert(schema.guaranteeClaims)
    .values({
      transactionId,
      reason,
      evidenceText: evidenceText || null,
      status: "pending",
    })
    .returning({ id: schema.guaranteeClaims.id });
  const claimId = claimRows[0]!.id;

  await db.insert(schema.auditLog).values({
    actorUserId: user.id,
    action: "guarantee_claim.filed",
    entityType: "guarantee_claim",
    entityId: claimId,
    payload: { transactionId, reason },
  });

  await inngest.send({
    name: "guarantee/claim-filed",
    data: { claimId, transactionId },
  });

  revalidatePath(`/transactions/${transactionId}`);
  return { status: "ok", claimId };
}

export async function resolveClaimAction(formData: FormData) {
  const id = String(formData.get("claimId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const notes = String(formData.get("notes") ?? "").slice(0, 1000);

  const user = await requireSession();
  if (!user.isAdmin) throw new Error("admin only");

  if (!id || (decision !== "approve" && decision !== "reject")) return;

  const db = getDb();
  if (!db) return;

  const claimRows = await db
    .select()
    .from(schema.guaranteeClaims)
    .where(eq(schema.guaranteeClaims.id, id))
    .limit(1);
  const claim = claimRows[0];
  if (!claim) return;

  const txRows = await db
    .select()
    .from(schema.transactions)
    .where(eq(schema.transactions.id, claim.transactionId))
    .limit(1);
  const tx = txRows[0];
  if (!tx) return;

  const approve = decision === "approve";
  await db
    .update(schema.guaranteeClaims)
    .set({
      status: approve ? "approved" : "rejected",
      refundAmountPence: approve ? tx.pricePence + tx.buyerFeePence : 0,
      resolvedByUserId: user.id,
      resolvedAt: new Date(),
    })
    .where(eq(schema.guaranteeClaims.id, id));

  await db
    .update(schema.users)
    .set({
      guaranteeClaimsUsed: sql`${schema.users.guaranteeClaimsUsed} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(schema.users.id, tx.buyerId));

  await db
    .update(schema.transactions)
    .set({
      disputeStatus: approve ? "resolved_buyer" : "resolved_seller",
      status: approve ? "refunded" : tx.status,
      updatedAt: new Date(),
    })
    .where(eq(schema.transactions.id, claim.transactionId));

  await db.insert(schema.auditLog).values({
    actorUserId: user.id,
    action: approve ? "guarantee_claim.approved" : "guarantee_claim.rejected",
    entityType: "guarantee_claim",
    entityId: id,
    payload: { notes },
  });

  revalidatePath("/admin/claims");
}
