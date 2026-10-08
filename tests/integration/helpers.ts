import { generateKeyPairSync, randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { signAccessToken, signerFromEnv, type AccessClaims, type Signer } from "@/server/auth/jwt";

/* Shared setup for tests that talk to the real Supabase project. */

export const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const publicKey = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!;

export const service = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const signer = signerFromEnv({
  SUPABASE_JWT_SIGNING_KEY: process.env.SUPABASE_JWT_SIGNING_KEY,
  SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET,
}) as Signer;

export function token(
  claims: Partial<AccessClaims> & { sub: string },
  opts: { ttlSeconds?: number; now?: number; signWith?: Signer } = {},
) {
  return signAccessToken(
    opts.signWith ?? signer,
    { sessionId: randomUUID(), email: "test@example.com", appRole: null, aal: "aal1", ...claims },
    { issuer: `${url}/auth/v1`, ttlSeconds: opts.ttlSeconds ?? 300, now: opts.now },
  ).token;
}

export function asUser(accessToken: string | null): SupabaseClient {
  return createClient(url, publicKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    ...(accessToken ? { accessToken: async () => accessToken } : {}),
  });
}

/** A signer with the right kid but the wrong key, to prove forged tokens are rejected. */
export function forgedSigner(): Signer {
  if (signer.alg !== "ES256") throw new Error("forgedSigner expects an ES256 signer");
  const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  return { alg: "ES256", kid: signer.kid, key: privateKey };
}

const TEST_DOMAIN = "integration.oya.test";

export async function createTestUser(label: string): Promise<{ id: string; email: string }> {
  const email = `${label}-${randomUUID().slice(0, 8)}@${TEST_DOMAIN}`;
  const { data, error } = await service.rpc("auth_create_user", {
    p_email: email,
    // Not a usable password hash: these accounts never sign in.
    p_password_hash: "scrypt$1$1$1$AAAA$AAAA",
    p_display_name: `Test ${label}`,
    p_language: "en",
    p_policy_version: "test",
  });
  if (error) throw new Error(`create user failed: ${error.message}`);
  return { id: data as string, email };
}

export async function deleteTestUser(id: string | undefined) {
  if (id) await service.rpc("auth_delete_user", { p_user_id: id, p_deleted_by: null });
}

export function requireIntegrationEnv() {
  const missing = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_JWT_SIGNING_KEY"].filter(
    (k) => !process.env[k],
  );
  if (missing.length) throw new Error(`Integration tests need ${missing.join(", ")} in .env`);
}
