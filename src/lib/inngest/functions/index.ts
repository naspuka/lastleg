// Central function registry. The serve handler at /api/inngest reads from
// this array, so registering a new background function is: drop a new file,
// export, add it here. Phase 2+ adds verify-listing, release-ticket,
// release-payout, match-alerts, etc.

import { healthCheck } from "./health-check";

export const functions = [healthCheck];
