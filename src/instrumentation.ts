import * as Sentry from "@sentry/nextjs";

/**
 * Runs once when a server instance starts. Validates the environment first so a bad deploy
 * fails fast with a readable list of problems (SPEC §21.3), then starts Sentry if configured.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getEnv } = await import("./server/env");
    const env = getEnv();
    const { sentryBaseOptions } = await import("./lib/observability/sentry-options");
    Sentry.init(sentryBaseOptions(env.SENTRY_DSN, env.APP_ENV));
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    const { sentryBaseOptions } = await import("./lib/observability/sentry-options");
    Sentry.init(sentryBaseOptions(process.env.SENTRY_DSN, process.env.VERCEL_ENV ?? "development"));
  }
}

export const onRequestError = Sentry.captureRequestError;
