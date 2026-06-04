import { SignIn } from "@clerk/nextjs";

// Clerk-hosted sign-in surface. The catch-all `[[...sign-in]]` segment lets
// Clerk handle its own internal routing (email OTP step, phone OTP step,
// 2FA, etc.) without us having to mirror the state machine.
//
// Clerk middleware redirects unauthenticated requests against protected
// routes here when NEXT_PUBLIC_CLERK_SIGN_IN_URL is set to /sign-in. Without
// that env var, Clerk's default behaviour is to rewrite to /404 — which is
// what produced the surprising "Dashboard 404" earlier today.
export default function SignInPage() {
  return (
    <main className="flex min-h-[80vh] items-center justify-center px-6 py-12">
      <SignIn />
    </main>
  );
}
