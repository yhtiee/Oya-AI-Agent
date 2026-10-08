import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { safeNext } from "@/lib/safe-next";
import { keyedHash, parseEncryptionKey, randomToken, sha256 } from "../crypto";
import { getServiceClient } from "../db/service-client";
import { getEnv, requireEnv } from "../env";

/*
 * Oya-managed sessions (docs/decisions.md D-010): a random 32-byte token in an httpOnly cookie,
 * stored only as its SHA-256 in internal.sessions. 30 days, extended while in use.
 */

const SESSION_DAYS = 30;
const DAY_MS = 86_400_000;

export type Session = {
  sessionId: string;
  userId: string;
  email: string;
  aal: "aal1" | "aal2";
  appRole: "ops" | "admin" | null;
  displayName: string;
  language: string;
  timezone: string;
  mfaEnabled: boolean;
};

export function sessionCookieName(): string {
  // __Host- needs HTTPS, so plain localhost uses a simpler name.
  return getEnv().NODE_ENV === "production" ? "__Host-oya_session" : "oya_session";
}

function cookieOptions() {
  const secure = getEnv().NODE_ENV === "production";
  return { httpOnly: true, secure, sameSite: "lax" as const, path: "/", maxAge: 400 * 24 * 60 * 60 };
}

/** Client IP for rate limits, keyed-hashed so it's never stored raw. */
export async function clientIpHash(): Promise<string> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return keyedHash(ip, parseEncryptionKey(requireEnv("APP_ENCRYPTION_KEY")));
}

export async function startSession(userId: string): Promise<void> {
  const token = randomToken(32);
  const h = await headers();
  const { error } = await getServiceClient().rpc("auth_create_session", {
    p_user_id: userId,
    p_token_hash: `\\x${sha256(token).toString("hex")}`,
    p_expires_at: new Date(Date.now() + SESSION_DAYS * DAY_MS).toISOString(),
    p_ip_hash: await clientIpHash(),
    p_user_agent: h.get("user-agent")?.slice(0, 400) ?? null,
  });
  if (error) throw new Error(`Could not start session: ${error.message}`);
  (await cookies()).set(sessionCookieName(), token, cookieOptions());
}

/** The current session, resolved once per request. Null if signed out, expired or revoked. */
export const getSession = cache(async (): Promise<Session | null> => {
  const token = (await cookies()).get(sessionCookieName())?.value;
  if (!token || token.length > 100) return null;

  const { data, error } = await getServiceClient()
    .rpc("auth_get_session", {
      p_token_hash: `\\x${sha256(token).toString("hex")}`,
      p_extend_to: new Date(Date.now() + SESSION_DAYS * DAY_MS).toISOString(),
    })
    .maybeSingle<{
      session_id: string;
      user_id: string;
      email: string;
      aal: "aal1" | "aal2";
      app_role: "ops" | "admin" | null;
      display_name: string;
      language: string;
      timezone: string;
      mfa_enabled: boolean;
    }>();
  if (error) {
    console.error(JSON.stringify({ level: "error", msg: "session lookup failed", error: error.message }));
    return null;
  }
  if (!data) return null;

  return {
    sessionId: data.session_id,
    userId: data.user_id,
    email: data.email,
    aal: data.aal,
    appRole: data.app_role,
    displayName: data.display_name,
    language: data.language,
    timezone: data.timezone,
    mfaEnabled: data.mfa_enabled,
  };
});

export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(sessionCookieName())?.value;
  if (token) {
    await getServiceClient().rpc("auth_revoke_session", { p_token_hash: `\\x${sha256(token).toString("hex")}` });
  }
  jar.delete(sessionCookieName());
}

export { safeNext };

/** For pages: the signed-in user, or a redirect to sign in. */
export async function requireSession(next = "/app"): Promise<Session> {
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(safeNext(next))}`);
  return session;
}

/** For ops pages: ops/admin role *and* a two-factor session (aal2), per SPEC §3.1 and §4.6. */
export async function requireStaff(next = "/ops"): Promise<Session & { appRole: "ops" | "admin" }> {
  const session = await requireSession(next);
  if (!session.appRole) redirect("/app");
  if (session.aal !== "aal2") redirect(`/ops/verify?next=${encodeURIComponent(safeNext(next, "/ops"))}`);
  return session as Session & { appRole: "ops" | "admin" };
}
