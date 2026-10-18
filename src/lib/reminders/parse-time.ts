import * as chrono from "chrono-node";
import { RRule, Weekday } from "rrule";

/*
 * Natural-language reminder times (SPEC §5.7): chrono-node (British day/month order) plus a small Pidgin phrase
 * map, and RFC 5545 RRULEs for repeats. Pure; times are Africa/Lagos (UTC+1 all year, no DST).
 * The Confirm card always shows the parsed result, so the user catches any misreading before it's saved.
 */

export const LAGOS_OFFSET_MIN = 60;
const DEFAULT_HOUR = 9; // a date with no time means 9:00am

export type ParsedWhen = {
  /** The first (or only) time the reminder fires. */
  remindAt: Date;
  /** RFC 5545 RRULE without DTSTART, e.g. "FREQ=MONTHLY;BYMONTHDAY=1", or null for a one-off. */
  rrule: string | null;
  /** False when no time of day was given and 9:00am was assumed. */
  timeGiven: boolean;
};

/** Pidgin and casual phrases chrono doesn't know, rewritten into ones it does. Order matters. */
const PHRASES: [RegExp, string][] = [
  [/\bnext tomorrow\b/g, "in 2 days"],
  [/\b(this|dis) (evening|evenin)\b/g, "today at 6pm"],
  [/\b(this|dis) morning\b/g, "today at 9am"],
  [/\b(this|dis) afternoon\b/g, "today at 2pm"],
  [/\b(tomorrow|tomoro|tmrw|tmr) morning\b/g, "tomorrow at 9am"],
  [/\b(tomorrow|tomoro|tmrw|tmr) (evening|night)\b/g, "tomorrow at 7pm"],
  [/\b(tomorrow|tomoro|tmrw|tmr) afternoon\b/g, "tomorrow at 2pm"],
  [/\btomoro|tmrw|tmr\b/g, "tomorrow"],
  [/\bnext week\b/g, "in 7 days"],
  [/\b(by|for) (\d{1,2}(:\d{2})?\s?(am|pm)?)\b/g, "at $2"],
  [/\b(o'?clock)\b/g, ""],
];

const WEEKDAYS: Record<string, Weekday> = {
  monday: RRule.MO,
  tuesday: RRule.TU,
  wednesday: RRule.WE,
  thursday: RRule.TH,
  friday: RRule.FR,
  saturday: RRule.SA,
  sunday: RRule.SU,
};

type Repeat = { freq: number; byweekday?: Weekday; bymonthday?: number };

function detectRepeat(text: string): Repeat | null {
  const day = text.match(/\bevery\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)s?\b/);
  if (day) return { freq: RRule.WEEKLY, byweekday: WEEKDAYS[day[1]] };
  const monthDay =
    text.match(/\b(every month|monthly)\b.*?\b(?:on\s+)?(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)\b/) ??
    text.match(/\b(?:on\s+)?(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)\b.*?\b(every month|monthly)\b/);
  if (monthDay) {
    const n = Number(monthDay[2] && /^\d/.test(monthDay[2]) ? monthDay[2] : monthDay[1]);
    if (n >= 1 && n <= 31) return { freq: RRule.MONTHLY, bymonthday: n };
  }
  if (/\b(every month|monthly)\b/.test(text)) return { freq: RRule.MONTHLY };
  if (/\b(every day|everyday|daily|every morning|every night|every evening)\b/.test(text)) return { freq: RRule.DAILY };
  if (/\b(every week|weekly)\b/.test(text)) return { freq: RRule.WEEKLY };
  if (/\b(every year|yearly|annually)\b/.test(text)) return { freq: RRule.YEARLY };
  return null;
}

/** Lagos wall-clock parts of an instant. */
export function lagosParts(d: Date) {
  const shifted = new Date(d.getTime() + LAGOS_OFFSET_MIN * 60_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay(),
  };
}

/** The instant for a Lagos wall-clock time. */
export function fromLagos(year: number, month: number, day: number, hour: number, minute: number): Date {
  return new Date(Date.UTC(year, month, day, hour, minute) - LAGOS_OFFSET_MIN * 60_000);
}

/** RRULE string for a repeat, keeping the wall-clock time of `first`. */
function repeatRule(rep: Repeat, first: Date): string {
  const p = lagosParts(first);
  const rule = new RRule({
    freq: rep.freq,
    byweekday: rep.byweekday ? [rep.byweekday] : undefined,
    bymonthday: rep.bymonthday,
    byhour: [p.hour],
    byminute: [p.minute],
    bysecond: [0],
  });
  return rule.toString().replace(/^RRULE:/, "");
}

/**
 * The next occurrence of an RRULE strictly after `after`, in Lagos time. RRule works in "floating" UTC, so the
 * rule is evaluated on Lagos wall-clock time shifted into UTC and shifted back.
 */
export function nextOccurrence(rrule: string, after: Date): Date | null {
  const shift = LAGOS_OFFSET_MIN * 60_000;
  const rule = RRule.fromString(`DTSTART:19700101T000000Z\nRRULE:${rrule}`);
  const next = rule.after(new Date(after.getTime() + shift), false);
  return next ? new Date(next.getTime() - shift) : null;
}

export function parseWhen(input: string, now: Date = new Date()): ParsedWhen | null {
  let text = ` ${input.toLowerCase().replace(/\s+/g, " ")} `;
  for (const [re, to] of PHRASES) text = text.replace(re, to);
  text = text.trim();

  const repeat = detectRepeat(text);
  const results = chrono.en.GB.parse(text, { instant: now, timezone: LAGOS_OFFSET_MIN }, { forwardDate: true });
  const hit = results[0];
  const timeGiven = Boolean(hit?.start.isCertain("hour"));

  if (repeat) {
    const hour = timeGiven ? hit!.start.get("hour")! : DEFAULT_HOUR;
    const minute = timeGiven ? (hit!.start.get("minute") ?? 0) : 0;
    const p = lagosParts(now);
    const seed = fromLagos(p.year, p.month, p.day, hour, minute);
    const rrule = repeatRule(repeat, seed);
    const first = nextOccurrence(rrule, now);
    return first ? { remindAt: first, rrule, timeGiven } : null;
  }

  if (!hit) return null;
  let at = hit.start.date();
  if (!timeGiven) {
    const p = lagosParts(at);
    at = fromLagos(p.year, p.month, p.day, DEFAULT_HOUR, 0);
  }
  if (at.getTime() <= now.getTime()) {
    // "at 8am" said at 10am means tomorrow; a date in the past can't be a reminder.
    if (!hit.start.isCertain("day")) at = new Date(at.getTime() + 86_400_000);
    else return null;
  }
  return { remindAt: at, rrule: null, timeGiven };
}

/** "Thursday 9:00am" (this week) or "Thu 3 Dec, 9:00am", in Lagos time. */
export function formatWhen(d: Date, now: Date = new Date()): string {
  const p = lagosParts(d);
  const hour12 = p.hour % 12 === 0 ? 12 : p.hour % 12;
  const time = `${hour12}:${String(p.minute).padStart(2, "0")}${p.hour < 12 ? "am" : "pm"}`;
  const days = (d.getTime() - now.getTime()) / 86_400_000;
  const fmt = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", ...opts }).format(d);
  const today = lagosParts(now);
  if (p.year === today.year && p.month === today.month && p.day === today.day) return `Today ${time}`;
  const tomorrow = lagosParts(new Date(now.getTime() + 86_400_000));
  if (p.year === tomorrow.year && p.month === tomorrow.month && p.day === tomorrow.day) return `Tomorrow ${time}`;
  if (days < 6) return `${fmt({ weekday: "long" })} ${time}`;
  return `${fmt({ weekday: "short", day: "numeric", month: "short" })}, ${time}`;
}

/** "Every month on the 1st, 9:00am" style description of an RRULE, for cards. */
export function describeRepeat(rrule: string | null): string | null {
  if (!rrule) return null;
  try {
    const text = RRule.fromString(`RRULE:${rrule}`).toText();
    return text.charAt(0).toUpperCase() + text.slice(1);
  } catch {
    return null;
  }
}
