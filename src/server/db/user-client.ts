import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { signAccessToken, signerFromEnv, type Signer } from "../auth/jwt";
import type { Session } from "../auth/session";
import { getEnv } from "../env";

/*
 * Supabase client acting as the signed-in user. Each request carries a short-lived access token
 * our server signs for the current session (docs/decisions.md D-010), so RLS applies exactly as
 * if Supabase Auth had issued it. Use it for reads and for the ownership check that must happen
 * before any service-role write (R13).
 */

const TTL_SECONDS = 15 * 60;
const tokenCache = new Map<string, { token: string; expiresAt: number }>();
let signer: Signer | null | undefined;

function getSigner(): Signer {
  signer ??= signerFromEnv(getEnv());
  if (!signer) throw new Error("Set SUPABASE_JWT_SIGNING_KEY (or SUPABASE_JWT_SECRET) to query Supabase as a user.");
  return signer;
}

export function accessTokenFor(session: Session): string {
  const key = `${session.sessionId}:${session.aal}:${session.appRole ?? ""}`;
  const cached = tokenCache.get(key);
  if (cached && cached.expiresAt - Date.now() > 2 * 60_000) return cached.token;

  const minted = signAccessToken(
    getSigner(),
    {
      sub: session.userId,
      sessionId: session.sessionId,
      email: session.email,
      appRole: session.appRole,
      aal: session.aal,
    },
    { issuer: `${getEnv().NEXT_PUBLIC_SUPABASE_URL}/auth/v1`, ttlSeconds: TTL_SECONDS },
  );
  if (tokenCache.size > 5000) tokenCache.clear();
  tokenCache.set(key, minted);
  return minted.token;
}

export function getUserClient(session: Session): SupabaseClient {
  const env = getEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_PUBLIC_KEY, {
    accessToken: async () => accessTokenFor(session),
  });
}
