import { stubParser } from "./stub-parser";
import type { Operator, Parser, ParserInput } from "./types";

// Operator → parser dispatch table per P2-05. Each operator gets its own
// regex/heuristic parser as we acquire sample PDFs (P2-01/02). Until then
// every operator uses the stub which returns the form-hints verbatim.
//
// Adding a new operator's parser:
//   1. Add the operator value to operatorEnum (db/schema/enums.ts) + migration
//   2. Write src/lib/pdf-parsers/<operator>.ts implementing the Parser type
//   3. Wire it in here
//   4. Add 5+ real-ticket fixtures to tests/fixtures/pdf-<operator>/
//
// The fallback to stubParser ensures the registry never throws on an
// unhandled operator — useful while we're staged-rolling per-operator
// parsers without breaking other paths.
const PARSERS: Record<Operator, Parser> = {
  megabus: stubParser,
  flixbus: stubParser,
  national_express: stubParser,
  stagecoach: stubParser,
};

export async function parseTicket(input: ParserInput) {
  const parser = PARSERS[input.hints.operator] ?? stubParser;
  return parser(input);
}

export { stubParser };
export type { Operator, Parser, ParserInput };
export type { ParsedTicket } from "./types";
