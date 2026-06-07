import type { CreateListingInput } from "@/lib/listing-schema";

export type CreateListingFieldErrors = Partial<
  Record<keyof CreateListingInput | "pdf", string>
>;

// Discriminated union returned by createListingAction. Lives in a separate
// (non "use server") file per the conventions doc — see CONVENTIONS.md
// §Server actions on why this matters.
export type CreateListingState =
  | { status: "idle" }
  | { status: "ok"; listingId: string }
  | {
      status: "error";
      fieldErrors: CreateListingFieldErrors;
      // Echo the raw inputs back so the form rehydrates after an error.
      values: Record<string, string>;
    };

export const initialCreateListingState: CreateListingState = { status: "idle" };
