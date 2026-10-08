import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, generateSecret, otpauthUri, timeStep, totpAt, verifyTotp } from "./totp";

// RFC 6238 Appendix B (SHA-1): secret "12345678901234567890", 8 digits.
const RFC_SECRET = Buffer.from("12345678901234567890", "ascii");
const RFC_VECTORS: [number, string][] = [
  [59, "94287082"],
  [1111111109, "07081804"],
  [1111111111, "14050471"],
  [1234567890, "89005924"],
  [2000000000, "69279037"],
  [20000000000, "65353130"],
];

describe("totp", () => {
  it.each(RFC_VECTORS)("matches RFC 6238 at T=%i", (t, code) => {
    expect(totpAt(RFC_SECRET, Math.floor(t / 30), 8)).toBe(code);
  });

  it("round-trips base32", () => {
    const buf = Buffer.from("hello oya, sort am!");
    expect(base32Decode(base32Encode(buf))).toEqual(buf);
    expect(base32Encode(Buffer.from("12345678901234567890"))).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    expect(() => base32Decode("not!base32")).toThrow();
  });

  it("generates 160-bit secrets", () => {
    expect(base32Decode(generateSecret())).toHaveLength(20);
  });

  it("accepts the current step and one either side, and returns the step", () => {
    const secret = generateSecret();
    const now = Date.UTC(2026, 9, 8, 12, 0, 10);
    const step = timeStep(now);
    const code = (s: number) => totpAt(base32Decode(secret), s);
    expect(verifyTotp(secret, code(step), now)).toBe(step);
    expect(verifyTotp(secret, code(step - 1), now)).toBe(step - 1);
    expect(verifyTotp(secret, code(step + 1), now)).toBe(step + 1);
    expect(verifyTotp(secret, code(step - 2), now)).toBeNull();
    expect(verifyTotp(secret, ` ${code(step).slice(0, 3)} ${code(step).slice(3)} `, now)).toBe(step);
  });

  it("rejects malformed codes", () => {
    const secret = generateSecret();
    expect(verifyTotp(secret, "12345")).toBeNull();
    expect(verifyTotp(secret, "abcdef")).toBeNull();
  });

  it("builds an otpauth URI authenticator apps understand", () => {
    const uri = otpauthUri("ABCDEF", "ops@oya.ng");
    expect(uri).toBe("otpauth://totp/Oya%3Aops%40oya.ng?secret=ABCDEF&issuer=Oya&algorithm=SHA1&digits=6&period=30");
  });
});
