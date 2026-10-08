import { z } from "zod";

/*
 * Every environment variable from SPEC §21.3, validated at boot (src/instrumentation.ts).
 *
 * Variables for later milestones are declared now so typos and malformed values fail fast,
 * but they're optional until the milestone that needs them. `REQUIRED_IN_PRODUCTION` lists
 * what a deployed environment must have today.
 */

const optionalString = z.string().trim().min(1).optional();
const optionalUrl = z.url().optional();
const bool = z
  .enum(["true", "false", "1", "0"])
  .transform((v) => v === "true" || v === "1")
  .optional();
const positiveNumber = z.coerce.number().positive().optional();

export const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    /** Set by Vercel: production | preview | development. */
    VERCEL_ENV: z.enum(["production", "preview", "development"]).optional(),

    // Supabase
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    /** The spec's name. Supabase now calls it the publishable key; either variable works. */
    NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalString,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: optionalString,
    /** Service role or new-style secret key. Server code under src/server/** only (R6). */
    SUPABASE_SERVICE_ROLE_KEY: optionalString,
    SUPABASE_HOOK_SECRET_SEND_SMS: optionalString,
    /** Base64 private EC P-256 JWK imported into Supabase as a JWT signing key (D-010). */
    SUPABASE_JWT_SIGNING_KEY: optionalString,
    /** Legacy HS256 secret; used only if no signing key is set. */
    SUPABASE_JWT_SECRET: optionalString,
    DATABASE_URL: optionalString,

    // App and cron
    APP_BASE_URL: optionalUrl,
    NEXT_PUBLIC_SITE_URL: optionalUrl,
    APP_ENCRYPTION_KEY: z
      .string()
      .refine((v) => Buffer.from(v, "base64").length === 32, "APP_ENCRYPTION_KEY must be 32 bytes, base64-encoded")
      .optional(),
    OYA_CRON_SECRET: z.string().min(24, "OYA_CRON_SECRET must be at least 24 characters").optional(),
    CRON_SECRET: z.string().min(16).optional(),
    VERCEL_AUTOMATION_BYPASS_SECRET: optionalString,

    // LLM
    ANTHROPIC_API_KEY: optionalString,
    LLM_ROUTER_MODEL: optionalString,
    LLM_SIMPLE_MODEL: optionalString,
    LLM_COMPLEX_MODEL: optionalString,
    LLM_WEB_MODEL: optionalString,
    WEB_DAILY_BUDGET_USD: positiveNumber,
    WEB_ANSWERS_PER_USER_DAY: positiveNumber,

    // Bootstrap
    BOOTSTRAP_MODE: bool,
    LLM_DAILY_BUDGET_USD: positiveNumber,
    EVAL_DAILY_BUDGET_USD: positiveNumber,
    BACKUP_AGE_PUBLIC_KEY: optionalString,
    SUPABASE_POOLER_URL: optionalString,

    // LLM fallback
    GOOGLE_GENERATIVE_AI_API_KEY: optionalString,
    LLM_FALLBACK_ROUTER_MODEL: optionalString,
    LLM_FALLBACK_SIMPLE_MODEL: optionalString,
    LLM_FALLBACK_COMPLEX_MODEL: optionalString,

    // WhatsApp
    WA_PHONE_NUMBER_ID: optionalString,
    WA_BUSINESS_ACCOUNT_ID: optionalString,
    WA_ACCESS_TOKEN: optionalString,
    WA_APP_SECRET: optionalString,
    WA_VERIFY_TOKEN: optionalString,

    // Telegram
    TELEGRAM_BOT_TOKEN: optionalString,
    TELEGRAM_WEBHOOK_SECRET: optionalString,

    // Payments (1b)
    PAYSTACK_SECRET_KEY: optionalString,
    PAYSTACK_PUBLIC_KEY: optionalString,
    PAY_RELAY_EMAIL_DOMAIN: optionalString,
    COMMISSION_BPS: z.coerce.number().int().min(0).max(10_000).optional(),

    // SMS
    TERMII_API_KEY: optionalString,
    TERMII_SENDER_ID: optionalString,
    TERMII_CHANNEL: optionalString,

    // Speech
    SPEECH_PROVIDER: optionalString,
    SPITCH_API_KEY: optionalString,
    OPENAI_API_KEY: optionalString,

    // ID verification
    ID_VERIFY_PROVIDER: optionalString,
    ID_VERIFY_API_KEY: optionalString,

    // Maps
    GOOGLE_MAPS_SERVER_KEY: optionalString,
    NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY: optionalString,

    // Push and monitoring
    VAPID_PUBLIC_KEY: optionalString,
    VAPID_PRIVATE_KEY: optionalString,
    SENTRY_DSN: optionalUrl,
    NEXT_PUBLIC_SENTRY_DSN: optionalUrl,
    RESEND_API_KEY: optionalString,

    // Mode
    INTEGRATIONS_MODE: z.enum(["live", "mock"]).default("mock"),
  })
  .superRefine((env, ctx) => {
    if (!env.NEXT_PUBLIC_SUPABASE_ANON_KEY && !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
      ctx.addIssue({
        code: "custom",
        path: ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"],
        message: "Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)",
      });
    }
    if (env.VERCEL_ENV === "production") {
      for (const key of REQUIRED_IN_PRODUCTION) {
        if (!env[key]) ctx.addIssue({ code: "custom", path: [key], message: `${key} is required in production` });
      }
      if (!env.SUPABASE_JWT_SIGNING_KEY && !env.SUPABASE_JWT_SECRET) {
        ctx.addIssue({
          code: "custom",
          path: ["SUPABASE_JWT_SIGNING_KEY"],
          message: "SUPABASE_JWT_SIGNING_KEY (or SUPABASE_JWT_SECRET) is required in production",
        });
      }
    }
  });

/** What a deployed production environment needs as of M1. Grows with each milestone. */
export const REQUIRED_IN_PRODUCTION = ["SUPABASE_SERVICE_ROLE_KEY", "APP_ENCRYPTION_KEY"] as const;

export type Env = z.infer<typeof envSchema> & {
  /** Resolved from VERCEL_ENV and NODE_ENV. */
  APP_ENV: AppEnv;
  /** Whichever of the publishable / anon key variables is set. */
  SUPABASE_PUBLIC_KEY: string;
};

export type AppEnv = "development" | "staging" | "production" | "test";

export function resolveAppEnv(nodeEnv: string | undefined, vercelEnv: string | undefined): AppEnv {
  if (vercelEnv === "production") return "production";
  if (vercelEnv === "preview") return "staging";
  if (nodeEnv === "test") return "test";
  return "development";
}

/** Parses and validates; throws one readable error that lists every problem. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  // Treat empty strings as unset, which is how most hosts represent a blank variable.
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, v]) => v !== undefined && v !== ""));
  const result = envSchema.safeParse(cleaned);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${lines.join("\n")}`);
  }
  const env = result.data;
  return {
    ...env,
    APP_ENV: resolveAppEnv(env.NODE_ENV, env.VERCEL_ENV),
    SUPABASE_PUBLIC_KEY: (env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
  };
}
