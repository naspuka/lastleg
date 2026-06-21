import type { guaranteeClaimReasonEnum } from "@/db/schema/enums";

export type ClaimReason = (typeof guaranteeClaimReasonEnum.enumValues)[number];

export type CreateClaimState =
  | { status: "idle" }
  | { status: "ok"; claimId: string }
  | {
      status: "error";
      message: string;
      values: Record<string, string>;
    };

export const initialCreateClaimState: CreateClaimState = { status: "idle" };

export const CLAIM_REASON_LABEL: Record<ClaimReason, string> = {
  denied_boarding_name_check: "Denied boarding — name check",
  denied_boarding_already_scanned: "Denied boarding — already scanned",
  operator_cancellation: "Operator cancelled the trip",
  ticket_invalid: "Ticket didn't scan / wasn't valid",
  seller_misconduct: "Seller misconduct",
  other: "Other",
};
