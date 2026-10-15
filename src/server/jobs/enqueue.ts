import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServiceClient } from "../db/service-client";
import type { JobType } from "./types";

/**
 * Queues a durable job (SPEC §9). A repeated `dedupeKey` is a no-op and returns the existing job,
 * so callers can enqueue from retried code paths without creating duplicates.
 */
export async function enqueueJob(
  type: JobType,
  payload: Record<string, unknown> = {},
  opts: { runAt?: Date; dedupeKey?: string; maxAttempts?: number; client?: SupabaseClient } = {},
): Promise<{ id: string; created: boolean }> {
  const client = opts.client ?? getServiceClient();
  const { data, error } = await client
    .rpc("enqueue_job", {
      p_type: type,
      p_payload: payload,
      p_run_at: opts.runAt?.toISOString(),
      p_dedupe_key: opts.dedupeKey,
      p_max_attempts: opts.maxAttempts ?? 5,
    })
    .single<{ id: string; created: boolean }>();
  if (error || !data) throw new Error(`enqueue ${type} failed: ${error?.message ?? "no row"}`);
  return data;
}
