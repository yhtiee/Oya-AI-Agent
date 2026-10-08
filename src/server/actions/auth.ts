"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { z } from "zod";
import { LOCALE_COOKIE } from "@/i18n/config";
import { dummyHash, hashPassword, needsRehash, passwordProblem, PASSWORD_MAX, verifyPassword } from "../auth/password";
import { POLICY_VERSION } from "../auth/policy";
import { clientIpHash, endSession, safeNext, startSession } from "../auth/session";
import { getServiceClient } from "../db/service-client";
import { hitLimit, LIMITS, SIGN_IN_LOCK } from "../rate-limit";
import { echoValues, type ActionState } from "./authed-action";

/*
 * Sign-up, sign-in and sign-out (docs/decisions.md D-006, D-010). These are the only actions that
 * run without a session, so they don't use authedAction(); each one rate-limits by IP first.
 */

export type AuthState = ActionState<undefined>;

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, "Enter a valid email address.");

const signUpSchema = z.object({
  name: z.string().trim().min(1, "Tell us what to call you.").max(80, "Use 80 characters or fewer."),
  email,
  password: z.string().max(PASSWORD_MAX),
  confirm: z.string().max(PASSWORD_MAX),
  language: z.enum(["en", "pcm"]).default("en"),
  // SPEC §3.3: accounts are 18+. The "Under 18?" link explains why, without sending anything here.
  adult: z.literal("on", { message: "Oya accounts are for people 18 and older." }),
  terms: z.literal("on", { message: "You need to agree to continue." }),
  next: z.string().optional(),
});

export async function signUp(_prev: AuthState, form: FormData): Promise<AuthState> {
  const raw = Object.fromEntries(form);

  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { status: "error", values: echoValues(raw), error: "Check the highlighted fields.", fieldErrors };
  }
  const input = parsed.data;

  if (input.password !== input.confirm) {
    return {
      status: "error",
      values: echoValues(raw),
      error: "The two passwords don't match.",
      fieldErrors: { confirm: "Doesn't match the password above." },
    };
  }

  const problem = passwordProblem(input.password, { email: input.email, name: input.name });
  if (problem) return { status: "error", values: echoValues(raw), error: problem, fieldErrors: { password: problem } };

  if (!(await hitLimit(`signup:ip:${await clientIpHash()}`, LIMITS.signUpPerIp))) {
    return {
      status: "error",
      values: echoValues(raw),
      error: "Too many sign-ups from this connection. Try again in an hour.",
    };
  }

  const { data: userId, error } = await getServiceClient().rpc("auth_create_user", {
    p_email: input.email,
    p_password_hash: await hashPassword(input.password),
    p_display_name: input.name,
    p_language: input.language,
    p_policy_version: POLICY_VERSION,
  });
  if (error) {
    if (error.code === "23505") {
      return {
        status: "error",
        values: echoValues(raw),
        error: "There's already an account with this email. Sign in instead.",
        fieldErrors: { email: "Already registered." },
      };
    }
    console.error(JSON.stringify({ level: "error", msg: "sign up failed", error: error.message }));
    return { status: "error", values: echoValues(raw), error: "We couldn't create your account. Please try again." };
  }

  await startSession(userId as string);
  (await cookies()).set(LOCALE_COOKIE, input.language, { path: "/", sameSite: "lax", maxAge: 400 * 86_400 });
  redirect(safeNext(input.next));
}

const signInSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password.").max(PASSWORD_MAX),
  next: z.string().optional(),
});

const WRONG = "That email and password don't match. Check them and try again.";

export async function signIn(_prev: ActionState, form: FormData): Promise<ActionState> {
  const raw = Object.fromEntries(form);
  const parsed = signInSchema.safeParse(raw);
  if (!parsed.success) return { status: "error", values: echoValues(raw), error: WRONG };
  const input = parsed.data;

  if (!(await hitLimit(`signin:ip:${await clientIpHash()}`, LIMITS.signInPerIp))) {
    return {
      status: "error",
      values: echoValues(raw),
      error: "Too many attempts from this connection. Wait 15 minutes and try again.",
    };
  }

  const service = getServiceClient();
  const { data: cred } = await service
    .rpc("auth_get_credentials", { p_email: input.email })
    .maybeSingle<{ user_id: string; password_hash: string; locked_until: string | null; disabled_at: string | null }>();

  if (!cred || cred.disabled_at) {
    // Same work either way, so response time doesn't reveal whether the email exists.
    await verifyPassword(input.password, await dummyHash());
    return { status: "error", values: echoValues(raw), error: WRONG };
  }

  if (cred.locked_until && new Date(cred.locked_until) > new Date()) {
    const minutes = Math.ceil((new Date(cred.locked_until).getTime() - Date.now()) / 60_000);
    return {
      status: "error",
      values: echoValues(raw),
      error: `Too many wrong passwords. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    };
  }

  if (!(await verifyPassword(input.password, cred.password_hash))) {
    const { data: lockedUntil } = await service.rpc("auth_record_failed_sign_in", {
      p_user_id: cred.user_id,
      p_max: SIGN_IN_LOCK.maxFailures,
      p_lock_seconds: SIGN_IN_LOCK.lockSeconds,
    });
    return {
      status: "error",
      values: echoValues(raw),
      error: lockedUntil ? "Too many wrong passwords. Your account is locked for 15 minutes." : WRONG,
    };
  }

  if (needsRehash(cred.password_hash)) {
    await service.rpc("auth_set_password", {
      p_user_id: cred.user_id,
      p_password_hash: await hashPassword(input.password),
    });
  }

  await startSession(cred.user_id);
  redirect(safeNext(input.next));
}

export async function signOut(): Promise<void> {
  await endSession();
  redirect("/");
}
