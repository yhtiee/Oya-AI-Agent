import "server-only";
import { getServiceClient } from "./db/service-client";

/*
 * Fixed-window limits backed by internal.rate_limits (SPEC §16.4). The Supabase-side function
 * increments and checks in one statement, so concurrent requests can't slip past the limit.
 */

export const LIMITS = {
  signInPerIp: { windowSeconds: 15 * 60, max: 20 },
  signUpPerIp: { windowSeconds: 60 * 60, max: 5 },
  passwordChangePerUser: { windowSeconds: 60 * 60, max: 5 },
  mfaPerUser: { windowSeconds: 15 * 60, max: 5 },
} as const;

/** Wrong passwords before an account is locked, and for how long (mirrors §4.6's OTP lockout). */
export const SIGN_IN_LOCK = { maxFailures: 5, lockSeconds: 15 * 60 } as const;

export async function hitLimit(key: string, limit: { windowSeconds: number; max: number }): Promise<boolean> {
  const { data, error } = await getServiceClient().rpc("hit_rate_limit", {
    p_key: key,
    p_window_seconds: limit.windowSeconds,
    p_max: limit.max,
  });
  if (error) {
    // Fail closed: if we can't count, we don't let the attempt through.
    console.error(
      JSON.stringify({ level: "error", msg: "rate limit check failed", key: key.split(":")[0], error: error.message }),
    );
    return false;
  }
  return data === true;
}
