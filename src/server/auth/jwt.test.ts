import { createHmac, createPublicKey, generateKeyPairSync, verify } from "node:crypto";
import { describe, expect, it } from "vitest";
import { signAccessToken, signerFromEnv } from "./jwt";

const claims = {
  sub: "11111111-1111-4111-8111-111111111111",
  sessionId: "s1",
  email: "a@b.co",
  appRole: null,
  aal: "aal1",
} as const;
const opts = { issuer: "https://x.supabase.co/auth/v1", ttlSeconds: 900, now: Date.UTC(2026, 9, 8) };

const decode = (part: string) => JSON.parse(Buffer.from(part, "base64url").toString("utf8"));

describe("signAccessToken", () => {
  it("signs ES256 tokens that verify with the public key and carry Supabase's claims", () => {
    const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const jwk = { ...privateKey.export({ format: "jwk" }), kid: "kid-1" };
    const signer = signerFromEnv({ SUPABASE_JWT_SIGNING_KEY: Buffer.from(JSON.stringify(jwk)).toString("base64") })!;

    const { token, expiresAt } = signAccessToken(signer, claims, opts);
    const [h, p, s] = token.split(".");
    expect(decode(h)).toEqual({ alg: "ES256", typ: "JWT", kid: "kid-1" });

    const payload = decode(p);
    expect(payload).toMatchObject({
      sub: claims.sub,
      role: "authenticated",
      aud: "authenticated",
      aal: "aal1",
      iss: opts.issuer,
    });
    expect(payload).not.toHaveProperty("app_role");
    expect(payload.exp - payload.iat).toBe(900);
    expect(expiresAt).toBe(payload.exp * 1000);

    const ok = verify(
      "sha256",
      Buffer.from(`${h}.${p}`),
      { key: createPublicKey(privateKey), dsaEncoding: "ieee-p1363" },
      Buffer.from(s, "base64url"),
    );
    expect(ok).toBe(true);
  });

  it("includes app_role only for staff", () => {
    const signer = signerFromEnv({ SUPABASE_JWT_SECRET: "secret" })!;
    const payload = decode(
      signAccessToken(signer, { ...claims, appRole: "ops", aal: "aal2" }, opts).token.split(".")[1],
    );
    expect(payload).toMatchObject({ app_role: "ops", aal: "aal2" });
  });

  it("signs HS256 with the legacy secret", () => {
    const signer = signerFromEnv({ SUPABASE_JWT_SECRET: "legacy-secret" })!;
    const [h, p, s] = signAccessToken(signer, claims, opts).token.split(".");
    expect(decode(h).alg).toBe("HS256");
    expect(s).toBe(createHmac("sha256", "legacy-secret").update(`${h}.${p}`).digest("base64url"));
  });
});

describe("signerFromEnv", () => {
  it("returns null when nothing is configured", () => expect(signerFromEnv({})).toBeNull());

  it("refuses keys that aren't private P-256 JWKs with a kid", () => {
    const { publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const pub = Buffer.from(JSON.stringify({ ...publicKey.export({ format: "jwk" }), kid: "k" })).toString("base64");
    expect(() => signerFromEnv({ SUPABASE_JWT_SIGNING_KEY: pub })).toThrow(/private EC P-256/);
  });
});
