export type CreateAlertFieldErrors = Partial<
  Record<
    | "routeOrigin"
    | "routeDestination"
    | "windowStart"
    | "windowEnd"
    | "maxPrice"
    | "channels",
    string
  >
>;

export type CreateAlertState =
  | { status: "idle" }
  | { status: "ok"; alertId: string }
  | {
      status: "error";
      fieldErrors: CreateAlertFieldErrors;
      values: Record<string, string>;
    };

export const initialCreateAlertState: CreateAlertState = { status: "idle" };
