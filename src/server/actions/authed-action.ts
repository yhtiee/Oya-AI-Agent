import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getSession, type Session } from "../auth/session";
import { getUserClient } from "../db/user-client";

/*
 * Every server action goes through here (R13). It resolves the session, validates the input,
 * and hands the handler a user-scoped client (RLS applies) for the ownership check that must come
 * before any service-role write. Staff actions also need the ops/admin role and a two-factor
 * session; the role is read live from user_roles on every request, so revoking it takes effect
 * immediately (SPEC §4.6).
 */

export type ActionState<T = undefined> =
  | { status: "idle" }
  | { status: "ok"; data: T; message?: string }
  | { status: "error"; error: string; fieldErrors?: Record<string, string>; values?: Record<string, string> };

export type ActionContext = { session: Session; db: SupabaseClient };

type Options = { staff?: boolean };

export class ActionError extends Error {
  constructor(
    message: string,
    readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}

// Never echo secrets back to the browser.
const SECRET_FIELD = /password|current|next|confirm|code|token|secret/i;

/**
 * What the person typed, so a form can refill itself after an error. React 19 resets a form's
 * fields after every action, which would otherwise wipe their input.
 */
export function echoValues(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "string" && !k.startsWith("$") && !SECRET_FIELD.test(k)) out[k] = v.slice(0, 500);
  }
  return out;
}

function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

async function run<S extends z.ZodType, T>(
  schema: S,
  raw: unknown,
  handler: (input: z.infer<S>, ctx: ActionContext) => Promise<T>,
  opts: Options,
): Promise<ActionState<T>> {
  const session = await getSession();
  if (!session) return { status: "error", error: "You've been signed out. Sign in again to continue." };
  if (opts.staff && (!session.appRole || session.aal !== "aal2")) {
    return { status: "error", error: "This needs an ops account with two-factor sign-in." };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "error",
      error: "Check the highlighted fields.",
      fieldErrors: fieldErrors(parsed.error),
      values: echoValues(raw),
    };
  }

  try {
    const data = await handler(parsed.data, { session, db: getUserClient(session) });
    return { status: "ok", data };
  } catch (err) {
    if (err instanceof ActionError)
      return { status: "error", error: err.message, fieldErrors: err.fieldErrors, values: echoValues(raw) };
    // Framework control flow (redirect, notFound) must propagate.
    if (err && typeof err === "object" && "digest" in err) throw err;
    console.error(
      JSON.stringify({ level: "error", msg: "action failed", error: err instanceof Error ? err.message : String(err) }),
    );
    return { status: "error", error: "Something went wrong on our side. Please try again.", values: echoValues(raw) };
  }
}

/** For actions called with a typed argument from client code. */
export function authedAction<S extends z.ZodType, T>(
  schema: S,
  handler: (input: z.infer<S>, ctx: ActionContext) => Promise<T>,
  opts: Options = {},
) {
  return async (input: z.input<S>) => run(schema, input, handler, opts);
}

/** For `<form action>` with useActionState: (previous state, FormData) → state. */
export function authedFormAction<S extends z.ZodType, T>(
  schema: S,
  handler: (input: z.infer<S>, ctx: ActionContext) => Promise<T>,
  opts: Options = {},
) {
  return async (_prev: ActionState<T>, form: FormData) => run(schema, Object.fromEntries(form), handler, opts);
}
