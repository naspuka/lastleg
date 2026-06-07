import type { z } from "zod";

import type { operatorEnum } from "@/db/schema/enums";

// Operator enum values mirrored as a literal-string union so the rest of the
// app gets exhaustive type-checking when matching against operator values
// (Drizzle pgEnum doesn't natively give us this).
export type Operator = (typeof operatorEnum.enumValues)[number];

// What a parser pulls out of a PDF. Every field is optional except operator
// itself — that's how the registry decides whether the parser ran or not.
//
// Money in pence per the conventions doc. Dates in UTC.
export type ParsedTicket = {
  operator: Operator;
  bookingReference?: string | null;
  routeOrigin?: string | null;
  routeDestination?: string | null;
  departureAt?: Date | null;
  originalPricePence?: number | null;
  hasPassengerName?: boolean;
  passengerNameFirst?: string | null;
  // 0..1 — parser's self-reported confidence. Low confidence flags a listing
  // for manual review instead of auto-publish (per P2-09).
  confidence: number;
  // Free-form notes for human review when confidence is low.
  warnings?: string[];
};

// Input to every parser. The Blob URL is short-TTL; parsers must read it
// during the call window, not save it for later.
export type ParserInput = {
  blobUrl: string;
  // The seller-entered values from the form. The real parsers will treat
  // these as hints + cross-check against the PDF; the stub parser uses them
  // verbatim because there's no actual PDF read happening yet.
  hints: {
    operator: Operator;
    bookingReference?: string;
    routeOrigin?: string;
    routeDestination?: string;
    departureAt?: Date;
    originalPricePence?: number;
    hasPassengerName?: boolean;
    passengerNameFirst?: string;
  };
};

export type Parser = (input: ParserInput) => Promise<ParsedTicket>;

// Convenience for Zod schemas referencing the operator enum without
// duplicating its values.
export type ZodOperator = z.ZodEnum<{
  [K in Operator]: K;
}>;
