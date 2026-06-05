import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Auth-aware bits for the landing-page nav. Server component — reads the
// Clerk session at render time via currentUser() and conditionally shows
// either "Sign in / Create account" or "Dashboard / avatar".
//
// Clerk 7 dropped the <SignedIn>/<SignedOut> client wrappers; the official
// pattern in app router is to branch on currentUser() in a server component.
// UserButton itself remains a client component but it works inside any tree
// as long as ClerkProvider is mounted, which our AuthProvider handles.
//
// Env-gated: if the publishable key is unset (£0 / pre-Clerk state), this
// component renders nothing so the landing page still works.
export async function NavAuth() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return null;
  }

  const user = await currentUser();

  if (user) {
    return (
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="text-foreground/80 hover:text-foreground text-sm font-medium underline-offset-4 hover:underline"
        >
          Dashboard
        </Link>
        <UserButton
          appearance={{
            elements: {
              avatarBox: "size-8",
            },
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Link
        href="/sign-in"
        className="text-foreground/70 hover:text-foreground text-sm font-medium underline-offset-4 hover:underline"
      >
        Sign in
      </Link>
      <Link
        href="/sign-up"
        className={cn(
          buttonVariants({ size: "sm" }),
          "border-primary/20 bg-primary text-primary-foreground hover:bg-primary/90"
        )}
      >
        Create account
      </Link>
    </div>
  );
}
