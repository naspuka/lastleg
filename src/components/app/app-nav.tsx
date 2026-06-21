import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

// In-app nav for signed-in surfaces (/dashboard and the rest of Phase 2+
// surfaces — /sell, /browse, /alerts, /admin). Deliberately minimal: no
// marketing CTAs, no waitlist link.
//
// Phase 2 adds Sell to the menu. Browse + Alerts come in Phase 3.
export function AppNav() {
  return (
    <header className="border-border/60 bg-background/80 sticky top-0 z-30 w-full border-b backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
        <Link
          href="/dashboard"
          className="font-heading text-primary text-xl font-semibold tracking-tight"
        >
          LastLeg
        </Link>
        <nav className="flex flex-1 items-center gap-1 sm:gap-2">
          <Link
            href="/browse"
            className="text-muted-foreground hover:text-foreground rounded-md px-2 py-1 text-sm font-medium transition-colors sm:px-3"
          >
            Browse
          </Link>
          <Link
            href="/sell"
            className="text-muted-foreground hover:text-foreground rounded-md px-2 py-1 text-sm font-medium transition-colors sm:px-3"
          >
            Sell
          </Link>
          <Link
            href="/alerts"
            className="text-muted-foreground hover:text-foreground rounded-md px-2 py-1 text-sm font-medium transition-colors sm:px-3"
          >
            Alerts
          </Link>
          <Link
            href="/dashboard"
            className="text-muted-foreground hover:text-foreground hidden rounded-md px-2 py-1 text-sm font-medium transition-colors sm:inline sm:px-3"
          >
            Account
          </Link>
        </nav>
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
