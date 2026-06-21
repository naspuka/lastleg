// Shared time formatting helpers used across buyer/seller surfaces.
// All Dates are stored UTC; UI renders Europe/London per CONVENTIONS §Time.

const UK_DATETIME = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/London",
});

const UK_TIME = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/London",
});

const UK_DATE = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "Europe/London",
});

export function formatUkDateTime(d: Date | string): string {
  return UK_DATETIME.format(typeof d === "string" ? new Date(d) : d);
}

export function formatUkTime(d: Date | string): string {
  return UK_TIME.format(typeof d === "string" ? new Date(d) : d);
}

export function formatUkDate(d: Date | string): string {
  return UK_DATE.format(typeof d === "string" ? new Date(d) : d);
}

/**
 * "in 3h 20m" / "4d 12h" / "soon" — humanised countdown for UI hero text.
 * Negative values mean the deadline passed.
 */
export function humaniseUntil(d: Date | string): string {
  const target = typeof d === "string" ? new Date(d) : d;
  const ms = target.getTime() - Date.now();
  if (ms <= 0) return "departed";
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min`;
  const hr = Math.floor(min / 60);
  const rem = min - hr * 60;
  if (hr < 24) return rem ? `${hr}h ${rem}m` : `${hr}h`;
  const days = Math.floor(hr / 24);
  const remHr = hr - days * 24;
  return remHr ? `${days}d ${remHr}h` : `${days}d`;
}
