import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

export { schema };

type Db = ReturnType<typeof drizzle<typeof schema>>;

let cached: Db | null = null;

/**
 * Lazy Drizzle client backed by Neon's HTTP driver.
 *
 * Returns `null` when `DATABASE_URL` is not set so the landing page can build
 * and the dev server can boot before Neon is provisioned (P0-04). Call sites
 * MUST handle the `null` case explicitly — the type system enforces this.
 */
export function getDb(): Db | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (!cached) {
    cached = drizzle(neon(url), { schema });
  }
  return cached;
}
