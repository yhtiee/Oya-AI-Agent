import { describe, expect, it } from "vitest";
import { dummyHash, hashPassword, needsRehash, passwordProblem, verifyPassword } from "./password";

// Low parameters keep the suite fast; the format and verification logic are the same.
const FAST = { N: 2 ** 10, r: 8, p: 1 };

describe("password hashing", () => {
  it("verifies the right password and rejects the wrong one", async () => {
    const hash = await hashPassword("a long enough phrase", FAST);
    expect(hash).toMatch(/^scrypt\$1024\$8\$1\$[\w-]+\$[\w-]+$/);
    expect(await verifyPassword("a long enough phrase", hash)).toBe(true);
    expect(await verifyPassword("a long enough phrasE", hash)).toBe(false);
  });

  it("salts every hash", async () => {
    expect(await hashPassword("same password here", FAST)).not.toBe(await hashPassword("same password here", FAST));
  });

  it("normalises Unicode so the same characters always match", async () => {
    const hash = await hashPassword("café au lait please", FAST); // precomposed é
    expect(await verifyPassword("café au lait please", hash)).toBe(true); // e + combining accent
  });

  it("rejects malformed stored hashes instead of throwing", async () => {
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "bcrypt$1$2$3$4$5")).toBe(false);
    expect(await verifyPassword("x", "scrypt$abc$8$1$AAAA$AAAA")).toBe(false);
  });

  it("flags hashes made with old parameters for upgrade", async () => {
    expect(needsRehash(await hashPassword("whatever it is", FAST))).toBe(true);
    expect(needsRehash("scrypt$131072$8$1$AAAA$AAAA")).toBe(false);
  });

  it("has a dummy hash for unknown emails", async () => {
    expect(await verifyPassword("anything", await dummyHash())).toBe(false);
  }, 20_000);
});

describe("passwordProblem", () => {
  it("accepts reasonable passwords", () => {
    expect(passwordProblem("jollof on sunday")).toBeNull();
    expect(passwordProblem("Ewet-Housing-Block-7")).toBeNull();
  });

  it.each([
    ["short", /at least 10/],
    ["x".repeat(129), /at most 128/],
    ["password123", /too easy/],
    ["aaaaaaaaaaaa", /too easy/],
  ])("rejects %s", (pw, message) => {
    expect(passwordProblem(pw)).toMatch(message);
  });

  it("rejects passwords containing the email name", () => {
    expect(passwordProblem("utibeabasi2026!", { email: "utibeabasi@example.com" })).toMatch(/email/);
    expect(passwordProblem("my long passphrase", { email: "ab@example.com" })).toBeNull();
  });
});
