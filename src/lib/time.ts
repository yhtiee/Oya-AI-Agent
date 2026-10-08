import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

/** Times are stored in UTC and shown in the user's timezone (R5). */
export const DEFAULT_TIMEZONE = "Africa/Lagos";

/** Formats an instant for display, e.g. formatInZone(date, "EEE d MMM, h:mm a") → "Tue 6 Oct, 4:30 PM". */
export function formatInZone(
  date: Date | string | number,
  pattern: string,
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  return formatInTimeZone(date, timeZone, pattern);
}

/** "4:30 pm": the short time used on cards and chat. */
export function formatClock(date: Date | string | number, timeZone: string = DEFAULT_TIMEZONE): string {
  return formatInTimeZone(date, timeZone, "h:mm a").toLowerCase();
}

/**
 * Turns a local wall-clock time in the user's zone into a UTC instant for storage,
 * e.g. "2026-10-06 16:30" in Lagos → 2026-10-06T15:30:00.000Z.
 */
export function zonedToUtc(localDateTime: string, timeZone: string = DEFAULT_TIMEZONE): Date {
  return fromZonedTime(localDateTime, timeZone);
}

/** True if the string is a timezone the runtime knows. */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone });
    return true;
  } catch {
    return false;
  }
}
