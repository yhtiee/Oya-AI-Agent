import * as Sentry from "@sentry/nextjs";
import { sentryBaseOptions } from "./lib/observability/sentry-options";

// Browser errors. Off unless NEXT_PUBLIC_SENTRY_DSN is set at build time.
Sentry.init(sentryBaseOptions(process.env.NEXT_PUBLIC_SENTRY_DSN, process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development"));

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
