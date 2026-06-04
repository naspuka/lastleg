import { auth, currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";

import { getDb, schema } from "@/db/client";

// Server-side auth helpers. Wrap Clerk so call sites don't import Clerk
// directly — keeps the auth integration swap-ability and lets us add a
// "no Clerk configured" branch consistently.

/**
 * Returns the LastLeg `users` row for the currently-signed-in user, or null
 * if no session is active OR Clerk isn't configured yet.
 *
 * Reads the Clerk session → fetches our local row via clerk_user_id. The
 * local row is the source of truth for app-level data (role,
 * stripe_identity_verified_at, banned_at). Clerk owns the auth identity only.
 */
export async function getSessionUser(): Promise<
  typeof schema.users.$inferSelect | null
> {
  if (!process.env.CLERK_SECRET_KEY) return null;

  const { userId } = await auth();
  if (!userId) return null;

  const db = getDb();
  if (!db) return null;

  const rows = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.clerkUserId, userId))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Like `getSessionUser` but throws if no session is active. Use this in
 * route handlers / server actions that must run with an authenticated user;
 * the throw propagates to Next's not-found / unauthorised response handling.
 *
 * Throws an Error rather than redirecting because server actions can't
 * navigate. The caller should catch and translate to the appropriate UX.
 */
export async function requireSession(): Promise<
  typeof schema.users.$inferSelect
> {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("UNAUTHENTICATED");
  }
  return user;
}

/**
 * Read-only convenience for fetching Clerk's raw user object — handy in the
 * webhook sync path where we need email/phone fresh from Clerk, not from our
 * mirrored copy.
 */
export async function getClerkUserOrNull() {
  if (!process.env.CLERK_SECRET_KEY) return null;
  return currentUser();
}
