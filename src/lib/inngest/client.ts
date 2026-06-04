import { Inngest } from "inngest";

// Single Inngest client for the whole app. The library reads INNGEST_EVENT_KEY
// and INNGEST_SIGNING_KEY from the env automatically; we only need to set the
// app id explicitly.
//
// `id` is the app's unique identifier in the Inngest dashboard. Keep it
// stable — changing it makes Inngest treat us as a different app and orphans
// historical run data.
export const inngest = new Inngest({
  id: "lastleg",
  // Inngest dev/local mode auto-detects when these env vars are missing and
  // routes to the local CLI on localhost:8288. Production talks to inngest
  // cloud once keys are set in Vercel.
});
