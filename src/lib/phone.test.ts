import { describe, expect, it } from "vitest";
import { isNigerianMobile, maskPhone, toE164 } from "./phone";

describe("toE164", () => {
  it.each([
    ["0803 123 4567", "+2348031234567"],
    ["08031234567", "+2348031234567"],
    ["+234 803 123 4567", "+2348031234567"],
    ["2348031234567", "+2348031234567"],
    ["0703-123-4567", "+2347031234567"],
  ])("normalises %s", (input, e164) => {
    expect(toE164(input)).toBe(e164);
  });

  it.each(["", "12345", "0803 123", "not a number"])("rejects %s", (input) => {
    expect(toE164(input)).toBeNull();
  });

  it("accepts other countries in international format", () => {
    expect(toE164("+44 20 7946 0958")).toBe("+442079460958");
  });
});

describe("isNigerianMobile", () => {
  it("accepts Nigerian mobiles", () => {
    expect(isNigerianMobile("0803 123 4567")).toBe(true);
    expect(isNigerianMobile("+2349061234567")).toBe(true);
  });
  it("rejects foreign or invalid numbers", () => {
    expect(isNigerianMobile("+44 7911 123456")).toBe(false);
    expect(isNigerianMobile("0803")).toBe(false);
  });
});

describe("maskPhone", () => {
  it("hides the middle digits", () => expect(maskPhone("+2348031234567")).toBe("+234 803 *** 4567"));
  it("is safe on garbage", () => expect(maskPhone("nonsense")).toBe("***"));
  it("doesn't reveal short numbers", () => expect(maskPhone("+2341234")).toBe("+234 ***"));
});
