import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { enqueueJob } from "./enqueue";
import { PermanentJobError, type Job, type JobContext, type JobHandler, type JobType } from "./types";

/*
 * The tick (SPEC §9): heartbeat, reaper, periodic jobs, then claim and run jobs in batches of 10 until the
 * queue is empty or the 50-second budget is spent. Claiming uses FOR UPDATE SKIP LOCKED, and only the
 * worker holding a job's lock can complete or fail it, so overlapping ticks never run a job twice at once.
 * Handlers must still be idempotent: a tick killed mid-job leaves it `running`, the reaper re-queues it
 * after 5 minutes, and it runs again.
 */

export type TickOptions = {
  client: SupabaseClient;
  workerId: string;
  handlers: Partial<Record<JobType, JobHandler>>;
  budgetMs?: number;
  batchSize?: number;
  now?: () => Date;
};

export type TickReport = { claimed: number; done: number; retried: number; dead: number; reaped: number };

const TEN_MINUTES = 10 * 60 * 1000;

export async function runTick(opts: TickOptions): Promise<TickReport> {
  const { client, workerId } = opts;
  const now = opts.now ?? (() => new Date());
  const started = now().getTime();
  const budgetMs = opts.budgetMs ?? 50_000;
  const batchSize = opts.batchSize ?? 10;
  const report: TickReport = { claimed: 0, done: 0, retried: 0, dead: 0, reaped: 0 };

  await client.rpc("record_heartbeat", { p_name: "tick" });

  const reaped = await client.rpc("reap_jobs", { p_stale_after_s: 300 });
  report.reaped = typeof reaped.data === "number" ? reaped.data : 0;

  await client.rpc("llm_breaker_check");

  // Reminders due in the next 90 seconds get a reminder_fire job each (once per occurrence).
  await client.rpc("enqueue_due_reminders", { p_horizon_s: 90 });

  // The local-alerts digest once a day from 07:00 Lagos (SPEC §5.6).
  const lagos = new Date(now().getTime() + 3_600_000);
  if (lagos.getUTCHours() >= 7) {
    const day = lagos.toISOString().slice(0, 10);
    await enqueueJob("alerts_digest", { day }, { dedupeKey: `alerts_digest:${day}`, client });
  }

  // Power status every 10 minutes: one job per 10-minute bucket, whichever tick gets there first.
  const bucket = Math.floor(now().getTime() / TEN_MINUTES);
  await enqueueJob("power_status_recompute", {}, { dedupeKey: `power_status_recompute:${bucket}`, client });

  const ctx: JobContext = { client, workerId, now };
  while (now().getTime() - started < budgetMs) {
    const { data, error } = await client.rpc("claim_jobs", { p_worker: workerId, p_limit: batchSize });
    if (error) throw new Error(`claim_jobs failed: ${error.message}`);
    const jobs = (data ?? []) as Job[];
    if (!jobs.length) break;
    report.claimed += jobs.length;

    for (const job of jobs) {
      const outcome = await runJob(job, ctx, opts.handlers);
      report[outcome]++;
    }
  }
  return report;
}

/** Runs one claimed job and records the result. Returns what happened to it. */
export async function runJob(
  job: Job,
  ctx: JobContext,
  handlers: Partial<Record<JobType, JobHandler>>,
): Promise<"done" | "retried" | "dead"> {
  const handler = handlers[job.type];
  try {
    if (!handler) throw new PermanentJobError(`no handler for ${job.type} yet`);
    await handler(job, ctx);
  } catch (e) {
    const permanent = e instanceof PermanentJobError;
    const message = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    const { data } = await ctx.client.rpc("fail_job", {
      p_id: job.id,
      p_worker: ctx.workerId,
      p_error: message,
      p_retry: !permanent,
    });
    return data === "dead" ? "dead" : "retried";
  }
  await ctx.client.rpc("complete_job", { p_id: job.id, p_worker: ctx.workerId });
  return "done";
}

/** Claims one specific job and runs it now, e.g. right after an inbound webhook (SPEC §7.2). */
export async function runJobNow(
  jobId: string,
  ctx: JobContext,
  handlers: Partial<Record<JobType, JobHandler>>,
): Promise<"done" | "retried" | "dead" | "not_claimed"> {
  const { data, error } = await ctx.client.rpc("claim_job_by_id", { p_id: jobId, p_worker: ctx.workerId });
  if (error) throw new Error(`claim_job_by_id failed: ${error.message}`);
  const job = (data as Job[] | null)?.[0];
  if (!job) return "not_claimed";
  return runJob(job, ctx, handlers);
}
