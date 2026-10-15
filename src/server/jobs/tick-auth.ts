import { timingSafeEqual } from "node:crypto";

/*
 * Who may call /api/internal/tick (SPEC §9): pg_cron sends `x-oya-cron-secret: OYA_CRON_SECRET`;
 * Vercel Cron sends `Authorization: Bearer CRON_SECRET`. Either is enough. With neither secret
 * configured, nobody is allowed.
 */

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function isAuthorisedTick(
  headers: Headers,
  secrets: { oyaCronSecret?: string; vercelCronSecret?: string },
): boolean {
  const cron = headers.get("x-oya-cron-secret");
  if (secrets.oyaCronSecret && cron && same(cron, secrets.oyaCronSecret)) return true;

  const auth = headers.get("authorization");
  if (secrets.vercelCronSecret && auth?.startsWith("Bearer ")) {
    return same(auth.slice("Bearer ".length), secrets.vercelCronSecret);
  }
  return false;
}
