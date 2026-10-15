import { describe, expect, it } from "vitest";
import { isAuthorisedTick } from "./tick-auth";

const secrets = { oyaCronSecret: "o".repeat(32), vercelCronSecret: "v".repeat(20) };

describe("tick auth", () => {
  it("accepts the pg_cron header", () => {
    expect(isAuthorisedTick(new Headers({ "x-oya-cron-secret": "o".repeat(32) }), secrets)).toBe(true);
  });

  it("accepts the Vercel Cron bearer", () => {
    expect(isAuthorisedTick(new Headers({ authorization: `Bearer ${"v".repeat(20)}` }), secrets)).toBe(true);
  });

  it("rejects wrong, missing or cross-used secrets", () => {
    expect(isAuthorisedTick(new Headers({ "x-oya-cron-secret": "o".repeat(31) }), secrets)).toBe(false);
    expect(isAuthorisedTick(new Headers({ authorization: `Bearer ${"o".repeat(32)}` }), secrets)).toBe(false);
    expect(isAuthorisedTick(new Headers({ authorization: "v".repeat(20) }), secrets)).toBe(false);
    expect(isAuthorisedTick(new Headers(), secrets)).toBe(false);
  });

  it("allows nobody when no secret is configured", () => {
    expect(isAuthorisedTick(new Headers({ "x-oya-cron-secret": "" }), {})).toBe(false);
    expect(isAuthorisedTick(new Headers({ authorization: "Bearer " }), {})).toBe(false);
  });
});
