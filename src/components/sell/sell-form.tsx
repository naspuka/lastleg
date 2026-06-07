"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { FileText, Info, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { createListingAction } from "@/app/_actions/listing";
import {
  initialCreateListingState,
  type CreateListingFieldErrors,
  type CreateListingState,
} from "@/app/_actions/listing-types";
import { cn } from "@/lib/utils";

const OPERATORS = [
  { value: "megabus", label: "Megabus" },
  { value: "national_express", label: "National Express" },
  { value: "flixbus", label: "FlixBus" },
  { value: "stagecoach", label: "Stagecoach" },
] as const;

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="text-destructive mt-1 text-xs" role="alert">
      {message}
    </p>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="lg"
      disabled={pending}
      className="bg-brand-coral text-brand-coral-foreground hover:bg-brand-coral-hover border-brand-coral h-12 w-full text-base"
    >
      {pending ? "Listing…" : "List this ticket"}
    </Button>
  );
}

function err(state: CreateListingState, key: keyof CreateListingFieldErrors) {
  return state.status === "error" ? state.fieldErrors[key] : undefined;
}

function rehydrate(state: CreateListingState, key: string): string {
  return state.status === "error" ? (state.values[key] ?? "") : "";
}

export function SellForm() {
  const router = useRouter();
  const [state, formAction] = useActionState(
    createListingAction,
    initialCreateListingState
  );

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [hasName, setHasName] = useState(false);

  // On success, kick the seller to the dashboard so they can watch the
  // listing flip from pending_verification → live. We do this client-side
  // so the form's success state stays in their browser history.
  if (state.status === "ok") {
    router.replace(`/sell?ok=${state.listingId}`);
  }

  return (
    <form
      action={formAction}
      className="space-y-10"
      encType="multipart/form-data"
    >
      {/* ─── PDF upload ─────────────────────────────────────────────────── */}
      <section>
        <h2 className="font-heading text-xl font-semibold tracking-tight">
          Upload your ticket
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          PDF only, 5 MB max. We&rsquo;ll parse the details automatically — for
          now you also fill them in below.
        </p>
        <label
          htmlFor="pdf"
          className={cn(
            "mt-4 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
            "border-border hover:border-primary/40 hover:bg-muted/40",
            fileName && "border-primary/60 bg-primary/5 hover:bg-primary/5",
            err(state, "pdf") && "border-destructive/60 bg-destructive/5"
          )}
        >
          {fileName ? (
            <>
              <FileText className="text-primary size-7" />
              <div className="text-sm">
                <span className="font-medium">{fileName}</span>
                <span className="text-muted-foreground ml-2">
                  — click to swap
                </span>
              </div>
            </>
          ) : (
            <>
              <Upload className="text-muted-foreground size-7" />
              <div className="text-sm">
                <span className="font-medium">Choose a PDF</span>
                <span className="text-muted-foreground"> or drag it here</span>
              </div>
            </>
          )}
          <input
            id="pdf"
            ref={fileInputRef}
            name="pdf"
            type="file"
            accept="application/pdf"
            className="sr-only"
            required
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          />
        </label>
        <FieldError message={err(state, "pdf")} />
      </section>

      {/* ─── Ticket details ─────────────────────────────────────────────── */}
      <section>
        <h2 className="font-heading text-xl font-semibold tracking-tight">
          About the ticket
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          These will be auto-extracted from your PDF when our parser ships — for
          now please fill them in.
        </p>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="operator">Operator</Label>
            <select
              id="operator"
              name="operator"
              required
              defaultValue={rehydrate(state, "operator") || ""}
              className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 mt-2 h-9 w-full rounded-md border px-3 text-sm transition-colors outline-none focus-visible:ring-3"
            >
              <option value="" disabled>
                Pick one
              </option>
              {OPERATORS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <FieldError message={err(state, "operator")} />
          </div>

          <div>
            <Label htmlFor="bookingReference">Booking reference</Label>
            <Input
              id="bookingReference"
              name="bookingReference"
              required
              placeholder="e.g. MGB-12345"
              defaultValue={rehydrate(state, "bookingReference")}
              className="mt-2 uppercase"
            />
            <FieldError message={err(state, "bookingReference")} />
          </div>

          <div>
            <Label htmlFor="routeOrigin">From</Label>
            <Input
              id="routeOrigin"
              name="routeOrigin"
              required
              placeholder="London Victoria"
              defaultValue={rehydrate(state, "routeOrigin")}
              className="mt-2"
            />
            <FieldError message={err(state, "routeOrigin")} />
          </div>

          <div>
            <Label htmlFor="routeDestination">To</Label>
            <Input
              id="routeDestination"
              name="routeDestination"
              required
              placeholder="Manchester"
              defaultValue={rehydrate(state, "routeDestination")}
              className="mt-2"
            />
            <FieldError message={err(state, "routeDestination")} />
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="departureAt">Departure</Label>
            <Input
              id="departureAt"
              name="departureAt"
              type="datetime-local"
              required
              defaultValue={rehydrate(state, "departureAt")}
              className="mt-2"
            />
            <FieldError message={err(state, "departureAt")} />
          </div>
        </div>
      </section>

      {/* ─── Pricing ─────────────────────────────────────────────────────── */}
      <section>
        <h2 className="font-heading text-xl font-semibold tracking-tight">
          Your price
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Capped at what you originally paid. We&rsquo;ll step the price down
          automatically as departure approaches, until it hits your floor.
        </p>

        <div className="mt-5 grid gap-5 sm:grid-cols-3">
          <div>
            <Label htmlFor="originalPricePence">You paid (£)</Label>
            <Input
              id="originalPricePence"
              name="originalPricePence"
              required
              inputMode="decimal"
              placeholder="24"
              defaultValue={rehydrate(state, "originalPricePence")}
              className="mt-2"
            />
            <FieldError message={err(state, "originalPricePence")} />
          </div>
          <div>
            <Label htmlFor="listPricePence">Asking (£)</Label>
            <Input
              id="listPricePence"
              name="listPricePence"
              required
              inputMode="decimal"
              placeholder="18"
              defaultValue={rehydrate(state, "listPricePence")}
              className="mt-2"
            />
            <FieldError message={err(state, "listPricePence")} />
          </div>
          <div>
            <Label htmlFor="floorPricePence">Floor (£)</Label>
            <Input
              id="floorPricePence"
              name="floorPricePence"
              required
              inputMode="decimal"
              placeholder="6"
              defaultValue={rehydrate(state, "floorPricePence")}
              className="mt-2"
            />
            <FieldError message={err(state, "floorPricePence")} />
          </div>
        </div>
        <div className="text-muted-foreground bg-muted/40 mt-4 flex items-start gap-2 rounded-lg p-3 text-xs">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          <p>
            Floor is the lowest the price will ever drop to. We&rsquo;ll keep
            stepping down from &ldquo;asking&rdquo; until either the ticket
            sells or it hits this floor.
          </p>
        </div>
      </section>

      {/* ─── Passenger name ─────────────────────────────────────────────── */}
      <section>
        <h2 className="font-heading text-xl font-semibold tracking-tight">
          Driver checks
        </h2>
        <Label
          htmlFor="hasPassengerName"
          className="mt-4 flex cursor-pointer items-start gap-3 font-normal"
        >
          <Checkbox
            id="hasPassengerName"
            name="hasPassengerName"
            checked={hasName}
            onCheckedChange={(v) => setHasName(Boolean(v))}
          />
          <span className="text-sm">
            This ticket has a passenger name printed on it
            <span className="text-muted-foreground mt-0.5 block text-xs">
              We&rsquo;ll show the buyer your first name at checkout. They
              decide to take the risk.
            </span>
          </span>
        </Label>

        {hasName && (
          <div className="mt-4">
            <Label htmlFor="passengerNameFirst">First name on ticket</Label>
            <Input
              id="passengerNameFirst"
              name="passengerNameFirst"
              placeholder="Sarah"
              defaultValue={rehydrate(state, "passengerNameFirst")}
              className="mt-2 max-w-sm"
            />
            <FieldError message={err(state, "passengerNameFirst")} />
          </div>
        )}
      </section>

      {/* ─── Notes ─────────────────────────────────────────────────────── */}
      <section>
        <Label htmlFor="notes" className="text-base">
          Notes for the buyer{" "}
          <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Textarea
          id="notes"
          name="notes"
          placeholder="Anything they should know — e.g. seat allocation, luggage allowance"
          maxLength={500}
          rows={3}
          defaultValue={rehydrate(state, "notes")}
          className="mt-2"
        />
        <FieldError message={err(state, "notes")} />
      </section>

      <Submit />
    </form>
  );
}
