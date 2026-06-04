import { inngest } from "../client";

// Smoke-test function. Triggered by sending an `app/health-check` event from
// `/api/inngest/health-check` or directly from the Inngest dashboard.
//
// Proves end-to-end:
//   - Inngest can reach our serve handler (signing key set, URL registered)
//   - Our serve handler can run a function
//   - Our server can call inngest.send() in the reverse direction
//
// Real domain jobs (verify-listing, release-ticket, release-payout, etc.)
// follow this same shape in Phase 2+.
export const healthCheck = inngest.createFunction(
  {
    id: "health-check",
    // Inngest v4 collapses config + trigger into a single options object.
    triggers: [{ event: "app/health-check" }],
  },
  async ({ event, step }) => {
    const startedAt = new Date().toISOString();

    // step.run() boundaries are the unit of retry/idempotency. Even this
    // trivial function uses one so the example reflects real-world patterns.
    const result = await step.run("acknowledge", () => ({
      message: "Inngest is reachable.",
      nodeVersion: process.version,
      receivedEventId: event.id,
      receivedAt: startedAt,
    }));

    return result;
  }
);
