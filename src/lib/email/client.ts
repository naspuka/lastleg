import { Resend } from "resend";

let cached: Resend | null = null;

/**
 * Lazy Resend client.
 *
 * Returns `null` when `RESEND_API_KEY` is unset so the app keeps booting
 * before email is provisioned (P0-10 setup is in SETUP.md §5). Call sites
 * must handle the null case.
 */
export function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!cached) cached = new Resend(key);
  return cached;
}

/**
 * The configured From address, falling back to a sensible default. Set
 * `RESEND_FROM` once a domain is verified in Resend.
 */
export function getFromAddress(): string {
  return process.env.RESEND_FROM ?? "LastLeg <onboarding@resend.dev>";
}
