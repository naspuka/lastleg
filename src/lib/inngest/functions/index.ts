// Central function registry. The serve handler at /api/inngest reads from
// this array, so registering a new background function is: drop a new file,
// export, add it here. Phase 2+ adds verify-listing, release-ticket,
// release-payout, match-alerts, etc.

import { healthCheck } from "./health-check";
import { matchAlerts } from "./match-alerts";
import { reconcileStripe } from "./reconcile-stripe";
import { releasePayout } from "./release-payout";
import { releaseTicket } from "./release-ticket";
import { verifyListing } from "./verify-listing";

export const functions = [
  healthCheck,
  verifyListing,
  matchAlerts,
  releaseTicket,
  releasePayout,
  reconcileStripe,
];
