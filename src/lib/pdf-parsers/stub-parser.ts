import type { Parser, ParsedTicket } from "./types";

// Stub parser used by every operator until we have real PDFs to write per-
// operator regex parsers against (P2-04/06/07/08).
//
// The vertical slice of Phase 2 (P2-11..17) needs SOME parser to call; this
// returns the seller's form-entered hints verbatim with confidence 0.6 so
// the verify-listing job exercises every status transition that real
// parsing will. Once real parsers ship, the registry picks them by operator
// and the stub is only used for development.
export const stubParser: Parser = async ({ hints }) => {
  const warnings: string[] = [];
  if (!hints.bookingReference) warnings.push("no booking reference in hints");
  if (!hints.departureAt) warnings.push("no departure time in hints");

  const result: ParsedTicket = {
    operator: hints.operator,
    bookingReference: hints.bookingReference ?? null,
    routeOrigin: hints.routeOrigin ?? null,
    routeDestination: hints.routeDestination ?? null,
    departureAt: hints.departureAt ?? null,
    originalPricePence: hints.originalPricePence ?? null,
    hasPassengerName: hints.hasPassengerName ?? false,
    passengerNameFirst: hints.passengerNameFirst ?? null,
    // 0.6 — high enough to auto-publish, low enough that a real parser
    // would obviously beat it. Lands listings in `live` rather than
    // ambiguous-review.
    confidence: 0.6,
    warnings: warnings.length ? warnings : undefined,
  };

  return result;
};
