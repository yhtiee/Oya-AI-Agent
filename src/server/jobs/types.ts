import type { SupabaseClient } from "@supabase/supabase-js";

/* Job types and the row shape returned by claim_jobs (SPEC §9). Kept in step with internal.jobs. */

export const JOB_TYPES = [
  "process_inbound",
  "resume_turn",
  "task_timer",
  "send_outbound",
  "reminder_fire",
  "watch_eval",
  "power_status_recompute",
  "provider_daily_menu",
  "kb_freshness_check",
  "cost_report",
  "retention_purge",
  "account_deletion",
  "reconcile_payments",
  "llm_breaker_check",
  "deferred_message",
  "backup_dump",
  "alerts_digest",
] as const;

export type JobType = (typeof JOB_TYPES)[number];

export type Job = {
  id: string;
  type: JobType;
  payload: Record<string, unknown>;
  run_at: string;
  status: "queued" | "running" | "done" | "failed" | "dead";
  attempts: number;
  max_attempts: number;
  locked_at: string | null;
  locked_by: string | null;
  last_error: string | null;
  dedupe_key: string | null;
  created_at: string;
};

export type JobContext = { client: SupabaseClient; workerId: string; now: () => Date };

/** Thrown by a handler when retrying can't help (bad payload). The job goes straight to `dead`. */
export class PermanentJobError extends Error {
  override name = "PermanentJobError";
}

export type JobHandler = (job: Job, ctx: JobContext) => Promise<void>;
