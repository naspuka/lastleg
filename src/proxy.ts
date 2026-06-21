import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Routes that REQUIRE an authenticated session. Everything else is public.
// Add new paths here as we build out the seller/buyer/admin surfaces.
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/sell(.*)",
  "/browse(.*)",
  "/listings(.*)",
  "/checkout(.*)",
  "/alerts(.*)",
  "/admin(.*)",
]);

// Env-gated middleware. Phase 0 ships without Clerk wired; ditto local dev
// before keys are added to .env.local. When CLERK_SECRET_KEY is absent we
// short-circuit and let every request through unauthenticated — which is
// correct, because there's nothing to authenticate against yet.
//
// This is what makes "the app boots with zero env vars" hold true even after
// we add auth-aware middleware to the repo.
const clerkConfigured = Boolean(process.env.CLERK_SECRET_KEY);

const handler = clerkConfigured
  ? clerkMiddleware(async (auth, req) => {
      if (isProtectedRoute(req)) {
        // protect() throws a NotAuthenticated, which Next translates into a
        // 307 to /sign-in. Per Clerk's middleware contract this is the
        // canonical way to gate a route.
        await auth.protect();
      }
    })
  : () => NextResponse.next();

export default handler;

// Standard Next.js matcher: every page route except _next/static and friends,
// plus all /api routes. Copied from Clerk's recommended matcher.
export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
