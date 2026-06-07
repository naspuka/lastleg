import { z } from "zod";

import { operatorEnum } from "@/db/schema/enums";

// Per CONVENTIONS §Money: amounts arrive from the form as pounds-decimal
// strings (`24` or `24.50`) and get coerced to integer pence. We use string
// math in lib/pricing.ts to avoid float traps.

const operatorValues = operatorEnum.enumValues as readonly [
  string,
  ...string[],
];

const pencePoundsField = z
  .string()
  .trim()
  .refine((s) => /^\d+(\.\d{1,2})?$/.test(s), {
    message: "Enter a price like 24 or 24.50",
  })
  .transform((s) => {
    const [whole, frac = ""] = s.split(".");
    return parseInt(whole!, 10) * 100 + parseInt((frac + "00").slice(0, 2), 10);
  })
  .refine((p) => p > 0, { message: "Price must be more than £0" });

export const createListingSchema = z
  .object({
    operator: z.enum(operatorValues),
    routeOrigin: z
      .string()
      .trim()
      .min(2, "Where does it leave from?")
      .max(80)
      .transform((s) => s.toUpperCase()),
    routeDestination: z
      .string()
      .trim()
      .min(2, "Where does it go to?")
      .max(80)
      .transform((s) => s.toUpperCase()),
    departureAt: z
      .string()
      .min(1, "Pick a departure date and time")
      .transform((s) => new Date(s))
      .refine((d) => !isNaN(d.getTime()), {
        message: "That doesn't look like a valid date",
      })
      .refine((d) => d.getTime() > Date.now(), {
        message: "Departure must be in the future",
      }),
    bookingReference: z
      .string()
      .trim()
      .min(2, "Add the booking reference from your ticket")
      .max(60)
      .transform((s) => s.toUpperCase()),
    originalPricePence: pencePoundsField,
    listPricePence: pencePoundsField,
    floorPricePence: pencePoundsField,
    hasPassengerName: z
      .union([z.literal("on"), z.literal("true")])
      .optional()
      .transform((v) => Boolean(v)),
    passengerNameFirst: z
      .string()
      .trim()
      .max(40)
      .optional()
      .transform((v) => (v === "" || v === undefined ? null : v)),
    notes: z
      .string()
      .trim()
      .max(500)
      .optional()
      .transform((v) => (v === "" || v === undefined ? null : v)),
  })
  .refine((d) => d.listPricePence <= d.originalPricePence, {
    message: "List price can't be above the original price",
    path: ["listPricePence"],
  })
  .refine((d) => d.floorPricePence <= d.listPricePence, {
    message: "Floor can't be above the list price",
    path: ["floorPricePence"],
  })
  .refine((d) => !d.hasPassengerName || Boolean(d.passengerNameFirst), {
    message: "Add the first name on the ticket",
    path: ["passengerNameFirst"],
  });

export type CreateListingInput = z.infer<typeof createListingSchema>;
