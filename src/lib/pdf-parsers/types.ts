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
  // The unique per-passenger ticket identifier (Distribusion's `Ticket #`,
  // e.g. `ETS20686328`). This is what the dup-detection invariant (operator,
  // booking_reference) UNIQUE index uses. NOTE: despite the column being
  // called `booking_reference`, we store the ticket # because that's what
  // makes each piece of inventory uniquely identifiable.
  bookingReference?: string | null;
  // Operator-side booking group id (Distribusion's `Booking #`,
  // e.g. `22520239`). Shared by every passenger on the same booking — used
  // to link siblings when we auto-split a multi-passenger PDF.
  bookingGroupId?: string | null;
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

// Input to every parser. Either a public blob URL the parser fetches, or
// raw bytes (used in tests + the same-request shortcut where the server
// action already has the file in memory).
export type ParserInput = {
  blobUrl?: string;
  bytes?: Uint8Array;
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

// Parsers return an ARRAY because Distribusion-style PDFs can carry
// multiple passenger tickets in one file. A single-ticket PDF returns a
// 1-element array. The verify-listing job decides what to do with extras:
// today it picks the one that matches the seller's form-entered ticket
// number; later it'll auto-split into sibling listings.
export type Parser = (input: ParserInput) => Promise<ParsedTicket[]>;
