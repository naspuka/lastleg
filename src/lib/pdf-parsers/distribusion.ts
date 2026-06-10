import type { Operator, Parser, ParsedTicket } from "./types";

// Distribusion is the white-label ticket platform behind Megabus UK,
// FlixBus, and several smaller European coach operators. Their PDFs share
// a single structured format with labelled fields like:
//
//   Booking #:        22520239
//   Ticket #:         ETS20686328
//   Price:            11.99 £
//   Operated by:      megabus
//   Date:             Sat 8 Nov 2025
//   Time:             03:30
//   Departure station ...
//   Arrival station   ...
//   Passenger:        Olajide, Nasrullah Afolabi (Adult)
//
// Each PASSENGER gets one page; multi-passenger bookings have one page per
// person. This parser walks the pages and returns one ParsedTicket per
// page. Confidence is a function of how many required fields landed.
//
// The text extraction uses pdfjs-dist's legacy ESM build, which works in
// Node serverless functions without canvas (we only need text). All
// pdfjs imports are dynamic so this module is safe to import from edge-
// adjacent code paths that strip Node-only deps.

// Map between Distribusion's "Operated by" text and our operator enum.
const OPERATOR_TEXT_MAP: Record<string, Operator> = {
  megabus: "megabus",
  flixbus: "flixbus",
  "flix bus": "flixbus",
  "national express": "national_express",
  stagecoach: "stagecoach",
};

function mapOperator(text: string | null): Operator | null {
  if (!text) return null;
  const cleaned = text.trim().toLowerCase();
  if (cleaned in OPERATOR_TEXT_MAP) return OPERATOR_TEXT_MAP[cleaned]!;
  for (const [k, v] of Object.entries(OPERATOR_TEXT_MAP)) {
    if (cleaned.includes(k)) return v;
  }
  return null;
}

// "11.99 £" / "£11.99" / "11.99 GBP" → pence integer.
function parsePoundsToPence(text: string | null | undefined): number | null {
  if (!text) return null;
  const m = text.match(/(\d+(?:\.\d{1,2})?)/);
  if (!m) return null;
  const [whole, frac = ""] = m[1]!.split(".");
  return parseInt(whole!, 10) * 100 + parseInt((frac + "00").slice(0, 2), 10);
}

// "Sat 8 Nov 2025" + "03:30" → Date in Europe/London. We don't try to be
// clever about DST; departure_at is stored UTC and the UI renders in
// Europe/London (CONVENTIONS §Time).
const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

function parseDateTime(
  dateText: string | null | undefined,
  timeText: string | null | undefined
): Date | null {
  if (!dateText || !timeText) return null;

  // Try patterns richest-first. A single alternation regex doesn't work
  // because the shorter alternatives match too eagerly (e.g. `Sat 8` from
  // `Sat 8 Nov 2025` was being picked up before the year part could match).
  let day: number | null = null;
  let month: number | null = null;
  let year: number | null = null;

  // "DD Mon YYYY" or "Sat DD Mon YYYY" — preferred, has all three fields
  const dmy = dateText.match(/(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})/);
  if (dmy) {
    day = parseInt(dmy[1]!, 10);
    month = MONTHS[dmy[2]!.slice(0, 3).toLowerCase()] ?? null;
    year = parseInt(dmy[3]!, 10);
  } else {
    // "Mon DD YYYY"
    const mdy = dateText.match(/([A-Za-z]{3,9})\s+(\d{1,2})\s+(\d{4})/);
    if (mdy) {
      month = MONTHS[mdy[1]!.slice(0, 3).toLowerCase()] ?? null;
      day = parseInt(mdy[2]!, 10);
      year = parseInt(mdy[3]!, 10);
    } else {
      // "Mon DD" — no year, assume current (end-of-year tickets in
      // November will rarely sneak through the year boundary, but worth
      // a follow-up if we see it).
      const md = dateText.match(/([A-Za-z]{3,9})\s+(\d{1,2})/);
      if (md) {
        month = MONTHS[md[1]!.slice(0, 3).toLowerCase()] ?? null;
        day = parseInt(md[2]!, 10);
        year = new Date().getUTCFullYear();
      }
    }
  }

  if (day == null || month == null || year == null) return null;

  const timeMatch = timeText.match(/(\d{1,2}):(\d{2})/);
  if (!timeMatch) return null;
  const hh = parseInt(timeMatch[1]!, 10);
  const mm = parseInt(timeMatch[2]!, 10);

  // Treat as UK local time. Construct a UTC date that maps to the same
  // wall-clock minute in Europe/London. The naive approach (Date.UTC) is
  // accurate enough — we're not optimising for the BST-transition hour.
  return new Date(Date.UTC(year, month, day, hh, mm));
}

