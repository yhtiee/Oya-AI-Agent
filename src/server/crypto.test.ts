import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decrypt, encrypt, keyedHash, parseEncryptionKey, randomToken, safeEqual, sha256 } from "./crypto";

describe("crypto helpers", () => {
  const key = randomBytes(32);

  it("encrypts and decrypts", () => {
    const sealed = encrypt("JBSWY3DPEHPK3PXP", key);
    expect(sealed.startsWith("v1.")).toBe(true);
    expect(sealed).not.toContain("JBSWY3DPEHPK3PXP");
    expect(decrypt(sealed, key)).toBe("JBSWY3DPEHPK3PXP");
  });

  it("uses a fresh IV every time", () => expect(encrypt("same", key)).not.toBe(encrypt("same", key)));

  it("detects tampering and wrong keys", () => {
    const sealed = encrypt("secret", key);
    const parts = sealed.split(".");
    const flipped = Buffer.from(parts[3], "base64url");
    flipped[0] ^= 1;
    expect(() => decrypt([...parts.slice(0, 3), flipped.toString("base64url")].join("."), key)).toThrow();
    expect(() => decrypt(sealed, randomBytes(32))).toThrow();
    expect(() => decrypt("v2.a.b.c", key)).toThrow(/Unrecognised/);
  });

  it("parses only 32-byte keys", () => {
    expect(parseEncryptionKey(key.toString("base64"))).toEqual(key);
    expect(() => parseEncryptionKey(randomBytes(16).toString("base64"))).toThrow(/32 bytes/);
  });

  it("makes random URL-safe tokens", () => {
    const t = randomToken();
    expect(t).toMatch(/^[\w-]{43}$/);
    expect(t).not.toBe(randomToken());
  });

  it("hashes and compares", () => {
    expect(sha256("oya")).toHaveLength(32);
    expect(safeEqual("cron-secret", "cron-secret")).toBe(true);
    expect(safeEqual("cron-secret", "cron-secreT")).toBe(false);
    expect(safeEqual("short", "a much longer value")).toBe(false);
    expect(keyedHash("1.2.3.4", key)).toBe(keyedHash("1.2.3.4", key));
    expect(keyedHash("1.2.3.4", key)).not.toBe(keyedHash("1.2.3.4", randomBytes(32)));
  });
});
