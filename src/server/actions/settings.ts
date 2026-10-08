"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { LOCALE_COOKIE } from "@/i18n/config";
import { isValidTimeZone } from "@/lib/time";
import { decrypt, encrypt, parseEncryptionKey } from "../crypto";
import { hashPassword, passwordProblem, PASSWORD_MAX, verifyPassword } from "../auth/password";
import { generateSecret, verifyTotp } from "../auth/totp";
import { getServiceClient } from "../db/service-client";
import { requireEnv } from "../env";
import { audit } from "../audit";
import { hitLimit, LIMITS } from "../rate-limit";
import { ActionError, authedAction, authedFormAction } from "./authed-action";

/* Account settings (SPEC §21.4 M1). Every action acts on the caller's own account only. */

const profileSchema = z.object({
  name: z.string().trim().min(1, "Tell us what to call you.").max(80, "Use 80 characters or fewer."),
  language: z.enum(["en", "pcm"]),
  timezone: z.string().trim().refine(isValidTimeZone, "Choose a valid time zone."),
});

export const updateProfile = authedFormAction(profileSchema, async (input, { session }) => {
  const { error } = await getServiceClient()
    .from("profiles")
    .update({ display_name: input.name, language: input.language, timezone: input.timezone })
    .eq("id", session.userId);
  if (error) throw new Error(error.message);

  await audit({
    actorId: session.userId,
    action: "profile_updated",
    entity: "profile",
    entityId: session.userId,
    diff: { language: input.language, timezone: input.timezone },
  });
  (await cookies()).set(LOCALE_COOKIE, input.language, { path: "/", sameSite: "lax", maxAge: 400 * 86_400 });
  revalidatePath("/app", "layout");
  return undefined;
});

const passwordSchema = z
  .object({
    current: z.string().min(1, "Enter your current password.").max(PASSWORD_MAX),
    next: z.string().max(PASSWORD_MAX),
    confirm: z.string().max(PASSWORD_MAX),
  })
  .refine((v) => v.next === v.confirm, { path: ["confirm"], message: "The new passwords don't match." });

export const changePassword = authedFormAction(passwordSchema, async (input, { session }) => {
  if (!(await hitLimit(`password:user:${session.userId}`, LIMITS.passwordChangePerUser))) {
    throw new ActionError("Too many attempts. Try again in an hour.");
  }
  const service = getServiceClient();
  const { data: stored } = await service.rpc("auth_get_password_hash", { p_user_id: session.userId });
  if (typeof stored !== "string" || !(await verifyPassword(input.current, stored))) {
    throw new ActionError("Your current password isn't right.", { current: "Not right." });
  }
  const problem = passwordProblem(input.next, { email: session.email });
  if (problem) throw new ActionError(problem, { next: problem });

  await service.rpc("auth_set_password", {
    p_user_id: session.userId,
    p_password_hash: await hashPassword(input.next),
  });
  // A changed password should lock out anyone else who had it.
  await service.rpc("auth_revoke_other_sessions", { p_user_id: session.userId, p_keep_session_id: session.sessionId });
  return undefined;
});

export const signOutOtherSessions = authedAction(z.object({}), async (_input, { session }) => {
  const { data } = await getServiceClient().rpc("auth_revoke_other_sessions", {
    p_user_id: session.userId,
    p_keep_session_id: session.sessionId,
  });
  revalidatePath("/app/settings");
  return { count: (data as number) ?? 0 };
});

/* Two-factor sign-in for ops and admins (SPEC §3.1, §4.6). */

const encryptionKey = () => parseEncryptionKey(requireEnv("APP_ENCRYPTION_KEY"));

/** Starts enrolment and returns the secret to add to an authenticator app. Staff only, before MFA is set up. */
export const beginMfaEnrolment = authedAction(z.object({}), async (_input, { session }) => {
  if (!session.appRole) throw new ActionError("Two-factor sign-in is for Oya staff accounts.");
  if (session.mfaEnabled) throw new ActionError("Two-factor sign-in is already set up on this account.");
  const secret = generateSecret();
  const { data: started } = await getServiceClient().rpc("auth_mfa_begin", {
    p_user_id: session.userId,
    p_secret_ciphertext: encrypt(secret, encryptionKey()),
  });
  if (!started) throw new ActionError("Two-factor sign-in is already set up on this account.");
  return { secret };
});

const codeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code from your app."),
});

/** Checks a code. The first correct code finishes enrolment; every correct code raises this session to aal2. */
export const verifyMfaCode = authedFormAction(codeSchema, async (input, { session }) => {
  if (!session.appRole) throw new ActionError("Two-factor sign-in is for Oya staff accounts.");
  if (!(await hitLimit(`mfa:user:${session.userId}`, LIMITS.mfaPerUser))) {
    throw new ActionError("Too many attempts. Wait 15 minutes and try again.");
  }
  const service = getServiceClient();
  const { data: factor } = await service
    .rpc("auth_mfa_get", { p_user_id: session.userId })
    .maybeSingle<{ secret_ciphertext: string; verified_at: string | null }>();
  if (!factor) throw new ActionError("Set up two-factor sign-in first.");

  const step = verifyTotp(decrypt(factor.secret_ciphertext, encryptionKey()), input.code);
  if (step === null)
    throw new ActionError("That code isn't right. Codes change every 30 seconds.", { code: "Not right." });

  const { data: accepted } = await service.rpc("auth_mfa_accept", {
    p_user_id: session.userId,
    p_session_id: session.sessionId,
    p_step: step,
  });
  if (!accepted) throw new ActionError("That code was already used. Wait for the next one.", { code: "Already used." });
  revalidatePath("/ops", "layout");
  return undefined;
});
