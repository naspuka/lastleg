"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { createClaimAction } from "@/app/_actions/claims";
import {
  CLAIM_REASON_LABEL,
  initialCreateClaimState,
  type ClaimReason,
} from "@/app/_actions/claim-types";

const REASONS: ClaimReason[] = [
  "denied_boarding_name_check",
  "denied_boarding_already_scanned",
  "operator_cancellation",
  "ticket_invalid",
  "seller_misconduct",
  "other",
];

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="lg"
      disabled={pending}
      className="bg-brand-coral text-brand-coral-foreground hover:bg-brand-coral-hover border-brand-coral h-11 w-full text-base"
    >
      {pending ? "Submitting…" : "File claim"}
    </Button>
  );
}

export function ClaimForm({ transactionId }: { transactionId: string }) {
  const [state, action] = useActionState(
    createClaimAction,
    initialCreateClaimState
  );

  if (state.status === "ok") {
    return (
      <div className="border-primary/20 bg-primary/5 rounded-xl border p-5">
        <p className="text-primary font-medium">Claim filed.</p>
        <p className="text-muted-foreground mt-1 text-sm">
          We&rsquo;ll review and respond within 48 hours.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5 rounded-2xl border bg-card p-5 sm:p-6">
      <input type="hidden" name="transactionId" value={transactionId} />
      <div>
        <Label className="text-base font-semibold">What went wrong?</Label>
        <div className="mt-3 space-y-2">
          {REASONS.map((r) => (
            <Label key={r} className="flex cursor-pointer items-center gap-3 font-normal">
              <input
                type="radio"
                name="reason"
                value={r}
                required
                className="size-4"
              />
              <span className="text-sm">{CLAIM_REASON_LABEL[r]}</span>
            </Label>
          ))}
        </div>
      </div>
      <div>
        <Label htmlFor="evidenceText">Anything else we should know? (optional)</Label>
        <Textarea
          id="evidenceText"
          name="evidenceText"
          rows={4}
          maxLength={2000}
          placeholder="e.g. The driver said the name didn't match and turned me away."
          className="mt-2"
        />
      </div>
      {state.status === "error" && (
        <p className="text-destructive text-sm" role="alert">
          {state.message}
        </p>
      )}
      <Submit />
    </form>
  );
}
