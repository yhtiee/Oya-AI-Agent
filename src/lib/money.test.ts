import { describe, expect, it } from "vitest";
import { applyBps, formatNaira, parseNaira, toKobo } from "./money";

describe("parseNaira", () => {
  it.each([
    ["8000", 800_000n],
    ["8,000", 800_000n],
    ["₦8,000", 800_000n],
    ["N 1 500", 150_000n],
    ["NGN3000", 300_000n],
    ["8000.5", 800_050n],
    ["8000.05", 800_005n],
    ["0", 0n],
    ["  250  ", 25_000n],
  ])("reads %s as %s kobo", (input, kobo) => {
    expect(parseNaira(input)).toBe(kobo);
  });

  it.each(["", "abc", "-500", "8.123", "1e3", "₦", "8,000.5.0"])("rejects %s", (input) => {
    expect(parseNaira(input)).toBeNull();
  });

  it("handles amounts beyond Number precision without loss", () => {
    expect(parseNaira("90071992547409919.99")).toBe(9_007_199_254_740_991_999n);
  });
});

describe("formatNaira", () => {
  it("drops .00 on whole amounts", () => expect(formatNaira(800_000n)).toBe("₦8,000"));
  it("shows kobo when present", () => expect(formatNaira(800_050)).toBe("₦8,000.50"));
  it("can always show kobo", () => expect(formatNaira(800_000n, { alwaysShowKobo: true })).toBe("₦8,000.00"));
  it("formats small and zero amounts", () => {
    expect(formatNaira(5n)).toBe("₦0.05");
    expect(formatNaira(0n)).toBe("₦0");
  });
  it("formats negatives (refund lines)", () => expect(formatNaira(-150_000n)).toBe("-₦1,500"));
  it("groups millions", () => expect(formatNaira(123_456_789_00n)).toBe("₦123,456,789"));
});

describe("toKobo", () => {
  it("accepts safe integers and bigints", () => {
    expect(toKobo(5)).toBe(5n);
    expect(toKobo(5n)).toBe(5n);
  });
  it("refuses floats", () => expect(() => toKobo(1.5)).toThrow(RangeError));
});

describe("applyBps", () => {
  it("takes a share rounding down to whole kobo", () => {
    expect(applyBps(800_000n, 1000)).toBe(80_000n);
    expect(applyBps(999n, 250)).toBe(24n);
    expect(applyBps(800_000n, 0)).toBe(0n);
  });
  it("refuses out-of-range bps", () => {
    expect(() => applyBps(100n, -1)).toThrow(RangeError);
    expect(() => applyBps(100n, 10_001)).toThrow(RangeError);
    expect(() => applyBps(100n, 1.5)).toThrow(RangeError);
  });
});
