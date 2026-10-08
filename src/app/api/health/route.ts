import { connection } from "next/server";
import { getServiceClient, hasServiceClient } from "@/server/db/service-client";
import { getEnv } from "@/server/env";

type Check = { ok: boolean; latencyMs?: number; error?: string };

async function checkDatabase(): Promise<Check> {
  if (!hasServiceClient()) return { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY is not set" };
  const started = performance.now();
  const { error } = await getServiceClient().from("feature_flags").select("key", { head: true, count: "exact" });
  const latencyMs = Math.round(performance.now() - started);
  return error ? { ok: false, latencyMs, error: "query failed" } : { ok: true, latencyMs };
}

/** Liveness and DB connectivity (SPEC §21.4 M0). Never returns secrets or data. */
export async function GET() {
  await connection();
  const env = getEnv();
  const db = await checkDatabase().catch(() => ({ ok: false, error: "unreachable" }) as Check);

  return Response.json(
    {
      status: db.ok ? "ok" : "degraded",
      env: env.APP_ENV,
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
      time: new Date().toISOString(),
      checks: { database: db },
    },
    { status: db.ok ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
