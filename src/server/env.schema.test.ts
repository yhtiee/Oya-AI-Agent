import { describe, expect, it } from "vitest";
import { parseEnv, resolveAppEnv } from "./env.schema";

const base = {
  NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x",
};

describe("parseEnv", () => {
  it("accepts a minimal development environment and defaults to mock integrations", () => {
    const env = parseEnv(base);
    expect(env.APP_ENV).toBe("development");
    expect(env.INTEGRATIONS_MODE).toBe("mock");
    expect(env.SUPABASE_PUBLIC_KEY).toBe("sb_publishable_x");
  });

  it("accepts the spec's anon-key name too", () => {
    const env = parseEnv({
      NEXT_PUBLIC_SUPABASE_URL: base.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
    });
    expect(env.SUPABASE_PUBLIC_KEY).toBe("anon");
  });

  it("lists every problem in one error", () => {
    expect(() => parseEnv({ NEXT_PUBLIC_SUPABASE_URL: "not a url", OYA_CRON_SECRET: "short" })).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL[\s\S]*OYA_CRON_SECRET[\s\S]*PUBLISHABLE_KEY/,
    );
  });

  it("treats blank variables as unset", () => {
    expect(parseEnv({ ...base, SENTRY_DSN: "" }).SENTRY_DSN).toBeUndefined();
  });

  it("requires production secrets in production only", () => {
    const prod = {
      ...base,
      VERCEL_ENV: "production",
      SUPABASE_SERVICE_ROLE_KEY: "sb_secret_x",
      APP_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64"),
      SUPABASE_JWT_SIGNING_KEY: "a2V5",
    };
    expect(parseEnv(prod).APP_ENV).toBe("production");
    expect(() => parseEnv({ ...prod, SUPABASE_SERVICE_ROLE_KEY: undefined })).toThrow(
      /SUPABASE_SERVICE_ROLE_KEY is required/,
    );
    expect(() => parseEnv({ ...prod, APP_ENCRYPTION_KEY: undefined })).toThrow(/APP_ENCRYPTION_KEY is required/);
    expect(() => parseEnv({ ...prod, SUPABASE_JWT_SIGNING_KEY: undefined })).toThrow(/SUPABASE_JWT_SIGNING_KEY/);
    expect(parseEnv({ ...prod, SUPABASE_JWT_SIGNING_KEY: undefined, SUPABASE_JWT_SECRET: "s" }).APP_ENV).toBe(
      "production",
    );
    expect(parseEnv({ ...base, VERCEL_ENV: "preview" }).APP_ENV).toBe("staging");
  });

  it("checks the encryption key is 32 bytes", () => {
    expect(() => parseEnv({ ...base, APP_ENCRYPTION_KEY: Buffer.alloc(16).toString("base64") })).toThrow(/32 bytes/);
  });

  it("parses booleans and numbers", () => {
    const env = parseEnv({ ...base, BOOTSTRAP_MODE: "true", LLM_DAILY_BUDGET_USD: "0.3", COMMISSION_BPS: "1000" });
    expect(env.BOOTSTRAP_MODE).toBe(true);
    expect(env.LLM_DAILY_BUDGET_USD).toBe(0.3);
    expect(env.COMMISSION_BPS).toBe(1000);
    expect(parseEnv({ ...base, BOOTSTRAP_MODE: "0" }).BOOTSTRAP_MODE).toBe(false);
    expect(() => parseEnv({ ...base, INTEGRATIONS_MODE: "sometimes" })).toThrow(/INTEGRATIONS_MODE/);
  });
});

describe("resolveAppEnv", () => {
  it("maps Vercel and Node environments", () => {
    expect(resolveAppEnv("production", "production")).toBe("production");
    expect(resolveAppEnv("production", "preview")).toBe("staging");
    expect(resolveAppEnv("test", undefined)).toBe("test");
    expect(resolveAppEnv("production", undefined)).toBe("development");
  });
});
