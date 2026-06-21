// Sentry env-gated stub.
//
// We don't pull in the heavy @sentry/nextjs SDK at MVP because the user
// base is tiny and console.error in Vercel logs covers the diagnostic
// surface for now. Once we have meaningful traffic + a real on-call,
// drop in the SDK and replace this stub.
//
// Interface mirrors the SDK's minimal surface so swapping is a one-file
// change. Env-gated on SENTRY_DSN — if unset every call is a no-op.

export function captureException(err: unknown, context?: Record<string, unknown>) {
  if (!process.env.SENTRY_DSN) return;
  // Real Sentry call goes here once the SDK is installed.
  // For now log a structured line so Vercel logs are queryable.
  console.error(
    "[sentry]",
    err instanceof Error ? err.message : String(err),
    JSON.stringify(context ?? {})
  );
}

export function captureMessage(message: string, context?: Record<string, unknown>) {
  if (!process.env.SENTRY_DSN) return;
  console.log("[sentry]", message, JSON.stringify(context ?? {}));
}
