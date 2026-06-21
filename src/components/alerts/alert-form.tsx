"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createAlertAction } from "@/app/_actions/alerts";
import {
  initialCreateAlertState,
  type CreateAlertFieldErrors,
  type CreateAlertState,
} from "@/app/_actions/alerts-types";

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p className="text-destructive mt-1 text-xs" role="alert">
      {msg}
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
      className="bg-brand-coral text-brand-coral-foreground hover:bg-brand-coral-hover border-brand-coral h-11 w-full text-base"
    >
      {pending ? "Saving…" : "Save alert"}
    </Button>
  );
}

function err(s: CreateAlertState, k: keyof CreateAlertFieldErrors) {
  return s.status === "error" ? s.fieldErrors[k] : undefined;
}

function val(s: CreateAlertState, k: string): string {
  return s.status === "error" ? (s.values[k] ?? "") : "";
}

export function AlertForm() {
  const router = useRouter();
  const [state, action] = useActionState(
    createAlertAction,
    initialCreateAlertState
  );

  if (state.status === "ok") router.refresh();

  return (
    <form action={action} className="space-y-5 rounded-2xl border bg-card p-5 sm:p-6">
      <h2 className="font-heading text-lg font-semibold">New alert</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="routeOrigin">From</Label>
          <Input
            id="routeOrigin"
            name="routeOrigin"
            required
            placeholder="MANCHESTER"
            defaultValue={val(state, "routeOrigin")}
            className="mt-1.5 uppercase"
          />
          <FieldError msg={err(state, "routeOrigin")} />
        </div>
        <div>
          <Label htmlFor="routeDestination">To</Label>
          <Input
            id="routeDestination"
            name="routeDestination"
            required
            placeholder="LONDON"
            defaultValue={val(state, "routeDestination")}
            className="mt-1.5 uppercase"
          />
          <FieldError msg={err(state, "routeDestination")} />
        </div>
        <div>
          <Label htmlFor="windowStart">From date</Label>
          <Input
            id="windowStart"
            name="windowStart"
            type="datetime-local"
            required
            defaultValue={val(state, "windowStart")}
            className="mt-1.5"
          />
          <FieldError msg={err(state, "windowStart")} />
        </div>
        <div>
          <Label htmlFor="windowEnd">To date</Label>
          <Input
            id="windowEnd"
            name="windowEnd"
            type="datetime-local"
            required
            defaultValue={val(state, "windowEnd")}
            className="mt-1.5"
          />
          <FieldError msg={err(state, "windowEnd")} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="maxPrice">Max price £ (optional)</Label>
          <Input
            id="maxPrice"
            name="maxPrice"
            inputMode="decimal"
            placeholder="10"
            defaultValue={val(state, "maxPrice")}
            className="mt-1.5 max-w-[180px]"
          />
          <FieldError msg={err(state, "maxPrice")} />
        </div>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Notify me by</legend>
        <Label htmlFor="notifyEmail" className="flex items-center gap-2 font-normal">
          <Checkbox id="notifyEmail" name="notifyEmail" defaultChecked />
          <span className="text-sm">Email</span>
        </Label>
        <Label htmlFor="notifySms" className="flex items-center gap-2 font-normal">
          <Checkbox id="notifySms" name="notifySms" />
          <span className="text-sm">SMS (needs phone on file)</span>
        </Label>
        <FieldError msg={err(state, "channels")} />
      </fieldset>
      <Submit />
    </form>
  );
}
