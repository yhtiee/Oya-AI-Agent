/*
 * Money is integer kobo (R5). Never floats: amounts are bigint or safe integers, and naira
 * strings are parsed digit by digit.
 */

export type Kobo = bigint;

const KOBO_PER_NAIRA = 100n;

export function toKobo(value: bigint | number): Kobo {
  if (typeof value === "bigint") return value;
  if (!Number.isSafeInteger(value)) throw new RangeError(`Kobo must be a whole number, got ${value}`);
  return BigInt(value);
}

/**
 * Parses a naira amount typed by a person or a provider ("8,000", "₦8000.50", "N 1 500") into kobo.
 * Returns null for anything that isn't a plain non-negative amount with at most 2 decimal places.
 */
export function parseNaira(input: string): Kobo | null {
  const cleaned = input
    .trim()
    .replace(/^(?:₦|ngn|n)\s*/i, "")
    .replace(/[,\s]/g, "");
  const m = cleaned.match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!m) return null;
  const naira = BigInt(m[1]);
  const kobo = BigInt((m[2] ?? "").padEnd(2, "0") || "0");
  return naira * KOBO_PER_NAIRA + kobo;
}

/** "₦8,000" or "₦8,000.50". Whole amounts drop the ".00". */
export function formatNaira(amount: bigint | number, opts: { alwaysShowKobo?: boolean } = {}): string {
  const kobo = toKobo(amount);
  const negative = kobo < 0n;
  const abs = negative ? -kobo : kobo;
  const naira = abs / KOBO_PER_NAIRA;
  const rest = abs % KOBO_PER_NAIRA;
  const whole = naira.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const fraction = rest > 0n || opts.alwaysShowKobo ? `.${rest.toString().padStart(2, "0")}` : "";
  return `${negative ? "-" : ""}₦${whole}${fraction}`;
}

/** Basis points of an amount, rounded down to whole kobo (e.g. a commission). */
export function applyBps(amount: bigint | number, bps: number): Kobo {
  if (!Number.isInteger(bps) || bps < 0 || bps > 10_000) throw new RangeError(`bps must be 0–10000, got ${bps}`);
  return (toKobo(amount) * BigInt(bps)) / 10_000n;
}
