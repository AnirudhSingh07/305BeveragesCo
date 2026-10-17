/**
 * Date/time utilities — all business dates are resolved in the Asia/Kolkata
 * timezone (IST, UTC+05:30), even when the server runs in UTC. A "business
 * date" is the trading day in IST; the day boundary is DAY_START_HOUR IST
 * (05:00), so anything between midnight and 05:00 IST still counts toward the
 * previous day's sales, closing and reports.
 */
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";

export const BUSINESS_TZ = "Asia/Kolkata";

/**
 * Hour (in IST) at which a new business day begins. The trading day runs from
 * 05:00 IST to 05:00 IST the next calendar day. Change this single constant to
 * move the boundary. NOTE: the order-number/counter logic in the Postgres
 * `create_order` function mirrors this value — keep them in sync.
 */
export const DAY_START_HOUR = 5;

/** Zero-padded "HH:00:00" wall-clock string for the start of a business day. */
const DAY_START_TIME = `${String(DAY_START_HOUR).padStart(2, "0")}:00:00`;

export type DateRangePreset =
  | "today"
  | "yesterday"
  | "last7"
  | "last30"
  | "this_month"
  | "custom";

export interface UtcRange {
  /** Inclusive start, ISO string in UTC. */
  startUtc: string;
  /** Exclusive end, ISO string in UTC. */
  endUtc: string;
}

/**
 * The business date (YYYY-MM-DD in IST) for a given instant (default: now).
 * The day begins at DAY_START_HOUR IST, so we shift the instant back by that
 * many hours before reading off the calendar date: an instant at 02:00 IST is
 * attributed to the previous trading day, while 05:00 IST starts the new one.
 */
export function businessDate(instant: Date = new Date()): string {
  const shifted = new Date(instant.getTime() - DAY_START_HOUR * 60 * 60 * 1000);
  return formatInTimeZone(shifted, BUSINESS_TZ, "yyyy-MM-dd");
}

/**
 * Given an IST calendar date string (YYYY-MM-DD), return the UTC instant of the
 * start of that business day in IST (DAY_START_HOUR, i.e. 05:00).
 */
export function istDayStartUtc(dateStr: string): Date {
  // Interpret "<date> 05:00:00" as a wall-clock time in IST, convert to UTC.
  return fromZonedTime(`${dateStr} ${DAY_START_TIME}`, BUSINESS_TZ);
}

/** The UTC instant for the END (exclusive) of an IST business day. */
export function istDayEndUtc(dateStr: string): Date {
  const start = istDayStartUtc(dateStr);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

/** Add days to an IST date string, returning a new IST date string. */
export function addIstDays(dateStr: string, days: number): string {
  const d = istDayStartUtc(dateStr);
  const shifted = new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
  return businessDate(shifted);
}

/** First IST calendar day of the month containing the given IST date. */
export function istMonthStart(dateStr: string): string {
  return `${dateStr.slice(0, 7)}-01`;
}

/**
 * Resolve a preset (relative to "today" in IST) or a custom pair of IST date
 * strings into a half-open UTC instant range [startUtc, endUtc).
 */
export function resolveRange(
  preset: DateRangePreset,
  customFrom?: string,
  customTo?: string,
  now: Date = new Date()
): UtcRange {
  const today = businessDate(now);
  let fromDate = today;
  let toDate = today; // inclusive IST date

  switch (preset) {
    case "today":
      fromDate = today;
      toDate = today;
      break;
    case "yesterday":
      fromDate = addIstDays(today, -1);
      toDate = fromDate;
      break;
    case "last7":
      fromDate = addIstDays(today, -6);
      toDate = today;
      break;
    case "last30":
      fromDate = addIstDays(today, -29);
      toDate = today;
      break;
    case "this_month":
      fromDate = istMonthStart(today);
      toDate = today;
      break;
    case "custom":
      fromDate = customFrom ?? today;
      toDate = customTo ?? today;
      break;
  }

  return {
    startUtc: istDayStartUtc(fromDate).toISOString(),
    // end is exclusive end-of-day of the inclusive "toDate"
    endUtc: istDayEndUtc(toDate).toISOString(),
  };
}

/** Format a UTC/ISO instant as an IST wall-clock string for display. */
export function formatIst(
  instant: string | Date,
  pattern = "dd MMM yyyy, hh:mm a"
): string {
  const d = typeof instant === "string" ? new Date(instant) : instant;
  return formatInTimeZone(d, BUSINESS_TZ, pattern);
}

/** The IST wall-clock Date object (for extracting hour/day buckets). */
export function toIst(instant: string | Date): Date {
  const d = typeof instant === "string" ? new Date(instant) : instant;
  return toZonedTime(d, BUSINESS_TZ);
}
