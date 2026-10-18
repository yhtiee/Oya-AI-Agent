import { lagosParts } from "./reminders/parse-time";

/*
 * Quiet hours (SPEC §5.7): 22:00–06:00 Lagos time by default. Power watches and digests stay quiet unless the
 * user turned on overnight alerts. A reminder the user set for a time inside quiet hours still fires: they chose it.
 */

export const QUIET_START_HOUR = 22;
export const QUIET_END_HOUR = 6;

export function isQuietHours(at: Date, start = QUIET_START_HOUR, end = QUIET_END_HOUR): boolean {
  const { hour } = lagosParts(at);
  return start > end ? hour >= start || hour < end : hour >= start && hour < end;
}
