import { describe, expect, it } from "vitest";
import { estimateDays, USAGE_PRESETS } from "./power/units";
import { mergePrefs, parsePrefs } from "./prefs";
import { isQuietHours } from "./quiet-hours";
import { fromLagos } from "./reminders/parse-time";

describe("estimateDays", () => {
  it("divides units by daily use and suggests a reminder at 2 days or less", () => {
    expect(estimateDays(34, USAGE_PRESETS.family_home)).toEqual({
      units: 34,
      kwhPerDay: 8,
      daysLeft: 4.2,
      suggestReminder: false,
    });
    expect(estimateDays(6, USAGE_PRESETS.small_flat)!.suggestReminder).toBe(true);
  });

  it("refuses nonsense", () => {
    expect(estimateDays(-1, 3)).toBeNull();
    expect(estimateDays(10, 0)).toBeNull();
    expect(estimateDays(Number.NaN, 3)).toBeNull();
  });
});

describe("isQuietHours", () => {
  it("is quiet from 22:00 to 06:00 Lagos time", () => {
    expect(isQuietHours(fromLagos(2026, 9, 15, 22, 0))).toBe(true);
    expect(isQuietHours(fromLagos(2026, 9, 15, 3, 30))).toBe(true);
    expect(isQuietHours(fromLagos(2026, 9, 15, 6, 0))).toBe(false);
    expect(isQuietHours(fromLagos(2026, 9, 15, 21, 59))).toBe(false);
  });
});

describe("prefs", () => {
  it("parses leniently and keeps unknown keys", () => {
    expect(parsePrefs(null)).toEqual({});
    expect(parsePrefs({ power: { kwh_per_day: -2 } })).toEqual({});
    expect(parsePrefs({ future_key: 1 })).toEqual({ future_key: 1 });
  });

  it("merges nested objects without losing siblings", () => {
    const merged = mergePrefs({ power: { kwh_per_day: 3 }, language: "pcm" }, { power: { overnight_alerts: true } });
    expect(merged).toEqual({ power: { kwh_per_day: 3, overnight_alerts: true }, language: "pcm" });
  });
});
