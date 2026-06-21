"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

// Cookie banner per P7-06. We only need a banner because PostHog drops a
// non-essential analytics cookie; everything else (Clerk session, CSRF) is
// strictly necessary and doesn't require consent under PECR.
//
// Persistence: localStorage. When the user accepts we set
// `lastleg-cookie-consent=granted`; when they decline we set `denied`.
// PostHog's init reads this via `window.posthog.opt_in_capturing` /
// `opt_out_capturing` once we wire the dynamic gate (TODO follow-up).

const STORAGE_KEY = "lastleg-cookie-consent";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) setVisible(true);
  }, []);

  function set(value: "granted" | "denied") {
    window.localStorage.setItem(STORAGE_KEY, value);
    setVisible(false);
    // Reload so PostHog provider picks up the new consent state. Cheap
    // and reliable.
    window.dispatchEvent(new CustomEvent("cookie-consent-change"));
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-2xl rounded-2xl border bg-card p-4 shadow-xl sm:p-5"
    >
      <p className="text-sm leading-relaxed">
        We use a single analytics cookie (PostHog, EU-hosted) to understand
        how the site is used. Essential cookies for sign-in and payment
        always run. See our{" "}
        <a href="/privacy" className="underline underline-offset-2">
          privacy policy
        </a>
        .
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => set("granted")}
          className="bg-brand-coral text-brand-coral-foreground hover:bg-brand-coral-hover border-brand-coral"
        >
          Accept
        </Button>
        <Button size="sm" variant="outline" onClick={() => set("denied")}>
          Decline analytics
        </Button>
      </div>
    </div>
  );
}
