"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

import { joinWaitlistAction } from "@/app/_actions/waitlist";
import {
  initialWaitlistState,
  type WaitlistState,
} from "@/app/_actions/waitlist-types";
import { ROUTES } from "@/lib/routes";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="lg"
      className="bg-brand-coral text-brand-coral-foreground hover:bg-brand-coral-hover border-brand-coral h-12 w-full text-base"
      disabled={pending}
    >
      {pending ? "Joining…" : "Join the waitlist"}
    </Button>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="text-destructive mt-1 text-sm" role="alert">
      {message}
    </p>
  );
}

function previousValue(
  state: WaitlistState,
  field: "email" | "phone" | "role"
): string {
  return state.status === "error" ? state.values[field] : "";
}

function previousRoutes(state: WaitlistState): string[] {
  return state.status === "error" ? state.values.routes : [];
}

function fieldError(
  state: WaitlistState,
  key: "email" | "phone" | "role" | "routes"
): string | undefined {
  return state.status === "error" ? state.fieldErrors[key] : undefined;
}

export function WaitlistForm() {
  const [state, formAction] = useActionState(
    joinWaitlistAction,
    initialWaitlistState
  );

  if (state.status === "ok") {
    return (
      <Card
        id="waitlist"
        className="border-primary/20 shadow-primary/5 mx-auto w-full max-w-lg shadow-lg"
      >
        <CardContent className="space-y-4 py-12 text-center">
          <div className="bg-primary/10 text-primary mx-auto grid size-12 place-content-center rounded-full">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 className="font-heading text-3xl font-semibold tracking-tight">
            You&rsquo;re in.
          </h2>
          <p className="text-muted-foreground">
            Check your email — we&rsquo;ll be in touch when we launch on your
            routes.
          </p>
        </CardContent>
      </Card>
    );
  }

  const prevRoutes = previousRoutes(state);
  const prevRole = previousValue(state, "role");

  return (
    <Card
      id="waitlist"
      className="border-border shadow-primary/5 mx-auto w-full max-w-lg shadow-xl"
    >
      <CardHeader>
        <CardTitle className="font-heading text-3xl font-semibold tracking-tight">
          Join the waitlist
        </CardTitle>
        <p className="text-muted-foreground text-sm leading-relaxed">
          We&rsquo;re launching on 5 routes this summer. Tell us which ones
          matter to you and we&rsquo;ll invite you early.
        </p>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-6" noValidate>
          <div className="space-y-2">
            <Label htmlFor="email">
              Email <span className="text-destructive">*</span>
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              defaultValue={previousValue(state, "email")}
              aria-invalid={fieldError(state, "email") ? true : undefined}
            />
            <FieldError message={fieldError(state, "email")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">
              Phone{" "}
              <span className="text-muted-foreground font-normal">
                (optional — for SMS alerts)
              </span>
            </Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              placeholder="07700 900123"
              defaultValue={previousValue(state, "phone")}
              aria-invalid={fieldError(state, "phone") ? true : undefined}
            />
            <p className="text-muted-foreground text-xs">
              We&rsquo;ll only text you about route matches you opted in for.
            </p>
            <FieldError message={fieldError(state, "phone")} />
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">
              I&rsquo;m interested in…{" "}
              <span className="text-destructive">*</span>
            </legend>
            <RadioGroup name="role" defaultValue={prevRole || undefined}>
              {(
                [
                  { value: "buyer", label: "Buying tickets" },
                  { value: "seller", label: "Selling tickets" },
                  { value: "both", label: "Both" },
                ] as const
              ).map((opt) => (
                <Label
                  key={opt.value}
                  htmlFor={`role-${opt.value}`}
                  className="flex cursor-pointer items-center gap-3 font-normal"
                >
                  <RadioGroupItem id={`role-${opt.value}`} value={opt.value} />
                  <span>{opt.label}</span>
                </Label>
              ))}
            </RadioGroup>
            <FieldError message={fieldError(state, "role")} />
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">
              Routes I&rsquo;d use <span className="text-destructive">*</span>
            </legend>
            <div className="space-y-2">
              {ROUTES.map((route) => (
                <Label
                  key={route.slug}
                  htmlFor={`route-${route.slug}`}
                  className="flex cursor-pointer items-center gap-3 font-normal"
                >
                  <Checkbox
                    id={`route-${route.slug}`}
                    name="routes"
                    value={route.slug}
                    defaultChecked={prevRoutes.includes(route.slug)}
                  />
                  <span>
                    {route.label}
                    {route.provisional && (
                      <span className="text-muted-foreground ml-2 text-xs">
                        (or Liverpool — TBD)
                      </span>
                    )}
                  </span>
                </Label>
              ))}
            </div>
            <FieldError message={fieldError(state, "routes")} />
          </fieldset>

          <SubmitButton />

          <p className="text-muted-foreground text-center text-xs">
            By joining you agree to our{" "}
            <a href="/privacy" className="underline underline-offset-2">
              privacy notice
            </a>
            .
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
