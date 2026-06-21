"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getDb, schema } from "@/db/client";
import { requireSession } from "@/lib/auth/session";

import type {
  CreateAlertFieldErrors,
  CreateAlertState,
} from "./alerts-types";

const pence = z
  .string()
  .trim()
  .optional()
  .transform((s) => {
    if (!s) return null;
    const m = s.match(/^(\d+)(?:\.(\d{1,2}))?$/);
    if (!m) return null;
    return parseInt(m[1]!, 10) * 100 + parseInt(((m[2] ?? "") + "00").slice(0, 2), 10);
  });

const schemaIn = z.object({
  routeOrigin: z.string().trim().min(2).max(80).transform((s) => s.toUpperCase()),
  routeDestination: z.string().trim().min(2).max(80).transform((s) => s.toUpperCase()),
  windowStart: z.string().min(1).transform((s) => new Date(s)),
  windowEnd: z.string().min(1).transform((s) => new Date(s)),
  maxPrice: pence,
  notifyEmail: z.union([z.literal("on"), z.literal("true")]).optional(),
  notifySms: z.union([z.literal("on"), z.literal("true")]).optional(),
  notifyPush: z.union([z.literal("on"), z.literal("true")]).optional(),
});

export async function createAlertAction(
  _prev: CreateAlertState,
  formData: FormData
): Promise<CreateAlertState> {
  const raw: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (typeof v === "string") raw[k] = v;

  let user;
  try {
    user = await requireSession();
  } catch {
    return {
      status: "error",
      fieldErrors: { routeOrigin: "Sign in first." },
      values: raw,
    };
  }

  const parsed = schemaIn.safeParse(raw);
  if (!parsed.success) {
    const errors: CreateAlertFieldErrors = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path[0];
      if (typeof k === "string" && !(k in errors)) {
        (errors as Record<string, string>)[k] = issue.message;
      }
    }
    return { status: "error", fieldErrors: errors, values: raw };
  }

  const data = parsed.data;
  if (data.windowEnd <= data.windowStart) {
    return {
      status: "error",
      fieldErrors: { windowEnd: "Window end must be after start." },
      values: raw,
    };
  }

  const notifyEmail = Boolean(data.notifyEmail);
  const notifySms = Boolean(data.notifySms);
  const notifyPush = Boolean(data.notifyPush);
  if (!notifyEmail && !notifySms && !notifyPush) {
    return {
      status: "error",
      fieldErrors: { channels: "Pick at least one channel." },
      values: raw,
    };
  }

  const db = getDb();
  if (!db) {
    return {
      status: "error",
      fieldErrors: { routeOrigin: "Server unavailable, try again." },
      values: raw,
    };
  }

  const rows = await db
    .insert(schema.routeAlerts)
    .values({
      userId: user.id,
      routeOrigin: data.routeOrigin,
      routeDestination: data.routeDestination,
      windowStart: data.windowStart,
      windowEnd: data.windowEnd,
      maxPricePence: data.maxPrice ?? null,
      notifyEmail,
      notifySms,
      notifyPush,
    })
    .returning({ id: schema.routeAlerts.id });

  revalidatePath("/alerts");
  return { status: "ok", alertId: rows[0]!.id };
}

export async function deleteAlertAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const user = await requireSession();
  const db = getDb();
  if (!db) return;
  await db
    .delete(schema.routeAlerts)
    .where(
      and(eq(schema.routeAlerts.id, id), eq(schema.routeAlerts.userId, user.id))
    );
  revalidatePath("/alerts");
}