// Walks the labelled key-value pairs we got from pdfjs.
//
// pdfjs returns text items as a stream of small fragments. Distribusion
// PDFs put labels and values as adjacent fragments separated by whitespace
// fragments, e.g.:
//   ["Booking #:", "", "22520239"]
//   ["Ticket #:",  "", "ETS20686328"]
//
// We treat the stream as a tokenised log and extract by label-following.
// `preferLongest` collects every match and returns the one with the most
// content — useful for fields like Date that appear once in shorthand
// ("Nov 08") and once with full info ("Sat 8 Nov 2025") on the same page.
function fieldAfter(
  tokens: string[],
  labels: string[],
  preferLongest = false
): string | null {
  const matches: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!.trim().toLowerCase().replace(/[:#]/g, "").trim();
    for (const label of labels) {
      if (token === label) {
        for (let j = i + 1; j < Math.min(i + 6, tokens.length); j++) {
          const candidate = tokens[j]!.trim();
          if (candidate) {
            matches.push(candidate);
            break;
          }
        }
      }
    }
  }
  if (matches.length === 0) return null;
  if (!preferLongest) return matches[0]!;
  return matches.reduce((a, b) => (b.length > a.length ? b : a));
}

// Find the "Departure station" / "Arrival station" sections: those labels
// appear once per page, followed by 1–3 text items containing the station
// name + secondary address line.
function stationAfter(
  tokens: string[],
  label: "departure" | "arrival"
): string | null {
  const target = `${label} station`;
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]!.trim().toLowerCase();
    if (tok === target) {
      // Skip empty fragments, take next non-empty
      for (let j = i + 1; j < Math.min(i + 4, tokens.length); j++) {
        const c = tokens[j]!.trim();
        if (c) return c;
      }
    }
  }
  return null;
}

// Distribusion passenger labels: "Olajide, Nasrullah Afolabi (Adult)" or
// "Olajide, Nasrullah Afolabi". Returns first-name only for D016
// data-minimisation: we never store the full name.
function extractPassengerFirstName(
  passengerText: string | null
): string | null {
  if (!passengerText) return null;
  // "Last, First Middle (Adult)" — strip parens and split on comma
  const cleaned = passengerText.replace(/\(.*?\)/g, "").trim();
  const parts = cleaned
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;
  const givenNames = parts[1]!.trim().split(/\s+/);
  return givenNames[0] ?? null;
}

type PageTokens = { tokens: string[] };

async function loadPdf(input: { blobUrl?: string; bytes?: Uint8Array }) {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  let data: Uint8Array;
  if (input.bytes) {
    data = input.bytes;
  } else if (input.blobUrl) {
    const res = await fetch(input.blobUrl);
    if (!res.ok) throw new Error(`fetch ${input.blobUrl}: ${res.status}`);
    data = new Uint8Array(await res.arrayBuffer());
  } else {
    throw new Error("either blobUrl or bytes required");
  }
  // Don't load fonts (no rendering); don't eval (security). isEvalSupported
  // isn't in the public typings but is honoured at runtime, so the cast.
  return pdfjsLib.getDocument({
    data,
    useSystemFonts: false,
    disableFontFace: true,
    isEvalSupported: false,
  } as Parameters<typeof pdfjsLib.getDocument>[0]).promise;
}

