import { defineConfig } from "drizzle-kit";

// Drizzle CLI configuration. Used by `pnpm db:generate` / `db:migrate` /
// `db:studio`. Runtime queries use src/db/client.ts directly.
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  verbose: true,
  strict: true,
});
