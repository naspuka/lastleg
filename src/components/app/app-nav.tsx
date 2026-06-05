import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

// In-app nav for signed-in surfaces (/dashboard and the rest of Phase 2+
// surfaces — /sell, /browse, /alerts, /admin). Deliberately minimal: no
// marketing CTAs, no waitlist link, just brand + user controls.
//
// Phase 2 adds real menu items here (Browse, Sell, Alerts). For now it's
// brand + UserButton (with the sign-out dropdown built in).
export function AppNav() {
  return (
    <header className="border-border/60 bg-background/80 sticky top-0 z-30 w-full border-b backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link
          href="/dashboard"
          className="font-heading text-primary text-xl font-semibold tracking-tight"
        >
          LastLeg
        </Link>
        <div className="flex items-center gap-3">
          <UserButton
            appearance={{
              elements: {
                avatarBox: "size-8",
              },
            }}
          />
        </div>
      </div>
    </header>
  );
}