async function tokensPerPage(input: {
  blobUrl?: string;
  bytes?: Uint8Array;
}): Promise<PageTokens[]> {
  const doc = await loadPdf(input);
  const out: PageTokens[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    out.push({
      tokens: content.items
        .map((item) => ("str" in item ? (item.str as string) : ""))
        .filter((s) => s.length > 0),
    });
  }
  return out;
}

// Best-effort signal that the PDF really is Distribusion-issued. We bail
// early with low confidence when we don't see the tell, so the registry
// can fall back to another parser.
function isDistribusionFormat(allTokens: string[]): boolean {
  return allTokens.some((t) => /distribusion/i.test(t));
}

export const distribusionParser: Parser = async (input) => {
  let pages: PageTokens[];
  try {
    pages = await tokensPerPage(input);
  } catch (err) {
    return [
      {
        operator: input.hints.operator,
        confidence: 0,
        warnings: [
          `pdf-load-failed: ${err instanceof Error ? err.message : String(err)}`,
        ],
      },
    ];
  }

  // Sanity check: did this look like Distribusion at all? If not, return a
  // zero-confidence result so the registry falls back.
  const allTokens = pages.flatMap((p) => p.tokens);
  if (!isDistribusionFormat(allTokens)) {
    return [
      {
        operator: input.hints.operator,
        confidence: 0,
        warnings: ["not a distribusion ticket"],
      },
    ];
  }

  const tickets: ParsedTicket[] = [];

  for (const { tokens } of pages) {
    const ticketNumber = fieldAfter(tokens, ["ticket"]);
    const bookingGroup = fieldAfter(tokens, ["booking"]);
    const priceText = fieldAfter(tokens, ["price"]);
    const operatedBy = fieldAfter(tokens, ["operated by"]);
    // Date appears twice per Distribusion page — the header uses "Nov 08"
    // (no year), the footer uses "Sat 8 Nov 2025" (with year). Pick the
    // longest match so we always get the year-bearing version.
    const dateText = fieldAfter(tokens, ["date"], true);
    const timeText = fieldAfter(tokens, ["time"]);
    const passengerText = fieldAfter(tokens, ["passenger"]);

    const departure = stationAfter(tokens, "departure");
    const arrival = stationAfter(tokens, "arrival");

    const operator = mapOperator(operatedBy) ?? input.hints.operator;
    const departureAt = parseDateTime(dateText, timeText);
    const originalPricePence = parsePoundsToPence(priceText);
    const passengerFirst = extractPassengerFirstName(passengerText);

    // Confidence scoring: tally signals that landed.
    const signals = [
      Boolean(ticketNumber),
      Boolean(operator),
      Boolean(departureAt),
      Boolean(originalPricePence),
      Boolean(departure),
      Boolean(arrival),
    ];
    const hit = signals.filter(Boolean).length;
    const confidence = hit / signals.length;

    const warnings: string[] = [];
    if (!ticketNumber) warnings.push("missing ticket number");
    if (!operator) warnings.push("missing operator");
    if (!departureAt) warnings.push("missing departure date/time");
    if (!originalPricePence) warnings.push("missing price");

    tickets.push({
      operator,
      bookingReference: ticketNumber ?? null,
      bookingGroupId: bookingGroup ?? null,
      routeOrigin: departure ?? null,
      routeDestination: arrival ?? null,
      departureAt: departureAt ?? null,
      originalPricePence: originalPricePence ?? null,
      hasPassengerName: Boolean(passengerFirst),
      passengerNameFirst: passengerFirst,
      confidence,
      warnings: warnings.length ? warnings : undefined,
    });
  }

  return tickets;
};
