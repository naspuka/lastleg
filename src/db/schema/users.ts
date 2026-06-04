import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { userRoleEnum } from "./enums";

// Source-of-truth user record. Auth identity lives in Clerk; this row is
// LastLeg's projection of it (kept in sync via the Clerk webhook in P1-09).
//
// Per D015: buyers only need email + verified phone; sellers additionally go
// through Stripe Identity (`stripe_identity_verified_at`) before any payout.
// We mirror the gating fields here so the listing/payout flows can decide
// without a round-trip to Stripe.
//
// Per D013: `stripe_connect_account_id` is null until a seller's first
// listing. It's NOT a hard signup requirement.
//
// Per D009 guarantee policy: `guarantee_claims_used` is the live counter the
// `process-claim` job reads to decide auto-approve vs. manual-review.
//
// Soft-delete semantics (§6 personal-data): right-to-deletion redacts
// PII and sets `deleted_at`, but the row stays so historical transactions
// keep referential integrity.
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Clerk handle — the value of `clerkUser.id` (e.g. `user_2sH3...`). Unique
    // because Clerk owns the auth side and we want a 1:1 mapping. Indexed
    // because we look users up by this on every authenticated request.
    clerkUserId: text("clerk_user_id").notNull().unique(),

    email: text("email").notNull(),
    phone: text("phone"),
    // Public display name. Per D015: buyers stay pseudonymous behind a handle.
    // Lowercased + unique so it can be linked to in URLs.
    handle: text("handle").notNull(),

    role: userRoleEnum("role").notNull().default("buyer"),

    // Stripe Connect Express account ID. Null until first listing per D013.
    stripeConnectAccountId: text("stripe_connect_account_id"),

    // Stripe Identity gate (D015): null until verified. Required before any
    // payout fires (release-payout job pre-checks this).
    stripeIdentityVerifiedAt: timestamp("stripe_identity_verified_at", {
      withTimezone: true,
    }),

    // Lifetime guarantee-fund claim counter per D009. Once it hits 2, further
    // claims route to manual review instead of auto-approve.
    guaranteeClaimsUsed: integer("guarantee_claims_used").notNull().default(0),

    // Set when an admin bans the user. Listings + transactions stay intact;
    // login is blocked at the middleware layer (P1-10).
    bannedAt: timestamp("banned_at", { withTimezone: true }),

    // Admin role for /admin/* routes. Defaults false; flipped manually by
    // owner via Drizzle Studio at MVP (no admin UI yet).
    isAdmin: boolean("is_admin").notNull().default(false),

    // Soft-delete marker (§6 GDPR). PII fields are redacted at deletion time.
    deletedAt: timestamp("deleted_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Email is unique among non-deleted rows only — a deleted user's email
    // shouldn't block a new signup. Implemented as a partial unique index.
    uniqueIndex("users_email_active_idx")
      .on(table.email)
      .where(sql`${table.deletedAt} IS NULL`),
    uniqueIndex("users_handle_active_idx")
      .on(table.handle)
      .where(sql`${table.deletedAt} IS NULL`),
    index("users_phone_idx").on(table.phone),
    index("users_role_idx").on(table.role),
  ]
);

export type UserRow = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;
