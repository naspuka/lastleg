import { ClerkProvider } from "@clerk/nextjs";

// Server-component wrapper that conditionally drops in ClerkProvider only
// when Clerk is configured. Without this gate, ClerkProvider throws at
// module-eval time on a missing publishable key, which would break the
// landing page on any dev machine that hasn't pasted Clerk creds yet.
//
// Once Clerk is configured everywhere we deploy, the conditional can come
// out and ClerkProvider can wrap the body unconditionally.
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const clerkConfigured = Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  );

  if (!clerkConfigured) {
    return <>{children}</>;
  }

  return <ClerkProvider>{children}</ClerkProvider>;
}
