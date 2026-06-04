import { z } from "zod";
import { ROUTE_SLUGS } from "./routes";

export const ROLES = ["buyer", "seller", "both"] as const;
export type Role = (typeof ROLES)[number];

// UK phone numbers only at MVP (per D003 + D017). Loose E.164-ish validation;
// the canonical normalisation happens server-side before insert.
const UK_PHONE_RE = /^(\+44|0)\d{9,10}$/;

export const waitlistSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  phone: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === "" ? undefined : v))
    .refine((v) => v === undefined || UK_PHONE_RE.test(v.replace(/\s+/g, "")), {
      message: "Enter a UK phone number (e.g. 07700 900123 or +447700900123)",
    }),
  role: z.enum(ROLES, { message: "Pick one" }),
  routes: z
    .array(z.enum(ROUTE_SLUGS as [string, ...string[]]))
    .min(1, "Pick at least one route"),
});

export type WaitlistInput = z.infer<typeof waitlistSchema>;
