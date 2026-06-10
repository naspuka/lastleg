import type { Parser } from "./types";

// Stub parser used as a fallback when no real per-operator parser matches.
// Returns the seller's form-entered hints verbatim, wrapped in a single-
// ticket array. Confidence 0.6 — just above the auto-publish threshold so
// the dev vertical-slice still works for operators we don't yet parse.
//
// Real per-operator parsers (Distribusion, National Express, Stagecoach)
// supersede this whenever they can identify the format.
export const stubParser: Parser = async ({ hints }) => {
  const warnings: string[] = [];
  if (!hints.bookingReference) warnings.push("no booking reference in hints");
  if (!hints.departureAt) warnings.push("no departure time in hints");

  return [
    {
      operator: hints.operator,
      bookingReference: hints.bookingReference ?? null,
      bookingGroupId: null,
      routeOrigin: hints.routeOrigin ?? null,
      routeDestination: hints.routeDestination ?? null,
      departureAt: hints.departureAt ?? null,
      originalPricePence: hints.originalPricePence ?? null,
      hasPassengerName: hints.hasPassengerName ?? false,
      passengerNameFirst: hints.passengerNameFirst ?? null,
      confidence: 0.6,
      warnings: warnings.length ? warnings : undefined,
    },
  ];
};
