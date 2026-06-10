import { distribusionParser } from "./distribusion";
import { stubParser } from "./stub-parser";
import type { Parser, ParserInput, ParsedTicket } from "./types";

// Parser dispatch per P2-05.
//
// Strategy: try the Distribusion parser first. It white-labels for Megabus,
// FlixBus, and several smaller operators, so a single deterministic parser
// covers most UK coach inventory we'll see. If it can't identify the
// format (confidence 0), fall back to per-operator parsers or, ultimately,
// the stub.
//
// LLM fallback (Claude Haiku structured extraction) slots into the chain
// here once we add it — between deterministic parsers and the stub.

const PARSERS: Parser[] = [
  distribusionParser,
  // (national-express parser, stagecoach parser slot in here)
  stubParser,
];

export async function parseTicket(input: ParserInput): Promise<ParsedTicket[]> {
  // Try parsers in order. First one to come back with confidence > 0 on at
  // least one ticket wins; otherwise fall through to the next.
  for (const parser of PARSERS) {
    const result = await parser(input);
    if (result.some((t) => t.confidence > 0)) {
      return result;
    }
  }
  // All parsers refused — return stub's "passthrough" result so the
  // verify-listing job has something to work with for manual review.
  return stubParser(input);
}

export { stubParser, distribusionParser };
export type { Operator, Parser, ParserInput } from "./types";
export type { ParsedTicket } from "./types";
