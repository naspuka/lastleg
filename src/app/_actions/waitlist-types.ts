// Type + initial-state for the waitlist server action.
//
// Lives in its own (non-"use server") file because Next.js 16 enforces a strict
// rule: a file with the "use server" directive at the top can ONLY export async
// functions. Exporting an object constant from such a file triggers
//   `A "use server" file can only export async functions, found object`
// at runtime on the first invocation. Splitting the value exports out keeps
// the action file conformant while still letting the form component and the
// action share these definitions.

import type { WaitlistInput } from "@/lib/waitlist-schema";

export type WaitlistState =
  | { status: "idle" }
  | { status: "ok" }
  | {
      status: "error";
      fieldErrors: Partial<Record<keyof WaitlistInput, string>>;
      values: { email: string; phone: string; role: string; routes: string[] };
    };

export const initialWaitlistState: WaitlistState = { status: "idle" };
