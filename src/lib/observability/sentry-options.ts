import type { ErrorEvent } from "@sentry/nextjs";

/*
 * Shared Sentry settings (SPEC §16.5): errors and 10% of traces in production, and never
 * message text or personal data. Request bodies, cookies, query strings and user details are
 * stripped before anything leaves the server or the browser.
 */

export function sentryBaseOptions(dsn: string | undefined, environment: string) {
  return {
    dsn,
    enabled: Boolean(dsn),
    environment,
    tracesSampleRate: environment === "production" ? 0.1 : 0,
    sendDefaultPii: false,
    beforeSend: scrubEvent,
  };
}

export function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
    delete event.request.query_string;
    if (event.request.headers) {
      for (const h of Object.keys(event.request.headers)) {
        if (/cookie|authorization|x-oya|apikey|token/i.test(h)) delete event.request.headers[h];
      }
    }
  }
  if (event.user) event.user = event.user.id ? { id: event.user.id } : undefined;
  return event;
}
