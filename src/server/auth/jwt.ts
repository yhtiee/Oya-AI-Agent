import { createPrivateKey, sign as cryptoSign, createHmac, type JsonWebKey, type KeyObject } from "node:crypto";

/*
 * Signs Supabase-compatible access tokens for Oya's own sessions (docs/decisions.md D-010).
 * Supabase verifies them against the project's JWKS, so RLS sees auth.uid() = our user id and
 * auth.jwt() ->> 'app_role' / 'aal' exactly as SPEC §12.3 expects.
 *
 * Preferred: an ES256 key imported into Supabase as a standby JWT signing key
 * (SUPABASE_JWT_SIGNING_KEY, base64 of the private JWK). Fallback: the legacy HS256 secret.
 */

export type AccessClaims = {
  sub: string;
  sessionId: string;
  email: string;
  appRole: "ops" | "admin" | null;
  aal: "aal1" | "aal2";
};

export type Signer = { alg: "ES256"; kid: string; key: KeyObject } | { alg: "HS256"; secret: Buffer };

export function signerFromEnv(env: { SUPABASE_JWT_SIGNING_KEY?: string; SUPABASE_JWT_SECRET?: string }): Signer | null {
  if (env.SUPABASE_JWT_SIGNING_KEY) {
    const jwk = JSON.parse(Buffer.from(env.SUPABASE_JWT_SIGNING_KEY, "base64").toString("utf8")) as JsonWebKey & {
      kid?: string;
    };
    if (jwk.kty !== "EC" || jwk.crv !== "P-256" || !jwk.d || !jwk.kid) {
      throw new Error("SUPABASE_JWT_SIGNING_KEY must be a base64-encoded private EC P-256 JWK with a kid");
    }
    return { alg: "ES256", kid: jwk.kid, key: createPrivateKey({ key: jwk, format: "jwk" }) };
  }
  if (env.SUPABASE_JWT_SECRET) return { alg: "HS256", secret: Buffer.from(env.SUPABASE_JWT_SECRET, "utf8") };
  return null;
}

const b64url = (input: string | Buffer) => Buffer.from(input).toString("base64url");

export function signAccessToken(
  signer: Signer,
  claims: AccessClaims,
  opts: { issuer: string; ttlSeconds: number; now?: number },
): { token: string; expiresAt: number } {
  const iat = Math.floor((opts.now ?? Date.now()) / 1000);
  const exp = iat + opts.ttlSeconds;
  const header = signer.alg === "ES256" ? { alg: "ES256", typ: "JWT", kid: signer.kid } : { alg: "HS256", typ: "JWT" };
  const payload = {
    iss: opts.issuer,
    aud: "authenticated",
    role: "authenticated",
    sub: claims.sub,
    email: claims.email,
    session_id: claims.sessionId,
    aal: claims.aal,
    // Only present for staff, so RLS checks of `auth.jwt() ->> 'app_role'` are null for everyone else.
    ...(claims.appRole ? { app_role: claims.appRole } : {}),
    is_anonymous: false,
    iat,
    exp,
  };
  const input = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const signature =
    signer.alg === "ES256"
      ? cryptoSign("sha256", Buffer.from(input), { key: signer.key, dsaEncoding: "ieee-p1363" })
      : createHmac("sha256", signer.secret).update(input).digest();
  return { token: `${input}.${b64url(signature)}`, expiresAt: exp * 1000 };
}
