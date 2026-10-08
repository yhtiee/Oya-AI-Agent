import { describe, expect, it } from "vitest";
import { DEFAULT_TIMEZONE, formatClock, formatInZone, isValidTimeZone, zonedToUtc } from "./time";

describe("time helpers", () => {
  const instant = new Date("2026-10-06T15:30:00Z"); // 4:30 pm in Lagos (UTC+1, no DST)

  it("defaults to Africa/Lagos", () => expect(DEFAULT_TIMEZONE).toBe("Africa/Lagos"));

  it("formats in the user's zone", () => {
    expect(formatInZone(instant, "EEE d MMM, h:mm a")).toBe("Tue 6 Oct, 4:30 PM");
    expect(formatInZone(instant, "HH:mm", "UTC")).toBe("15:30");
  });

  it("formats the short clock", () => expect(formatClock(instant)).toBe("4:30 pm"));

  it("converts local wall-clock time to UTC for storage", () => {
    expect(zonedToUtc("2026-10-06 16:30").toISOString()).toBe("2026-10-06T15:30:00.000Z");
  });

  it("validates time zones", () => {
    expect(isValidTimeZone("Africa/Lagos")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
  });
});
