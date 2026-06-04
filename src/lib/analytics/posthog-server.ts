import { PostHog } from "posthog-node";

let cached: PostHog | null = null;

/**
 * Lazy server-side PostHog client. Returns `null` if no key configured so the
 * app boots before analytics is provisioned. Uses the public key on purpose
 * — there is no separate server-only secret in PostHog's model.
 */
function getPostHog(): PostHog | null {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host =
    process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";
  if (!key) return null;
  if (!cached) {
    cached = new PostHog(key, {
      host,
      // Keep it eager — we're running in short-lived server actions, not a
      // long-running process, so batching has nothing to gain.
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return cached;
}

/**
 * Fire a server-side event. Best-effort: failures are swallowed so analytics
 * gremlins can't break a signup.
 */
export async function trackServerEvent(args: {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
}): Promise<void> {
  const ph = getPostHog();
  if (!ph) return;

  try {
    ph.capture({
      distinctId: args.distinctId,
      event: args.event,
      properties: args.properties,
    });
    // Block until the event is actually flushed — Vercel kills the function
    // immediately after the response, so a deferred flush gets dropped.
    await ph.shutdown();
    // Reset the cache: shutdown() makes the instance unusable, so the next
    // call will lazily create a fresh one.
    cached = null;
  } catch (err) {
    console.error("[posthog] capture failed", err);
  }
}
