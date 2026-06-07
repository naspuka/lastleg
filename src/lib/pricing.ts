// Money helpers per CONVENTIONS.md §Money. Everything stays in pence; only
// the display + input layers cross to/from pounds.

const GBP = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
});

/** Format an integer pence amount as `£24.00`. */
export function formatGBP(pence: number): string {
  return GBP.format(pence / 100);
}

/**
 * Parse a pounds-form input like `24` or `24.50` to integer pence (2400, 2450).
 * Returns null for empty/invalid input rather than throwing — caller decides
 * whether to surface as a form error.
 */
export function parseGBPInput(input: string): number | null {
  const trimmed = input.trim().replace(/^£/, "").replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  // Use string math to avoid the classic 24.10 * 100 floating-point trap.
  const [whole, frac = ""] = trimmed.split(".");
  const fracPadded = (frac + "00").slice(0, 2);
  return parseInt(whole!, 10) * 100 + parseInt(fracPadded, 10);
}

/**
 * Buyer fee per D007: £1 flat + 8% of the resale price, capped at £4.
 * Inputs and output in pence.
 */
export function buyerFeePence(pricePence: number): number {
  if (pricePence <= 0) return 0;
  const raw = 100 + Math.round(pricePence * 0.08);
  return Math.min(raw, 400);
}
