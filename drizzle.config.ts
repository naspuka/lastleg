import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Load env from .env.local first (Next.js convention, gitignored, holds the
// real DATABASE_URL on dev machines), then fall back to .env. Vercel /
// production sets DATABASE_URL on the environment directly and these calls
// are no-ops.
config({ path: ".env.local" });
config({ path: ".env" });

// Drizzle CLI configuration. Used by `pnpm db:generate` / `db:migrate` /
// `db:studio`. Runtime queries use src/db/client.ts directly.
export default defineConfig({
  schema: "./src/db/schema",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  verbose: true,
  strict: true,
});
