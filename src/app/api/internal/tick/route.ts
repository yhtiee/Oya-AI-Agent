import { randomUUID } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { after } from "next/server";
import { getServiceClient } from "@/server/db/service-client";
import { getEnv } from "@/server/env";
import { HANDLERS } from "@/server/jobs/handlers";
import { runTick } from "@/server/jobs/runner";
import { isAuthorisedTick } from "@/server/jobs/tick-auth";

/*
 * Job tick (SPEC §9). Called every minute by pg_cron (POST) and Vercel Cron (GET); overlapping ticks are
 * safe. Answers 202 straight away and does the work in after(), stopping new batches at 50 seconds.
 */

export const maxDuration = 60;

async function handle(request: Request) {
  const env = getEnv();
  if (!isAuthorisedTick(request.headers, { oyaCronSecret: env.OYA_CRON_SECRET, vercelCronSecret: env.CRON_SECRET })) {
    return new Response(null, { status: 401 });
  }

  const workerId = `tick-${randomUUID().slice(0, 8)}`;
  after(async () => {
    try {
      const report = await runTick({ client: getServiceClient(), workerId, handlers: HANDLERS, budgetMs: 50_000 });
      if (report.dead) Sentry.captureMessage(`tick ${workerId}: ${report.dead} job(s) dead`, "warning");
    } catch (e) {
      Sentry.captureException(e, { tags: { worker: workerId } });
    }
  });

  return Response.json({ accepted: true, worker: workerId }, { status: 202, headers: { "cache-control": "no-store" } });
}

export const GET = handle;
export const POST = handle;
