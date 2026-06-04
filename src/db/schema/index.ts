// Barrel re-export so callers can do `import { schema } from "@/db/client"`
// and reach every table from one identifier. Drizzle's config glob picks up
// every file in this directory for migration generation, so adding a new
// table is: drop a new file in src/db/schema/, re-export here, run
// `pnpm db:generate`.

export * from "./enums";
export * from "./users";
export * from "./listings";
export * from "./transactions";
export * from "./alerts";
export * from "./audit";
export * from "./waitlist";
