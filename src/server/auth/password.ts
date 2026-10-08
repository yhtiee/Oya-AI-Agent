import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

/*
 * Password hashing with scrypt (Node built-in). Parameters follow OWASP's scrypt guidance
 * (N=2^17, r=8, p=1). Stored as `scrypt$N$r$p$salt$hash` so parameters can be raised later
 * and old hashes still verify; `needsRehash` tells sign-in when to upgrade one.
 */

const PARAMS = { N: 2 ** 17, r: 8, p: 1 } as const;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;

function scrypt(password: string, salt: Buffer, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scryptCb(password.normalize("NFKC"), salt, KEY_LENGTH, { ...opts, maxmem: 256 * 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(key),
    ),
  );
}

export async function hashPassword(
  password: string,
  params: { N: number; r: number; p: number } = PARAMS,
): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const hash = await scrypt(password, salt, params);
  return ["scrypt", params.N, params.r, params.p, salt.toString("base64url"), hash.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [N, r, p] = parts.slice(1, 4).map(Number);
  if (![N, r, p].every((n) => Number.isSafeInteger(n) && n > 0)) return false;
  const expected = Buffer.from(parts[5], "base64url");
  const actual = await scrypt(password, Buffer.from(parts[4], "base64url"), { N, r, p });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function needsRehash(stored: string): boolean {
  const [, N, r, p] = stored.split("$").map((v, i) => (i === 0 ? v : Number(v)));
  return N !== PARAMS.N || r !== PARAMS.r || p !== PARAMS.p;
}

/** A real hash of a random password, verified against when an email doesn't exist, so timing doesn't reveal it. */
let dummy: Promise<string> | undefined;
export function dummyHash(): Promise<string> {
  dummy ??= hashPassword(randomBytes(16).toString("hex"));
  return dummy;
}

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;

// A few of the passwords people reuse most. Length rules catch most of the rest.
const COMMON = new Set([
  "password123",
  "1234567890",
  "qwertyuiop",
  "password1234",
  "iloveyou123",
  "1q2w3e4r5t",
  "abcdefghij",
  "0123456789",
  "passw0rd123",
  "nigeria1234",
  "naija12345",
]);

/** Returns a short reason the password isn't acceptable, or null if it's fine (NIST 800-63B style). */
export function passwordProblem(password: string, context: { email?: string; name?: string } = {}): string | null {
  if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (password.length > PASSWORD_MAX) return `Use at most ${PASSWORD_MAX} characters.`;
  const lower = password.toLowerCase();
  if (COMMON.has(lower) || /^(.)\1+$/.test(password))
    return "That password is too easy to guess. Try a short phrase instead.";
  const local = context.email?.split("@")[0]?.toLowerCase();
  if (local && local.length >= 4 && lower.includes(local)) return "Don't use your email address in your password.";
  return null;
}
