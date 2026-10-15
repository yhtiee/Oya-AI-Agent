import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServiceClient } from "../db/service-client";

export type WebhookSource = "whatsapp" | "telegram" | "sms" | "paystack" | "verification" | "other";

/**
 * Records an inbound webhook and its process_inbound job in one transaction (SPEC §7.2). A provider's
 * retry of the same event returns `duplicate: true` and the original job, so it's processed once.
 */
export async function ingestWebhook(
  source: WebhookSource,
  externalId: string,
  payload: Record<string, unknown>,
  client: SupabaseClient = getServiceClient(),
): Promise<{ eventId: string; jobId: string | null; duplicate: boolean }> {
  const { data, error } = await client
    .rpc("ingest_webhook", { p_source: source, p_external_id: externalId, p_payload: payload })
    .single<{ event_id: string; job_id: string | null; duplicate: boolean }>();
  if (error || !data) throw new Error(`ingest_webhook failed: ${error?.message ?? "no row"}`);
  return { eventId: data.event_id, jobId: data.job_id, duplicate: data.duplicate };
}
