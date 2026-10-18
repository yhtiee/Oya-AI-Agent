/* Prepaid units estimate (SPEC §5.1): days_left = units / kWh per day. Always labelled an estimate. */

export const USAGE_PRESETS = {
  small_flat: 3,
  family_home: 8,
} as const;
export type UsagePreset = keyof typeof USAGE_PRESETS;

export type UnitsEstimate = {
  units: number;
  kwhPerDay: number;
  daysLeft: number;
  /** Offer a reminder to buy units (SPEC §5.1: when days_left <= 2). */
  suggestReminder: boolean;
};

export function estimateDays(units: number, kwhPerDay: number): UnitsEstimate | null {
  if (!Number.isFinite(units) || !Number.isFinite(kwhPerDay) || units < 0 || kwhPerDay <= 0) return null;
  const daysLeft = Math.floor((units / kwhPerDay) * 10) / 10;
  return { units, kwhPerDay, daysLeft, suggestReminder: daysLeft <= 2 };
}
