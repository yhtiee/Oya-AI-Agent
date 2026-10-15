import { describe, expect, it } from "vitest";
import { matchEmergency, normalise } from "./emergency";
import { containsProtectedInfo, redact } from "./redact";

describe("matchEmergency", () => {
  it.each([
    ["Accident for Oron Road!", "accident"],
    ["my pikin dey jerk, wetin I go do", "medical"],
    ["e no dey breathe", "medical"],
    ["Fire don catch for our compound", "fire"],
    ["belle woman dey bleed", "pregnancy"],
    ["armed robbers dey our street now", "violence"],
    ["they kidnapped my brother", "violence"],
    ["MY HUSBAND IS NOT BREATHING", "medical"],
  ])("flags %s", (text, category) => {
    expect(matchEmergency(text)).toMatchObject({ kind: "emergency", category });
  });

  it.each(["I want to kill myself", "i wan die", "I don't see any reason to live", "I keep thinking about suicide"])(
    "routes %s to the self-harm flow",
    (text) => {
      expect(matchEmergency(text)?.kind).toBe("self_harm");
    },
  );

  it.each([
    "Has light come back for Ewet?",
    "Where can I buy a fire extinguisher?",
    "I need a crash course on CAC registration",
    "plumber for tomorrow morning",
    "Renew my passport",
    "the screenshot is attached",
    "my phone accidentally deleted the app",
    "",
  ])("doesn't flag %j", (text) => {
    expect(matchEmergency(text)).toBeNull();
  });

  it("prefers the most specific phrase", () => {
    expect(matchEmergency("armed robbery for junction")).toMatchObject({ phrase: "armed robbery" });
  });

  it("normalises punctuation, accents and stretched words", () => {
    expect(normalise("Pleeease, HELP!!!")).toBe(" pleease help ");
    expect(matchEmergency("he’s nooot breathing")).toBeNull();
    expect(matchEmergency("he can’t breathe")).toMatchObject({ kind: "emergency" });
  });
});

describe("redact", () => {
  it("removes phones, emails and coordinates", () => {
    const r = redact("Call me on 0803 123 4567 or +2348031234567, ada@example.com, I'm at 5.0377, 7.9128");
    expect(r.text).toBe("Call me on [phone] or [phone], [email], I'm at [location]");
    expect(r.found.sort()).toEqual(["coordinates", "email", "phone"]);
  });

  it("removes NIN/BVN, account numbers, Luhn-valid card numbers and OTPs", () => {
    expect(redact("my NIN is 12345678901").text).toBe("my NIN is [ID number]");
    expect(redact("send to 0123456789").text).toBe("send to [account number]");
    expect(redact("card 4111 1111 1111 1111").text).toBe("card [card number]");
    expect(redact("the code is 482913").text).toBe("the code is [code]");
    expect(containsProtectedInfo(redact("my NIN is 12345678901").found)).toBe(true);
  });

  it("leaves ordinary text and small numbers alone", () => {
    const r = redact("I have 34 units, plumber for 10am, budget ₦5,000");
    expect(r).toEqual({ text: "I have 34 units, plumber for 10am, budget ₦5,000", found: [] });
    expect(containsProtectedInfo(r.found)).toBe(false);
  });
});
