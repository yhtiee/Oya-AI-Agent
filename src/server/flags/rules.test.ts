import { describe, expect, it } from "vitest";
import { bucket, evaluateFlag } from "./rules";

const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";
const AREA = "33333333-3333-4333-8333-333333333333";

describe("evaluateFlag", () => {
  const ctx = { env: "production" as const };

  it("is off when the flag is missing or disabled", () => {
    expect(evaluateFlag(undefined, ctx)).toBe(false);
    expect(evaluateFlag({ key: "x", enabled: false, rules: {} }, ctx)).toBe(false);
  });

  it("is on when enabled with no rules", () => {
    expect(evaluateFlag({ key: "x", enabled: true, rules: {} }, ctx)).toBe(true);
    expect(evaluateFlag({ key: "x", enabled: true, rules: null }, ctx)).toBe(true);
  });

  it("respects environments", () => {
    const flag = { key: "x", enabled: true, rules: { env: ["staging"] } };
    expect(evaluateFlag(flag, { env: "staging" })).toBe(true);
    expect(evaluateFlag(flag, { env: "production" })).toBe(false);
  });

  it("targets users and areas", () => {
    const flag = { key: "x", enabled: true, rules: { user_ids: [U1], area_ids: [AREA] } };
    expect(evaluateFlag(flag, { ...ctx, userId: U1 })).toBe(true);
    expect(evaluateFlag(flag, { ...ctx, userId: U2 })).toBe(false);
    expect(evaluateFlag(flag, { ...ctx, userId: U2, areaId: AREA })).toBe(true);
    expect(evaluateFlag(flag, ctx)).toBe(false);
  });

  it("rolls out by stable percentage", () => {
    const flag = { key: "rollout", enabled: true, rules: { percentage: 50 } };
    const first = evaluateFlag(flag, { ...ctx, userId: U1 });
    expect(evaluateFlag(flag, { ...ctx, userId: U1 })).toBe(first);
    expect(evaluateFlag({ ...flag, rules: { percentage: 100 } }, { ...ctx, userId: U1 })).toBe(true);
    expect(evaluateFlag({ ...flag, rules: { percentage: 0 } }, { ...ctx, userId: U1 })).toBe(false);
    expect(evaluateFlag(flag, ctx)).toBe(false);
  });

  it("fails closed on malformed rules", () => {
    expect(evaluateFlag({ key: "x", enabled: true, rules: { percentage: 150 } }, ctx)).toBe(false);
    expect(evaluateFlag({ key: "x", enabled: true, rules: { surprise: true } }, ctx)).toBe(false);
    expect(evaluateFlag({ key: "x", enabled: true, rules: "on" }, ctx)).toBe(false);
  });
});

describe("bucket", () => {
  it("is stable and within 0–99", () => {
    const b = bucket("flag", U1);
    expect(b).toBe(bucket("flag", U1));
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThan(100);
  });

  it("spreads users roughly evenly", () => {
    let under50 = 0;
    for (let i = 0; i < 2000; i++) if (bucket("spread", `user-${i}`) < 50) under50++;
    expect(under50).toBeGreaterThan(900);
    expect(under50).toBeLessThan(1100);
  });
});
