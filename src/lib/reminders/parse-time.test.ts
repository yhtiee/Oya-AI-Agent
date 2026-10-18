import { describe, expect, it } from "vitest";
import { describeRepeat, formatWhen, fromLagos, lagosParts, nextOccurrence, parseWhen } from "./parse-time";

// Thursday 15 Oct 2026, 10:00 in Lagos (09:00 UTC).
const NOW = fromLagos(2026, 9, 15, 10, 0);
const lagos = (d: Date) => {
  const p = lagosParts(d);
  return `${p.year}-${String(p.month + 1).padStart(2, "0")}-${String(p.day).padStart(2, "0")} ${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
};

describe("parseWhen", () => {
  it.each([
    ["tomorrow at 9am", "2026-10-16 09:00"],
    ["Thursday 9am", "2026-10-22 09:00"],
    ["at 4pm", "2026-10-15 16:00"],
    ["at 8am", "2026-10-16 08:00"], // already past today
    ["in 2 hours", "2026-10-15 12:00"],
    ["on 20 March", "2027-03-20 09:00"],
    ["20/03", "2027-03-20 09:00"],
  ])("English: %s", (text, expected) => {
    expect(lagos(parseWhen(text, NOW)!.remindAt)).toBe(expected);
  });

  it.each([
    ["next tomorrow", "2026-10-17 09:00"],
    ["this evening", "2026-10-15 18:00"],
    ["tomorrow morning", "2026-10-16 09:00"],
    ["for 4pm", "2026-10-15 16:00"],
    ["tomoro by 6pm", "2026-10-16 18:00"],
  ])("Pidgin/casual: %s", (text, expected) => {
    expect(lagos(parseWhen(text, NOW)!.remindAt)).toBe(expected);
  });

  it("assumes 9:00am when only a date is given and says so", () => {
    const r = parseWhen("tomorrow", NOW)!;
    expect(lagos(r.remindAt)).toBe("2026-10-16 09:00");
    expect(r.timeGiven).toBe(false);
    expect(parseWhen("tomorrow at 7pm", NOW)!.timeGiven).toBe(true);
  });

  it("builds repeats with their first occurrence", () => {
    const monthly = parseWhen("every month on the 1st", NOW)!;
    expect(monthly.rrule).toContain("FREQ=MONTHLY");
    expect(monthly.rrule).toContain("BYMONTHDAY=1");
    expect(lagos(monthly.remindAt)).toBe("2026-11-01 09:00");

    const daily = parseWhen("every day at 7am", NOW)!;
    expect(daily.rrule).toContain("FREQ=DAILY");
    expect(lagos(daily.remindAt)).toBe("2026-10-16 07:00");

    const weekly = parseWhen("every monday at 6pm", NOW)!;
    expect(weekly.rrule).toContain("BYDAY=MO");
    expect(lagos(weekly.remindAt)).toBe("2026-10-19 18:00");
  });

  it("returns null for no time or a past date", () => {
    expect(parseWhen("whenever", NOW)).toBeNull();
    expect(parseWhen("on 1 January 2020", NOW)).toBeNull();
  });
});

describe("nextOccurrence", () => {
  it("steps a monthly rule to the next month at the same wall-clock time", () => {
    const first = parseWhen("every month on the 1st at 8am", NOW)!;
    const second = nextOccurrence(first.rrule!, first.remindAt)!;
    expect(lagos(second)).toBe("2026-12-01 08:00");
  });
});

describe("formatWhen", () => {
  it("formats relative to now, in Lagos time", () => {
    expect(formatWhen(fromLagos(2026, 9, 15, 18, 0), NOW)).toBe("Today 6:00pm");
    expect(formatWhen(fromLagos(2026, 9, 16, 9, 0), NOW)).toBe("Tomorrow 9:00am");
    expect(formatWhen(fromLagos(2026, 9, 19, 12, 30), NOW)).toBe("Monday 12:30pm");
    expect(formatWhen(fromLagos(2026, 11, 3, 0, 15), NOW)).toBe("Thu 3 Dec, 12:15am");
  });

  it("describes repeats", () => {
    expect(describeRepeat("FREQ=DAILY")).toBe("Every day");
    expect(describeRepeat(null)).toBeNull();
  });
});
